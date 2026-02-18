import { NextRequest, NextResponse } from 'next/server';
import { searchResorts, getAllResorts, getResortById } from '@/lib/database';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const id = searchParams.get('id');

  try {
    // Get specific resort by ID
    if (id) {
      const resort = getResortById(id);
      if (!resort) {
        return NextResponse.json(
          { error: 'Resort not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(resort);
    }

    // Search resorts by query
    if (query) {
      const resorts = searchResorts(query);
      return NextResponse.json(resorts);
    }

    // Get all resorts
    const resorts = getAllResorts();
    return NextResponse.json(resorts);
  } catch (error) {
    console.error('Resort API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resorts' },
      { status: 500 }
    );
  }
}
