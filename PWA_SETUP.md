# PWA Installation Setup

## Overview
PowderCast now supports Progressive Web App (PWA) installation on mobile devices, allowing users to install the app on their iPhone or Android device and use it like a native app.

## What Was Implemented

### 1. PWA Manifest (`public/manifest.json`)
- App name, description, and branding colors
- Icons in multiple sizes (72x72 to 512x512)
- Display mode set to "standalone" for full-screen app experience
- Theme color matching the app's design (#0ea5e9)

### 2. PWA Icons
Generated PWA icons in all required sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Apple touch icon (180x180)
- All icons have a slate-950 background matching the app theme

**To regenerate icons:**
```bash
yarn generate:pwa-icons
```

### 3. InstallPWA Component (`components/InstallPWA.tsx`)
A smart install prompt that:
- Detects if user is on mobile (iOS or Android)
- Checks if app is already installed
- Auto-dismisses if user dismissed it in the last 7 days
- Shows after 3 seconds on the page
- Provides platform-specific installation instructions

**iOS Installation:**
1. Tap Share button (square with arrow) at bottom of Safari
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add" in the top right corner

**Android Installation:**
- If browser supports it: Shows native install button
- Otherwise: Manual instructions for Chrome

### 4. Layout Updates (`app/layout.tsx`)
Added PWA meta tags:
- Manifest link
- Theme color
- Apple web app capabilities
- All necessary icons referenced

### 5. CSS Animation (`app/globals.css`)
Added slide-up animation for the install prompt

## Features

✅ **Smart Prompting**
- Only shows on mobile devices
- Respects user dismissal (7-day cooldown)
- Detects if already installed

✅ **Platform-Specific Instructions**
- iOS: Step-by-step Safari instructions
- Android: Native install prompt or manual instructions

✅ **Offline-Ready Icons**
- All required sizes for different devices
- Optimized PNG files with proper backgrounds

✅ **Full App Experience**
- Standalone display mode (no browser UI)
- Custom theme color
- Proper app name and branding

## Testing

### On iOS (iPhone/iPad)
1. Open the app in Safari
2. Wait for the install prompt (appears after 3 seconds)
3. Follow the iOS-specific instructions
4. App will appear on home screen

### On Android
1. Open the app in Chrome
2. Wait for the install prompt
3. Click "Install Now" button (if supported)
4. Or follow manual instructions
5. App will appear in app drawer

### Testing as Standalone
After installation, the app should:
- Open in full-screen mode (no browser UI)
- Have its own icon on home screen/app drawer
- Appear in recent apps as a separate app
- Load faster on subsequent visits

## User Experience

When a mobile user visits PowderCast:
1. They browse the weather data normally
2. After 3 seconds, a bottom banner slides up
3. The banner shows installation instructions for their platform
4. They can dismiss it (won't show again for 7 days)
5. Or they can follow the instructions to install

Benefits for users:
- **Faster loading** - App loads instantly from home screen
- **Full-screen experience** - No browser UI
- **Offline access** - App shell loads even without internet
- **Native feel** - Appears in app switcher like a real app

## Technical Details

### Browser Support
- **iOS**: Safari 11.3+ (Manual installation)
- **Android**: Chrome 76+, Edge 79+, Samsung Internet 11.2+
- **Desktop**: Chrome 76+, Edge 79+ (install from address bar)

### Storage
Install prompt dismissal is stored in localStorage:
```javascript
localStorage.getItem('pwa-install-dismissed')
```

### Events
The component listens for the `beforeinstallprompt` event (Android/Chrome) to provide native installation.

## Future Enhancements

Potential improvements:
- [ ] Service worker for offline functionality
- [ ] Push notifications for powder alerts
- [ ] Background sync for weather updates
- [ ] App shortcuts for favorite resorts
- [ ] Screenshots in manifest

## Files Modified/Created

- ✅ `public/manifest.json` - PWA manifest
- ✅ `public/icon-*.png` - PWA icons (9 files)
- ✅ `components/InstallPWA.tsx` - Install prompt component
- ✅ `app/layout.tsx` - Added PWA meta tags
- ✅ `app/page.tsx` - Added InstallPWA component
- ✅ `app/globals.css` - Added slide-up animation
- ✅ `scripts/generate-pwa-icons.js` - Icon generation script
- ✅ `package.json` - Added sharp dependency and script

## Maintenance

### Updating Icons
If the logo changes, regenerate all icons:
```bash
yarn generate:pwa-icons
```

### Updating Manifest
Edit `public/manifest.json` to change:
- App name/description
- Theme colors
- Icon references
- Start URL

### Adjusting Prompt Timing
In `components/InstallPWA.tsx`, modify:
- Delay: Change `setTimeout(..., 3000)` for different timing
- Cooldown: Change `daysSinceDismissed > 7` for longer/shorter dismissal period
