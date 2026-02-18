const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'powdercast.db');
const db = new Database(dbPath);

// Major US Ski Resorts with base and summit coordinates
const resorts = [
  // California - Lake Tahoe
  {
    id: 'palisades-tahoe-ca',
    name: 'Palisades Tahoe',
    state: 'CA',
    region: 'Lake Tahoe',
    base_lat: 39.1967,
    base_lon: -120.2356,
    base_elevation: 6200,
    summit_lat: 39.1978,
    summit_lon: -120.2389,
    summit_elevation: 9050,
    webcam_url: 'https://www.palisadestahoe.com/mountain-information/mountain-cams',
  },
  {
    id: 'northstar-ca',
    name: 'Northstar California',
    state: 'CA',
    region: 'Lake Tahoe',
    base_lat: 39.2704,
    base_lon: -120.1215,
    base_elevation: 6330,
    summit_lat: 39.2766,
    summit_lon: -120.1184,
    summit_elevation: 8610,
    webcam_url: 'https://www.northstarcalifornia.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  {
    id: 'heavenly-ca',
    name: 'Heavenly',
    state: 'CA',
    region: 'Lake Tahoe',
    base_lat: 38.9347,
    base_lon: -119.9403,
    base_elevation: 6540,
    summit_lat: 38.9594,
    summit_lon: -119.9372,
    summit_elevation: 10067,
    webcam_url: 'https://www.skiheavenly.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  {
    id: 'kirkwood-ca',
    name: 'Kirkwood',
    state: 'CA',
    region: 'Lake Tahoe',
    base_lat: 38.6844,
    base_lon: -120.0647,
    base_elevation: 7800,
    summit_lat: 38.6978,
    summit_lon: -120.0581,
    summit_elevation: 9800,
    webcam_url: 'https://www.kirkwood.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  
  // California - Mammoth
  {
    id: 'mammoth-ca',
    name: 'Mammoth Mountain',
    state: 'CA',
    region: 'Eastern Sierra',
    base_lat: 37.6308,
    base_lon: -119.0326,
    base_elevation: 7953,
    summit_lat: 37.6467,
    summit_lon: -119.0303,
    summit_elevation: 11053,
    webcam_url: 'https://www.mammothmountain.com/mountain-information/webcams',
  },
  
  // Colorado - Summit County
  {
    id: 'vail-co',
    name: 'Vail',
    state: 'CO',
    region: 'Summit County',
    base_lat: 39.6403,
    base_lon: -106.3742,
    base_elevation: 8120,
    summit_lat: 39.6433,
    summit_lon: -106.3561,
    summit_elevation: 11570,
    webcam_url: 'https://www.vail.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  {
    id: 'breckenridge-co',
    name: 'Breckenridge',
    state: 'CO',
    region: 'Summit County',
    base_lat: 39.4817,
    base_lon: -106.0664,
    base_elevation: 9600,
    summit_lat: 39.4797,
    summit_lon: -106.0456,
    summit_elevation: 12998,
    webcam_url: 'https://www.breckenridge.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  {
    id: 'keystone-co',
    name: 'Keystone',
    state: 'CO',
    region: 'Summit County',
    base_lat: 39.6042,
    base_lon: -105.9547,
    base_elevation: 9280,
    summit_lat: 39.6389,
    summit_lon: -105.9547,
    summit_elevation: 12408,
    webcam_url: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  {
    id: 'arapahoe-basin-co',
    name: 'Arapahoe Basin',
    state: 'CO',
    region: 'Summit County',
    base_lat: 39.6425,
    base_lon: -105.8717,
    base_elevation: 10780,
    summit_lat: 39.6456,
    summit_lon: -105.8633,
    summit_elevation: 13050,
    webcam_url: 'https://www.arapahoebasin.com/the-mountain/mountain-conditions/mountain-cams/',
  },
  {
    id: 'copper-mountain-co',
    name: 'Copper Mountain',
    state: 'CO',
    region: 'Summit County',
    base_lat: 39.5022,
    base_lon: -106.1506,
    base_elevation: 9712,
    summit_lat: 39.4894,
    summit_lon: -106.1378,
    summit_elevation: 12313,
    webcam_url: 'https://www.coppercolorado.com/the-mountain/mountain-conditions/mountain-cams',
  },
  
  // Colorado - Aspen
  {
    id: 'aspen-snowmass-co',
    name: 'Aspen Snowmass',
    state: 'CO',
    region: 'Aspen',
    base_lat: 39.2130,
    base_lon: -106.9478,
    base_elevation: 8104,
    summit_lat: 39.1911,
    summit_lon: -106.9333,
    summit_elevation: 12510,
    webcam_url: 'https://www.aspensnowmass.com/the-mountains/mountain-conditions/webcams',
  },
  
  // Wyoming
  {
    id: 'jackson-hole-wy',
    name: 'Jackson Hole',
    state: 'WY',
    region: 'Teton Range',
    base_lat: 43.5875,
    base_lon: -110.8281,
    base_elevation: 6311,
    summit_lat: 43.5881,
    summit_lon: -110.8378,
    summit_elevation: 10450,
    webcam_url: 'https://www.jacksonhole.com/webcams',
  },
  
  // Utah - Park City
  {
    id: 'park-city-ut',
    name: 'Park City Mountain',
    state: 'UT',
    region: 'Park City',
    base_lat: 40.6514,
    base_lon: -111.5078,
    base_elevation: 6900,
    summit_lat: 40.6486,
    summit_lon: -111.4761,
    summit_elevation: 10026,
    webcam_url: 'https://www.parkcitymountain.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  {
    id: 'deer-valley-ut',
    name: 'Deer Valley',
    state: 'UT',
    region: 'Park City',
    base_lat: 40.6372,
    base_lon: -111.4789,
    base_elevation: 6570,
    summit_lat: 40.6222,
    summit_lon: -111.4614,
    summit_elevation: 9570,
    webcam_url: 'https://www.deervalley.com/mountain/snow-report/web-cams',
  },
  
  // Utah - Salt Lake City
  {
    id: 'alta-ut',
    name: 'Alta',
    state: 'UT',
    region: 'Wasatch Range',
    base_lat: 40.5883,
    base_lon: -111.6378,
    base_elevation: 8530,
    summit_lat: 40.5733,
    summit_lon: -111.6392,
    summit_elevation: 10550,
    webcam_url: 'https://www.alta.com/conditions/mountain-cams',
  },
  {
    id: 'snowbird-ut',
    name: 'Snowbird',
    state: 'UT',
    region: 'Wasatch Range',
    base_lat: 40.5833,
    base_lon: -111.6550,
    base_elevation: 7760,
    summit_lat: 40.5742,
    summit_lon: -111.6533,
    summit_elevation: 11000,
    webcam_url: 'https://www.snowbird.com/mountain-report/webcams/',
  },
  
  // Montana
  {
    id: 'big-sky-mt',
    name: 'Big Sky Resort',
    state: 'MT',
    region: 'Madison Range',
    base_lat: 45.2847,
    base_lon: -111.4022,
    base_elevation: 7500,
    summit_lat: 45.2847,
    summit_lon: -111.3539,
    summit_elevation: 11166,
    webcam_url: 'https://bigskyresort.com/the-mountain/mountain-conditions/mountain-cams',
  },
  
  // Vermont
  {
    id: 'killington-vt',
    name: 'Killington',
    state: 'VT',
    region: 'Green Mountains',
    base_lat: 43.6044,
    base_lon: -72.8197,
    base_elevation: 1165,
    summit_lat: 43.6539,
    summit_lon: -72.8211,
    summit_elevation: 4241,
    webcam_url: 'https://www.killington.com/the-mountain/mountain-conditions/mountain-cams',
  },
  {
    id: 'stowe-vt',
    name: 'Stowe',
    state: 'VT',
    region: 'Green Mountains',
    base_lat: 44.5300,
    base_lon: -72.7831,
    base_elevation: 1108,
    summit_lat: 44.5247,
    summit_lon: -72.7858,
    summit_elevation: 3625,
    webcam_url: 'https://www.stowe.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  
  // New Hampshire
  {
    id: 'bretton-woods-nh',
    name: 'Bretton Woods',
    state: 'NH',
    region: 'White Mountains',
    base_lat: 44.2592,
    base_lon: -71.4361,
    base_elevation: 1500,
    summit_lat: 44.2717,
    summit_lon: -71.4331,
    summit_elevation: 3100,
    webcam_url: 'https://www.brettonwoods.com/mountain-report/webcams',
  },
  
  // Washington
  {
    id: 'stevens-pass-wa',
    name: 'Stevens Pass',
    state: 'WA',
    region: 'Cascade Range',
    base_lat: 47.7453,
    base_lon: -121.0889,
    base_elevation: 4061,
    summit_lat: 47.7461,
    summit_lon: -121.0844,
    summit_elevation: 5845,
    webcam_url: 'https://www.stevenspass.com/the-mountain/mountain-conditions/mountain-cams.aspx',
  },
  {
    id: 'crystal-mountain-wa',
    name: 'Crystal Mountain',
    state: 'WA',
    region: 'Cascade Range',
    base_lat: 46.9356,
    base_lon: -121.4742,
    base_elevation: 4400,
    summit_lat: 46.9267,
    summit_lon: -121.4728,
    summit_elevation: 7012,
    webcam_url: 'https://www.crystalmountainresort.com/the-mountain/mountain-conditions/mountain-cams',
  },
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO resorts (
    id, name, state, region,
    base_lat, base_lon, base_elevation,
    summit_lat, summit_lon, summit_elevation,
    webcam_url
  ) VALUES (
    @id, @name, @state, @region,
    @base_lat, @base_lon, @base_elevation,
    @summit_lat, @summit_lon, @summit_elevation,
    @webcam_url
  )
`);

const insertMany = db.transaction((resorts) => {
  for (const resort of resorts) {
    insert.run(resort);
  }
});

insertMany(resorts);

console.log(`✅ Successfully seeded ${resorts.length} resorts into the database`);

db.close();
