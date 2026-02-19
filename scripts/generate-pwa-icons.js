/**
 * Generate PWA icons from SVG logo
 * Run with: node scripts/generate-pwa-icons.js
 * 
 * Prerequisites: yarn add -D sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = path.join(__dirname, '../public/logo.svg');
const outputDir = path.join(__dirname, '../public');

async function generateIcons() {
  console.log('🎨 Generating PWA icons...');
  
  // Check if input file exists
  if (!fs.existsSync(inputSvg)) {
    console.error('❌ Error: logo.svg not found in public folder');
    process.exit(1);
  }

  try {
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
      
      await sharp(inputSvg)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 15, g: 23, b: 42, alpha: 1 } // slate-950
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ${size}x${size} icon`);
    }

    // Generate apple-touch-icon
    const appleTouchIcon = path.join(outputDir, 'apple-touch-icon.png');
    await sharp(inputSvg)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 15, g: 23, b: 42, alpha: 1 }
      })
      .png()
      .toFile(appleTouchIcon);
    
    console.log('✅ Generated apple-touch-icon.png');
    console.log('🎉 All PWA icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
