import { NextRequest, NextResponse } from 'next/server';

const NWS_API_BASE = 'https://api.weather.gov';
const USER_AGENT = 'PowderCast/1.1 (contact@powdercast.app)';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  
  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'Missing latitude or longitude' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Get the point data (includes forecast URLs)
    const pointResponse = await fetch(
      `${NWS_API_BASE}/points/${lat},${lon}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/geo+json',
        },
      }
    );

    if (!pointResponse.ok) {
      throw new Error(`NWS API error: ${pointResponse.status}`);
    }

    const pointData = await pointResponse.json();
    const forecastUrl = pointData.properties.forecast;
    const gridDataUrl = pointData.properties.forecastGridData;

    // Step 2: Fetch forecast and grid data in parallel
    const [forecastResponse, gridDataResponse] = await Promise.all([
      fetch(forecastUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/geo+json',
        },
      }),
      fetch(gridDataUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/geo+json',
        },
      }),
    ]);

    if (!forecastResponse.ok || !gridDataResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const forecast = await forecastResponse.json();
    const gridData = await gridDataResponse.json();

    return NextResponse.json({
      forecast,
      gridData,
      location: pointData.properties.relativeLocation.properties,
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
