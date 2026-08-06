# 🏂 PowderCast v2.0

<p align="center">
  <img src="./public/logo.svg" alt="PowderCast Logo" width="200" height="200"/>
</p>

**Mountain weather for snowboarders and skiers — worldwide.**

🚀 Try it: [PowderCast](https://greenido.github.io/PowderCast/)

Hyper-local forecasts for **722 resorts** across the US, Alps, Dolomites,
Pyrenees and Japan, with ski-pass awareness so you only see mountains you can
actually ride.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=for-the-badge&logo=tailwind-css)

## ✨ Features

### Planning
- **🗓️ 7-Day Planner** — every resort in a region × every day, ranked, so the
  best mountain *and* the best day are visible at once
- **🎫 Pass filter** — tag your Ikon / Epic / Mountain Collective pass and the
  whole app narrows to resorts it covers
- **📊 Region comparison** — side-by-side conditions and Ride Scores

### Conditions
- **🌡️ Snow line** — where the freezing level sits relative to base and summit,
  i.e. whether it's raining at the bottom. The most important number in the
  Alps and the maritime US ranges.
- **❄️ Snow forecast** — 24h / 7-day accumulation with hourly detail
- **🏔️ Base depth** — settled snow already on the ground
- **💨 Wind & aspect** — which aspects are wind-loaded (deep) and which are
  scoured (firm)
- **🎿 Snow quality** — regionally named: Pulverschnee / Sulz in the Alps,
  JaPow in Japan, Sierra Cement in Tahoe
- **🌽 Firn window** — detects the overnight-freeze → daytime-thaw spring corn
  cycle and tells you when to be on it
- **🥶 Wind chill & frostbite warnings**, **💨 wind-hold risk**, **☀️ bluebird**

### Everything else
- **📏 Metric or imperial**, defaulting to the resort's local convention
- **📱 PWA** — installable, works offline against cached conditions
- **⭐ Favourites** and visibility-aware auto-refresh

## 🌍 Data sources

| Region | Provider | Model |
|---|---|---|
| United States | National Weather Service | NDFD gridpoints |
| French Alps, Pyrenees | Open-Meteo | Météo-France AROME (1.5km) |
| Switzerland, Austria, Dolomites | Open-Meteo | DWD ICON-D2 (2km) |
| Japan | Open-Meteo | JMA Seamless (5km) |
| Scandinavia | Open-Meteo | MET Norway Nordic (1km) |

Provider selection is automatic by coordinate, with Open-Meteo as the fallback
if NWS is unavailable. Neither provider needs an API key, so the app remains a
pure static deployment.

Resort data comes from [OpenSkiMap](https://openskimap.org), an OpenStreetMap
-derived open dataset which supplies real min/max piste elevations.

## 🚀 Quick start

```bash
nvm use
yarn install
yarn build:resorts
yarn dev
```

Available at **http://localhost:3000**.

## 🏗️ Architecture

```
app/                     Next.js App Router
components/              UI
hooks/
  useForecast.ts         Single + multi-resort fetching, caching, fallback
  usePlanner.ts          Resort × day outlook grid
  useUnits.tsx           Metric/imperial preference
  usePassFilter.ts       "My pass" preference
lib/
  providers/             WeatherProvider implementations + routing
    nws.ts               US National Weather Service
    openMeteo.ts         Global, with regional high-res model selection
  types.ts               Resort + the normalized SI forecast model
  conditions.ts          Normalized SI → rider-facing display model
  series.ts              Window reductions over the hourly series
  planner.ts             Multi-day scoring
  lapseRate.ts           Elevation correction for providers that need it
  units.ts               Unit-system-aware formatting
  snowVocabulary.ts      Region-specific snow terminology
  passes.ts              Ski pass metadata and filtering
data/passes.json         Ikon / Epic / Mountain Collective rosters
scripts/build-resorts.js Regenerates public/resorts.json from OpenSkiMap
```

### The normalization rule

Every provider is converted to **SI immediately on arrival** — °C, mm, km/h, m
— and converted to the display system exactly once, at the edge.

This is not stylistic. Providers disagree in exactly the way that causes silent
bugs: NWS reports snowfall in **millimetres**, Open-Meteo in **centimetres**,
and snow depth in **metres**. An earlier version ran NWS millimetres through a
centimetre conversion and overstated every snow total by 10×, firing Powder
Alerts on 0.6" of snow. Normalizing once, in the provider, is what prevents
that class of error from reaching a component.

### Elevation

A resort's base and summit coordinates sit a few hundred metres apart — well
inside a single NWS 2.5km grid cell. Palisades Tahoe's base and summit both
resolve to grid `REV 28,94`, so a coordinate-only "dual point" forecast is
the same forecast twice.

What actually separates them is **elevation**. Open-Meteo accepts an
`elevation` parameter and downscales properly; NWS cannot, so a lapse-rate
correction is applied and the UI labels that view as modelled.

## 🎫 Ski passes

`data/passes.json` carries the Ikon, Epic and Mountain Collective rosters with
access tiers (unlimited / N days / partner).

> **Pass affiliations change every season.** Resorts join, leave and move
> between tiers annually. The file records the season it was verified against —
> re-check it against [ikonpass.com](https://www.ikonpass.com/en/destinations)
> and [epicpass.com](https://www.epicpass.com) before each winter.

```bash
yarn verify:passes   # exits non-zero if any roster entry matches no resort
```

Unmatched entries usually mean one of: the resort is below the size threshold
(most Midwest Epic hills are), its upstream name changed, or it left the pass.

## 📝 Scripts

| Command | Description |
|---|---|
| `yarn dev` | Development server |
| `yarn build` | Static export to `./out` |
| `yarn test` | Unit tests (no network) |
| `yarn test:providers` | Live provider contract tests (hits the network) |
| `yarn build:resorts` | Regenerate `public/resorts.json` from OpenSkiMap |
| `yarn build:resorts --refresh` | Re-download the source dataset first |
| `yarn verify:passes` | Check every pass entry still matches a resort |

## 🧪 Testing

```bash
yarn test              # 100 assertions, no network
yarn test:providers    # live contract tests against NWS + Open-Meteo
```

The unit suite runs against synthetic data and a captured NWS gridpoint
fixture. Every case corresponds to a bug that actually shipped, so prefer
adding a case over loosening one.

## 🗺️ Extending coverage

The forecast layer is already global — adding a country is a two-line change
in `scripts/build-resorts.js`:

```js
const COUNTRIES = {
  NO: { regionCode: 'scandinavia', timezone: 'Europe/Oslo' },
};
```

Then `yarn build:resorts`. Add a matching entry to `REGIONS` in
`lib/regions.ts` if it needs its own tab, and a regional model to
`REGIONAL_MODELS` in `lib/providers/openMeteo.ts` if a high-resolution one
exists for the area.

## 📄 License

Educational project. Weather data: NOAA/NWS (public domain) and
[Open-Meteo](https://open-meteo.com) (CC BY 4.0). Resort data:
[OpenSkiMap](https://openskimap.org) / OpenStreetMap contributors (ODbL).

Not a substitute for official avalanche bulletins or resort snow reports.

---

<p align="center">
  Made by <a href="https://greenido.wordpress.com">@greenido</a>
</p>
