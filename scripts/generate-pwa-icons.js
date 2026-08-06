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

    await generateFavicon();

    console.log('🎉 All PWA icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

/**
 * Write a real favicon.ico.
 *
 * The previous public/favicon.ico was an 11-byte text file containing the
 * literal string "favicon.ico", so every browser that requested it logged a
 * decode failure.
 *
 * The ICO container permits a PNG payload, which is all modern browsers need,
 * so we wrap a 32x32 PNG in a minimal one-entry ICONDIR rather than pulling in
 * a dedicated encoder.
 */
async function generateFavicon() {
  const png = await sharp(inputSvg)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    })
    .png()
    .toBuffer();

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width
  entry.writeUInt8(32, 1); // height
  entry.writeUInt8(0, 2); // palette size (0 = no palette)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // payload size
  entry.writeUInt32LE(header.length + entry.length, 12); // payload offset

  fs.writeFileSync(
    path.join(outputDir, 'favicon.ico'),
    Buffer.concat([header, entry, png])
  );

  console.log(`✅ Generated favicon.ico (${png.length + 22} bytes)`);
}

generateIcons();
