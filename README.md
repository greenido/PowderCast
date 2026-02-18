# 🏂 PowderCast v1.1

**The Ultimate Snowboarder's Weather Dashboard**

A high-performance web application for US-based snowboarders that leverages the National Weather Service (NWS) API to deliver hyper-local mountain weather data.

![PowderCast Banner](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=for-the-badge&logo=tailwind-css)

## ✨ Features

### Core Functionality

- **🔍 Smart Autocomplete Search**: Search across 22+ major US ski resorts with instant results
- **🏔️ Dual-Point Forecasting**: Toggle between base and summit weather conditions
- **📊 The "Big Three" Metrics**:
  - 🌨️ Snow Accumulation (24h & 7-day totals)
  - 💨 Wind Gusts (with lift closure warnings)
  - 👁️ Visibility & Cloud Cover

### Advanced Rider Intelligence

| Feature | Description |
|---------|-------------|
| ❄️ **Powder Alert** | Triggered when 6"+ of snow in 24 hours |
| ☀️ **Bluebird Indicator** | Clear skies (<25% cloud) + calm winds (<15 mph) |
| 🏂 **Snow Quality** | Predicts "Champagne Powder", "Sierra Cement", "Ice Coast", etc. |
| 🥶 **Frostbite Warning** | Wind chill alerts with safety recommendations |
| 📹 **Live Webcams** | Direct links to resort camera feeds |

### Snow Quality Logic

Temperature-based snow quality predictions:

- **< 15°F**: Champagne Powder ❄️ (Ultra light/dry)
- **15°F - 26°F**: Premium Packed 🏂 (Standard dry snow)
- **27°F - 34°F**: Sierra Cement 💪 (Heavy, wet, great for jumps)
- **> 34°F**: Mashtatoes/Slush ☀️ (Spring conditions)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and Yarn
- macOS/Linux (or Windows with WSL)

### Installation

```bash
# Navigate to project directory
cd /Applications/MAMP/htdocs/weather-snow-1

# Install dependencies
yarn install

# Setup database
yarn db:setup

# Seed resort data (22 major US resorts)
yarn db:seed

# Start development server
yarn dev
```

The app will be available at **http://localhost:3000**

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling with glassmorphism |
| **Headless UI** | Accessible autocomplete component |
| **better-sqlite3** | Local SQLite database for resorts |
| **NWS API** | Free, official US weather data |

## 📁 Project Structure

```
/weather-snow-1
├── app/
│   ├── api/
│   │   ├── weather/route.ts        # NWS API proxy
│   │   └── resorts/route.ts        # Resort search API
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Main dashboard
│   └── globals.css                 # Tailwind + custom styles
├── components/
│   ├── SearchBar.tsx               # Autocomplete search
│   ├── ElevationToggle.tsx         # Base/Summit switch
│   ├── SnowAccumulationCard.tsx    # Snow metrics
│   ├── WindGustsCard.tsx           # Wind data & warnings
│   ├── VisibilityCard.tsx          # Visibility & cloud cover
│   ├── SnowQualityTag.tsx          # Quality prediction
│   ├── PowderAlert.tsx             # 6"+ snow badge
│   ├── BluebirdIndicator.tsx       # Perfect day banner
│   ├── FrostbiteWarning.tsx        # Cold weather alerts
│   └── WebcamViewer.tsx            # Webcam links
├── hooks/
│   ├── useNWSWeather.ts            # Main weather hook
│   └── useResortSearch.ts          # Search functionality
├── lib/
│   ├── database.ts                 # SQLite integration
│   ├── nwsTypes.ts                 # TypeScript interfaces
│   ├── unitConversion.ts           # Metric ↔ Imperial
│   └── snowLogic.ts                # Quality calculations
├── scripts/
│   ├── setup-db.js                 # Database initialization
│   └── seed-db.js                  # Resort data seeding
└── powdercast.db                   # SQLite database
```

## 🏔️ Included Resorts

**California** (Tahoe & Mammoth)
- Palisades Tahoe, Northstar, Heavenly, Kirkwood, Mammoth Mountain

**Colorado** (Summit County & Aspen)
- Vail, Breckenridge, Keystone, A-Basin, Copper Mountain, Aspen Snowmass

**Utah** (Park City & Wasatch)
- Park City, Deer Valley, Alta, Snowbird

**Wyoming**
- Jackson Hole

**Montana**
- Big Sky

**Vermont**
- Killington, Stowe

**New Hampshire**
- Bretton Woods

**Washington**
- Stevens Pass, Crystal Mountain

## 🌐 API Usage

### Weather Endpoint
```typescript
GET /api/weather?lat=39.27&lon=-120.12
```

### Resort Search
```typescript
GET /api/resorts?q=Northstar  // Search by name
GET /api/resorts?id=northstar-ca  // Get by ID
GET /api/resorts  // Get all resorts
```

## 🎨 Design System

### Colors
```javascript
mountain: {
  navy: '#0F172A',      // Background
  ice: '#22D3EE',       // Primary (cyan-400)
  powder: '#FFFFFF',    // Text
  danger: '#EF4444',    // Wind alerts
  warning: '#F59E0B',   // Caution
  success: '#10B981'    // Good conditions
}
```

### Glassmorphism Classes
```css
.glass-card {
  @apply bg-white/10 backdrop-blur-md border border-white/20 rounded-xl;
}
```

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server |
| `yarn build` | Build for production |
| `yarn start` | Start production server |
| `yarn lint` | Run ESLint |
| `yarn db:setup` | Initialize database |
| `yarn db:seed` | Seed resort data |

## 🔧 Configuration

### Environment Variables (Optional)
Create `.env.local` for custom configuration:

```env
# No API keys needed - NWS is free!
NEXT_PUBLIC_APP_NAME=PowderCast
```

## 📱 Features by Priority

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | NWS API Integration | ✅ Complete |
| P0 | Resort Database (SQLite) | ✅ Complete |
| P0 | Smart Search | ✅ Complete |
| P0 | Base/Summit Toggle | ✅ Complete |
| P0 | Big Three Metrics | ✅ Complete |
| P1 | Snow Quality Logic | ✅ Complete |
| P1 | Powder Alert | ✅ Complete |
| P1 | Wind/Frostbite Warnings | ✅ Complete |
| P1 | Bluebird Indicator | ✅ Complete |
| P1 | Webcams | ✅ Complete |
| P2 | Offline Caching | ✅ Complete |
| P2 | 7-Day Forecast | ✅ Complete |

## 🚧 Non-Functional Requirements

- **Offline Support**: LocalStorage caching (1-hour validity)
- **Accessibility**: ARIA labels, high-contrast mode
- **Performance**: <2s initial load, <500ms API response
- **Mobile-First**: Responsive design for all screen sizes

## 🐛 Troubleshooting

### Database Issues
```bash
# Reset database
rm powdercast.db
yarn db:setup
yarn db:seed
```

### NWS API Errors
- Check internet connection
- NWS has rate limits (be reasonable)
- Some locations may not have grid data

### TypeScript Errors
```bash
# Rebuild type definitions
yarn build
```

## 📄 License

This project is for educational purposes. Weather data provided by the National Weather Service (public domain).

## 🙏 Acknowledgments

- **National Weather Service**: Free, reliable weather API
- **US Ski Resorts**: For inspiring this project
- **Snowboarders Everywhere**: Keep shredding! 🏂

---

**Built with ❄️ by riders, for riders.**

*PowderCast v1.1 - Because every startup gets one miracle, and it's not the UI stack.*
