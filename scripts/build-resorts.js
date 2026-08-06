#!/usr/bin/env node
/**
 * Build public/resorts.json from OpenSkiMap.
 *
 * OpenSkiMap is an OpenStreetMap-derived open dataset of the world's ski areas.
 * Crucially it carries real min/max piste elevations computed from actual run
 * geometry, which is far better than hand-entered numbers and is exactly what
 * the elevation-aware forecast providers need.
 *
 * Hand-maintaining coordinates for hundreds of resorts is not viable and gets
 * quietly wrong over time; this regenerates from source instead.
 *
 *   yarn build:resorts            # use cached download if present
 *   yarn build:resorts --refresh  # re-download the source dataset
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE_URL = 'https://tiles.openskimap.org/geojson/ski_areas.geojson';
const CACHE_PATH = path.join(__dirname, '..', '.cache', 'ski_areas.geojson');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'resorts.json');
const PASSES_PATH = path.join(__dirname, '..', 'data', 'passes.json');

const METERS_TO_FEET = 3.28084;

/**
 * Countries we ship, and the region bucket each falls into. Adding a country
 * here is all it takes to extend coverage — the forecast layer is already
 * global.
 */
const COUNTRIES = {
  US: { regionCode: null }, // Resolved per-state below.
  FR: { regionCode: 'alps', timezone: 'Europe/Paris' },
  CH: { regionCode: 'alps', timezone: 'Europe/Zurich' },
  AT: { regionCode: 'alps', timezone: 'Europe/Vienna' },
  DE: { regionCode: 'alps', timezone: 'Europe/Berlin' },
  IT: { regionCode: 'alps', timezone: 'Europe/Rome' },
  ES: { regionCode: 'pyrenees', timezone: 'Europe/Madrid' },
  AD: { regionCode: 'pyrenees', timezone: 'Europe/Andorra' },
  JP: { regionCode: 'japan', timezone: 'Asia/Tokyo' },
};

/**
 * Italian resorts in these provinces are Dolomites rather than western Alps.
 * BZ = South Tyrol, TN = Trentino, BL = Belluno.
 */
const DOLOMITE_PROVINCES = new Set(['IT-32', 'IT-BZ', 'IT-TN', 'IT-BL', 'IT-34']);
const DOLOMITE_REGIONS = ['trentino', 'south tyrol', 'südtirol', 'alto adige', 'veneto', 'belluno'];

/** Spanish/French regions that are Pyrenean rather than Alpine. */
const PYRENEES_REGIONS = ['pyrén', 'pyren', 'aragon', 'aragón', 'cataluña', 'catalonia', 'catalunya', 'navarra', 'occitanie'];

const US_TIMEZONES = {
  'America/Los_Angeles': ['CA', 'WA', 'OR', 'NV'],
  'America/Denver': ['CO', 'UT', 'WY', 'MT', 'NM', 'ID'],
  'America/Phoenix': ['AZ'],
  'America/Chicago': ['MN', 'WI', 'IA', 'MO', 'IL', 'ND', 'SD', 'NE'],
  'America/New_York': ['VT', 'NH', 'ME', 'NY', 'MA', 'CT', 'RI', 'PA', 'NJ', 'MD', 'VA', 'WV', 'NC', 'TN', 'OH', 'MI', 'IN', 'GA'],
  'America/Anchorage': ['AK'],
};

const US_REGIONS = {
  'us-west': ['CA', 'WA', 'OR', 'NV', 'AK', 'AZ'],
  'us-rockies': ['CO', 'UT', 'WY', 'MT', 'ID', 'NM'],
  'us-east': ['VT', 'NH', 'ME', 'NY', 'MA', 'CT', 'RI', 'PA', 'NJ', 'MD', 'VA', 'WV', 'NC', 'TN', 'OH', 'MI', 'IN', 'MN', 'WI', 'MO', 'IA', 'IL', 'GA'],
};

function lookup(table, needle, fallback) {
  for (const [key, values] of Object.entries(table)) {
    if (values.includes(needle)) return key;
  }
  return fallback;
}

// ---------------------------------------------------------------------------

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);

    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

/** Area-weighted centroid of a Polygon or MultiPolygon. */
function centroid(geometry) {
  const rings =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.map((poly) => poly[0])
        : geometry.type === 'Point'
          ? null
          : null;

  if (!rings) {
    if (geometry.type === 'Point') {
      return { lon: geometry.coordinates[0], lat: geometry.coordinates[1] };
    }
    return null;
  }

  let totalArea = 0;
  let cx = 0;
  let cy = 0;

  for (const ring of rings) {
    let area = 0;
    let rx = 0;
    let ry = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      rx += (x0 + x1) * cross;
      ry += (y0 + y1) * cross;
    }

    area /= 2;
    if (area === 0) continue;

    totalArea += area;
    cx += rx / 6;
    cy += ry / 6;
  }

  if (totalArea === 0) {
    // Degenerate polygon — fall back to the mean vertex.
    const points = rings.flat();
    return {
      lon: points.reduce((a, p) => a + p[0], 0) / points.length,
      lat: points.reduce((a, p) => a + p[1], 0) / points.length,
    };
  }

  return { lon: cx / totalArea, lat: cy / totalArea };
}

function totalRunKm(props) {
  const byDifficulty = props.statistics?.runs?.byActivity?.downhill?.byDifficulty;
  if (!byDifficulty) return 0;
  return Object.values(byDifficulty).reduce((sum, d) => sum + (d.lengthInKm || 0), 0);
}

function slugify(name, country) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${base}-${country.toLowerCase()}`;
}

const LATIN = /[A-Za-z]/;

/**
 * OpenSkiMap names are comma-joined alternates, often with the local-script
 * name first: "ニセコユナイテッド, Niseko United". Prefer the first segment
 * containing Latin characters — without this, every Japanese resort slugifies
 * to an empty string and collapses into a single entry.
 */
function cleanName(raw) {
  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
  let name = segments.find((s) => LATIN.test(s)) || segments[0] || raw;

  // "Zermatt - Breuil-Cervinia" style joins: keep the leading side when long.
  if (name.length > 40 && name.includes(' - ')) {
    name = name.split(' - ')[0].trim();
  }
  return name;
}

function resolveRegion(props, country, stateCode, shortState, regionName) {
  if (country === 'US') {
    return lookup(US_REGIONS, shortState, 'us-east');
  }

  const lowerRegion = (regionName || '').toLowerCase();

  if (country === 'IT') {
    const isDolomites =
      DOLOMITE_PROVINCES.has(stateCode) ||
      DOLOMITE_REGIONS.some((r) => lowerRegion.includes(r));
    return isDolomites ? 'dolomites' : 'alps';
  }

  if (country === 'FR' && PYRENEES_REGIONS.some((r) => lowerRegion.includes(r))) {
    return 'pyrenees';
  }

  return COUNTRIES[country].regionCode;
}

function resolveTimezone(country, stateCode) {
  if (country === 'US') {
    return lookup(US_TIMEZONES, stateCode, 'America/Denver');
  }
  return COUNTRIES[country].timezone;
}

// ---------------------------------------------------------------------------
// Pass matching

function buildPassIndex(passesFile) {
  const entries = [];
  for (const group of passesFile.affiliations) {
    for (const resort of group.resorts) {
      entries.push({
        pass: group.pass,
        access: group.access,
        days: group.days,
        note: group.note,
        match: resort.match.map((m) => m.toLowerCase()),
        exclude: (resort.exclude || []).map((m) => m.toLowerCase()),
        country: resort.country,
        matched: 0,
      });
    }
  }
  return entries;
}

function passesFor(resortName, country, index, season) {
  const haystack = resortName.toLowerCase();
  const found = new Map();

  for (const entry of index) {
    if (entry.country !== country) continue;
    if (entry.exclude.some((token) => haystack.includes(token))) continue;
    if (!entry.match.some((token) => haystack.includes(token))) continue;

    entry.matched++;

    // A resort can appear on several passes but only once per pass; keep the
    // most generous access level if it somehow matches twice.
    const existing = found.get(entry.pass);
    if (existing && existing.access === 'unlimited') continue;

    found.set(entry.pass, {
      pass: entry.pass,
      access: entry.access,
      ...(entry.days ? { days: entry.days } : {}),
      season,
      ...(entry.note ? { notes: entry.note } : {}),
    });
  }

  return Array.from(found.values());
}

// ---------------------------------------------------------------------------

async function main() {
  const refresh = process.argv.includes('--refresh');
  const minRunKm = Number(
    (process.argv.find((a) => a.startsWith('--min-km=')) || '--min-km=12').split('=')[1]
  );

  if (refresh || !fs.existsSync(CACHE_PATH)) {
    console.log(`⬇️  Downloading ${SOURCE_URL} ...`);
    await download(SOURCE_URL, CACHE_PATH);
  } else {
    console.log('📦 Using cached dataset (pass --refresh to update)');
  }

  const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  const passesFile = JSON.parse(fs.readFileSync(PASSES_PATH, 'utf8'));
  const passIndex = buildPassIndex(passesFile);

  console.log(`🔍 Scanning ${raw.features.length} ski areas (min ${minRunKm}km of runs)...`);

  const resorts = [];
  const seen = new Set();

  for (const feature of raw.features) {
    const props = feature.properties;

    if (props.status !== 'operating') continue;
    if (!props.activities?.includes('downhill')) continue;
    if (!props.name) continue;

    const place = props.places?.[0];
    const country = place?.iso3166_1Alpha2;
    if (!country || !(country in COUNTRIES)) continue;

    // Real elevation data is the whole reason we use this source.
    const minElevation = props.statistics?.minElevation;
    const maxElevation = props.statistics?.maxElevation;
    if (typeof minElevation !== 'number' || typeof maxElevation !== 'number') continue;

    const vertical = maxElevation - minElevation;
    if (vertical < 150) continue; // Filters out nordic areas and single lifts.

    if (totalRunKm(props) < minRunKm) continue;

    const point = centroid(feature.geometry);
    if (!point) continue;

    const name = cleanName(props.name);
    const stateCode = place?.iso3166_2 || '';
    const shortState = stateCode.includes('-') ? stateCode.split('-')[1] : stateCode;
    const regionName = place?.localized?.en?.region || '';
    const locality = place?.localized?.en?.locality || '';

    const id = slugify(name, country);
    if (seen.has(id)) continue;
    seen.add(id);

    const regionCode = resolveRegion(props, country, stateCode, shortState, regionName);

    resorts.push({
      id,
      name,
      state: country === 'US' ? shortState : regionName || shortState,
      region: regionName || locality || name,
      country,
      regionCode,
      timezone: resolveTimezone(country, shortState),

      // Base and summit share a coordinate but differ in elevation. That is
      // deliberate: providers downscale by elevation, and the two points of a
      // resort are far too close together to resolve as separate grid cells.
      base_lat: Number(point.lat.toFixed(4)),
      base_lon: Number(point.lon.toFixed(4)),
      base_elevation: Math.round(minElevation * METERS_TO_FEET),
      summit_lat: Number(point.lat.toFixed(4)),
      summit_lon: Number(point.lon.toFixed(4)),
      summit_elevation: Math.round(maxElevation * METERS_TO_FEET),

      webcam_url: null,
      website_url: props.websites?.[0] || null,
      runsKm: Math.round(totalRunKm(props)),
      passes: passesFor(props.name, country, passIndex, passesFile.season),
    });
  }

  resorts.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(resorts, null, 0));

  // --- Report ---------------------------------------------------------------
  const byRegion = {};
  const byPass = {};
  for (const r of resorts) {
    byRegion[r.regionCode] = (byRegion[r.regionCode] || 0) + 1;
    for (const p of r.passes) byPass[p.pass] = (byPass[p.pass] || 0) + 1;
  }

  console.log(`\n✅ Wrote ${resorts.length} resorts to public/resorts.json`);
  console.log(`   ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(0)} KB\n`);

  console.log('   By region:');
  for (const [region, count] of Object.entries(byRegion).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${region.padEnd(14)} ${count}`);
  }

  console.log('\n   By pass:');
  for (const [pass, count] of Object.entries(byPass).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${pass.padEnd(22)} ${count}`);
  }

  // Unmatched pass entries almost always mean a roster or naming change.
  // Only warn about countries we actually ship; the roster intentionally
  // carries Canadian, Australian and South American entries for reference.
  const unmatched = passIndex.filter((e) => e.matched === 0 && e.country in COUNTRIES);
  if (unmatched.length) {
    console.log(`\n⚠️  ${unmatched.length} pass entries matched no resort:`);
    for (const entry of unmatched) {
      console.log(`     ${entry.pass}/${entry.country}: ${entry.match.join(', ')}`);
    }
    console.log(
      '\n   Usually one of: the resort is below the size threshold, its name\n' +
        '   changed upstream, or it left the pass. Verify before shipping.'
    );

    if (process.argv.includes('--check')) {
      console.error('\n❌ --check: unmatched pass entries present');
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error('💥 Build failed:', err);
  process.exit(1);
});
