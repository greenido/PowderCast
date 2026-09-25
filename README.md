# 🏂 PowderCast v2.1

<p align="center">
  <img src="./public/logo.svg" alt="PowderCast Logo" width="200" height="200"/>
</p>

<p align="center">
  <b>Mountain weather for snowboarders and skiers, worldwide.</b><br/>
  <i>Because "70% chance of snow" doesn't tell you whether to call in sick.</i>
</p>

<p align="center">
  🚀 <a href="https://greenido.github.io/PowderCast/"><b>Try it live →</b></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js 15"/>
  <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react" alt="React 19"/>
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript 5"/>
  <img src="https://img.shields.io/badge/Tailwind-3-38bdf8?style=for-the-badge&logo=tailwind-css" alt="Tailwind 3"/>
  <img src="https://img.shields.io/badge/API_keys-0-brightgreen?style=for-the-badge" alt="Zero API keys"/>
</p>

---

## ❄️ What is this?

PowderCast is a hyper-local forecast for **722 ski resorts** in the US, the
Alps, the Dolomites, the Pyrenees and Japan. It answers the only question that
matters at 6am:

> **Where should I ride, and which day?**

It knows your ski pass, so it won't recommend a mountain you'd need a second
mortgage to get into. It knows whether it's raining at the base, so you won't
drive three hours to ski on a Slurpee. And it's a fully static site with no
backend, no API keys and no database. Nothing to page anyone about.

| Where | Resorts | What the locals call good snow |
|---|---:|---|
| 🇨🇭 Alps (FR · CH · AT · DE · IT) | 387 | *Pulverschnee* |
| 🏔️ US Rockies | 79 | Champagne powder |
| 🍁 US East & Midwest | 68 | "Loud powder" (ice) |
| 🇮🇹 Dolomites | 53 | Whatever's under the espresso |
| 🇯🇵 Japan | 50 | **JaPow** |
| 🌲 US West | 46 | Sierra Cement (with love) |
| 🇦🇩 Pyrenees | 39 | *Pols* / *polvo* |

## ✨ Features

### 🗺️ Four ways to look at the mountains

| View | What it's for |
|---|---|
| **⛰️ Single Mountain** | Everything about one resort, with the verdict on a phone's first screen |
| **📊 Compare Regions** | Every resort in a region side by side, ranked by Ride Score, plus a map |
| **🗓️ 7-Day Planner** | Resorts × days in one grid, so the best mountain *and* the best day stand out |
| **⭐ Compare Favorites** | Your shortlist, head to head |

### 🎯 The Ride Score

One number from 0 to 100 built from new snow, snow quality, wind, visibility and
temperature. It's shared by every view, so the same day can't score 55 in one
tab and 43 in another. (That happened once. It's in the commit history. We
don't talk about it.)

| Score | Verdict |
|---|---|
| 💎 | **Epic Conditions**: send the "I'm sick" email now |
| 🏂 | **Great**: worth the drive |
| 🏔️ | **Fair Groomers**: corduroy and coffee |
| ⚠️ | **Marginal**: good day to wax your board |
| 🧊 | **Poor**: good day to sit in the lodge |

### 🌡️ Conditions that actually matter

- **Today at a glance**: the Ride Score plus the four numbers that decide the
  day (new snow, temperature, gusts, snow line), all above the fold on a phone
- **Snow line**: where the freezing level sits between base and summit. If it's
  in the middle, the top gets powder and the bottom gets a car wash. This is
  the most important number in the Alps and the maritime US ranges.
- **Already fell**: observed snowfall over the past 48 hours. Everything else
  on the page is a forecast; this is the only number that has already happened,
  and a foot that landed yesterday is still on the mountain this morning.
- **Snow forecast**: 24h and 7-day totals with hourly detail, plus a 🚨
  **Powder Alert** at 6"+
- **Model agreement**: two models run on every point, so a total reads as
  `8-14"` when they disagree and as one number when they don't. A single figure
  implies a precision nobody has.
- **Base depth**: settled snow already on the ground
- **Wind & aspect**: which slopes are wind-loaded (deep) and which are scoured
  (firm enough to hear coming)
- **Firn window**: spots the overnight-freeze, daytime-thaw spring corn cycle
  and tells you when to be on it. Too early is ball bearings, too late is
  mashed potatoes.
- **Base ↔ summit toggle**: real elevation-corrected numbers, not the same
  forecast twice
- 🥶 wind chill and frostbite warnings, 💨 wind-hold risk, ☀️ bluebird detector
- 🔬 **Pro View**: every raw number, for people who read avalanche bulletins
  for fun

### 🎫 Pass-aware

Tag your **Ikon** (68 resorts), **Epic** (43) or **Mountain Collective** (16)
pass and the whole app narrows to mountains you can ride without buying another
lift ticket.

### 📍 Near me

One tap ranks resorts by distance. "Nearby" also works as a region in the
planner and comparison, and there's a map with pins coloured by Ride Score. Your
location stays in memory and **never goes into the URL**, so a shared link
doesn't tell your friends where you live.

### 🧰 Everything else

- **📏 Metric or imperial**, defaulting to what the resort's locals use. Every
  view follows the setting, including the ones that used to forget.
- **🔗 Shareable links**: resort, elevation, view and region all live in the
  URL, so back/forward, refresh, bookmarks and the share button just work
- **⭐ Favourites** and auto-refresh that pauses when the tab is hidden
- **📹 Live webcams** for 25 major resorts, and website links for the other 669

## 🌍 Where the data comes from

| Region | Provider | Model |
|---|---|---|
| United States | National Weather Service | NDFD gridpoints |
| French Alps, Pyrenees | Open-Meteo | Météo-France AROME HD (1.5km) |
| Switzerland, Austria, Bavaria, Dolomites | Open-Meteo | DWD ICON-D2 (2km) |
| Japan | Open-Meteo | JMA Seamless (5km) |
| Scandinavia *(forecast-ready, no resorts yet)* | Open-Meteo | MET Norway Nordic (1km) |

The provider is picked automatically from the coordinates. Open-Meteo steps in
if NWS is having a day. Neither needs an API key.

Every Open-Meteo request asks for the **global model alongside the regional
one** and merges them hour by hour, because none of the high-resolution models
is complete. Measured against live responses:

| Model | What it doesn't publish |
|---|---|
| AROME HD | no snowfall, snow depth, freezing level or visibility at all; temperature and wind stop at ~52h |
| ICON-D2 | every field stops at ~49h |
| JMA Seamless | no snow depth, freezing level, wind gusts or precipitation probability |
| MET Norway | no freezing level |

Asking for the regional model alone left the French Alps and the Pyrenees with
no snow forecast and no snow line — the most important number in the range —
and fabricated days 3-7 of the Alpine planner. It failed silently, too:
`sumOver()` drops nulls before reducing, so 168 missing hours summed to a
confident `0"` mid-storm. Coverage now travels with every forecast so the
display layer can tell *missing* from *zero*, and says "—" rather than guessing.

NWS publishes neither snow depth nor history, so both are grafted on from
Open-Meteo into the same hourly grid — one grid, one code path, no chance of the
same number disagreeing with itself across views.

Resort data comes from [OpenSkiMap](https://openskimap.org), an open dataset
built from OpenStreetMap that includes real piste elevations.

## 🚀 Quick start

```bash
nvm use            # Node 22 (see .nvmrc)
yarn install
yarn dev           # → http://localhost:3000
```

`public/resorts.json` is committed, so you only need `yarn build:resorts` if
you want to regenerate it from OpenSkiMap.

Pushing to `main` runs the unit tests, builds the static export and deploys to
GitHub Pages ([deploy.yml](.github/workflows/deploy.yml)).

## 🏗️ Architecture

```
app/                     Next.js App Router (static export)
components/              UI: cards, views, map, planner grid
hooks/
  useForecast.ts         Single + multi-resort fetching, caching, fallback
  usePlanner.ts          Resort × day outlook grid (shares the same cache)
  useGeolocation.tsx     "Near me", held in memory only
  useUrlState.ts         View state ⇄ URL
  useUnits.tsx           Metric/imperial preference
  usePassFilter.ts       "My pass" preference
lib/
  providers/             WeatherProvider implementations + routing
    nws.ts               US National Weather Service
    openMeteo.ts         Global, regional high-res model + global model merge
    supplement.ts        Snow depth and history for providers without them
  types.ts               Resort + the normalized SI forecast model
  conditions.ts          Normalized SI → rider-facing display model
  scoring.ts             The one and only Ride Score
  series.ts              Window reductions, backward windows and coverage
  planner.ts             Multi-day outlook
  lapseRate.ts           Elevation correction, incl. snow phase and density
  nearby.ts              Great-circle distance ranking
  forecastCache.ts       One TTL + LRU cache behind every view
  urlState.ts            URL parse/serialize
  units.ts               Unit-system-aware formatting
  snowVocabulary.ts      Region-specific snow terminology
  passes.ts              Ski pass metadata and filtering
data/passes.json         Ikon / Epic / Mountain Collective rosters
data/webcams.json        Curated webcam overlay
scripts/build-resorts.js Regenerates public/resorts.json from OpenSkiMap
```

### 📐 The normalization rule (learned the hard way)

Every provider's data is converted to **SI as soon as it arrives** (°C, mm,
km/h, m) and converted to display units exactly once, at the edge.

This matters because the providers disagree in ways that fail silently. NWS
reports snowfall in **millimetres**, Open-Meteo in **centimetres**, and snow
depth in **metres**. An earlier version ran NWS millimetres through a
centimetre conversion, overstated every snow total by 10×, and fired Powder
Alerts on 0.6" of snow. Some people probably drove to a mountain over that.
Normalizing once, inside the provider, keeps that class of bug out of the
components.

### 🗄️ One cache, forecasts only

Every view reads the same cache (`lib/forecastCache.ts`), keyed by resort and
elevation — `base`, `summit`, or the `mid` the planner reasons about. It stores
the **normalized forecast only**; conditions and day outlooks are derived on
read.

That is both smaller and more correct. `deriveConditions()` and `buildOutlook()`
anchor every window to `now`, so a stored conditions blob meant a 55-minute-old
entry showed a "next 24 hours" that started 55 minutes ago, and a day grid still
labelled with the day it was built on.

The cache has a TTL, a hard entry cap with oldest-first eviction, and a
quota-exceeded path that evicts and retries. Before, nothing ever removed an
entry: no expiry sweep, no eviction, and each schema bump orphaned the previous
version's entries forever. Entries ran 20-44KB, so a few regions of browsing
filled the quota — after which every write threw into an empty catch and caching
stopped working everywhere, silently and permanently.

### 🏔️ Elevation

A resort's base and summit coordinates are usually a few hundred metres apart,
well inside a single 2.5km NWS grid cell. Palisades Tahoe's base and summit both
resolve to grid `REV 28,94`, so a coordinate-only "dual point" forecast gives
you the same forecast twice.

What actually separates them is **elevation**. Open-Meteo accepts an
`elevation` parameter and downscales properly. NWS can't, so PowderCast applies
a lapse-rate correction and labels that view as modelled.

That correction now covers **snowfall**, not just temperature and wind. NWS
publishes `quantitativePrecipitation` — the liquid equivalent — so the two cases
that actually decide a day can be answered: rain at the base arriving as snow at
the summit, and the reverse, the three-hour drive to ride a Slurpee. Where the
model already forecasts snow its own number is kept and only rescaled for
density; the snow-to-liquid ratio is used to build an amount from scratch only
when the model said rain at its own elevation.

## 🎫 Ski passes

`data/passes.json` holds the Ikon, Epic and Mountain Collective rosters with
access tiers (unlimited / N days / partner).

> ⚠️ **Pass affiliations change every season.** Resorts join, leave and swap
> tiers every year. The file records which season it was verified against, so
> re-check it against [ikonpass.com](https://www.ikonpass.com/en/destinations)
> and [epicpass.com](https://www.epicpass.com) before each winter.

```bash
yarn verify:passes   # exits non-zero if any roster entry matches no resort
```

An unmatched entry usually means the resort is below the size threshold (most
Midwest Epic hills are), its upstream name changed, or it left the pass.

## 📝 Scripts

| Command | Description |
|---|---|
| `yarn dev` | Development server |
| `yarn build` | Static export to `./out` |
| `yarn lint` | ESLint |
| `yarn test` | Unit tests (no network) |
| `yarn test:merge` | Model merging, coverage, snow phase and the graft |
| `yarn test:cache` | Forecast cache eviction and fetch cancellation |
| `yarn test:providers` | Live provider contract tests (hits the network) |
| `yarn build:resorts` | Regenerate `public/resorts.json` from OpenSkiMap |
| `yarn build:resorts --refresh` | Re-download the source dataset first |
| `yarn verify:passes` | Check every pass entry still matches a resort |
| `yarn generate:icons` | Rebuild the favicon and app icons |

## 🧪 Testing

```bash
yarn test              # 176 assertions across 9 suites, no network, ~14s
yarn test:providers    # live contract tests against NWS + Open-Meteo
```

The unit suite runs on synthetic data and a captured NWS gridpoint fixture
(`tests/fixtures/nws-gridpoint-REV-28-94.json`). It covers NWS processing,
scoring, units and the planner, elevation, the resort schema, URL state,
nearby ranking, model merging — coverage, backward windows, snow phase across
elevation, model spread and the snow-depth graft — and the fetch and cache
layer: eviction, quota recovery and request cancellation.

**Every case corresponds to a bug that actually shipped.** If a test fails,
add a case rather than loosening the existing one.

## 🗺️ Adding a country

The forecast layer is already global. Adding a country (say, Norway, whose
weather model is already wired up) takes two lines in
`scripts/build-resorts.js`:

```js
const COUNTRIES = {
  // ...
  NO: { regionCode: 'scandinavia', timezone: 'Europe/Oslo' },
};
```

Then run `yarn build:resorts`. If the country needs a new tab, add it to
`REGIONS` in `lib/regions.ts` (`scandinavia` and `canada` are already there),
and add a high-resolution model to `REGIONAL_MODELS` in
`lib/providers/openMeteo.ts` if one covers the area.

## 📚 More docs

Deeper notes are in [`docs/`](docs/), including the [Pro View](docs/PRO_VIEW.md),
[debugging tips](docs/DEBUGGING.md) and the
[snow accumulation bug post-mortem](docs/BUG_FIX_SNOW_ACCUMULATION.md).

## 📄 License & fine print

Educational project. Weather data: NOAA/NWS (public domain) and
[Open-Meteo](https://open-meteo.com) (CC BY 4.0). Resort data:
[OpenSkiMap](https://openskimap.org) / OpenStreetMap contributors (ODbL).
Map tiles: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

> 🏔️ **Not a substitute for official avalanche bulletins or resort snow
> reports.** PowderCast can tell you it's a powder day. It can't tell you a
> slope is safe. Check the avalanche forecast, carry the gear and ride with
> friends.

---

<p align="center">
  Made with ❄️ and too much coffee by <a href="https://greenido.wordpress.com">@greenido</a><br/>
  <sub>If PowderCast finds you a powder day, the first chair is on you.</sub>
</p>
