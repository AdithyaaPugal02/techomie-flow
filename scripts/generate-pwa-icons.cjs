const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Techomie SVG mark
const svgContent = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#0B111E" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
  </defs>
  <!-- Background subtle glow -->
  <rect width="512" height="512" fill="#0B111E"/>
  <circle cx="256" cy="256" r="230" fill="url(#glow)"/>

  <!-- Centered geometric shapes scaled to 256x256 inside 512x512 -->
  <g transform="translate(100, 100) scale(13)">
    <path d="M22 19.2727C22 20.779 20.779 22 19.2727 22H14.7273C13.221 22 12 20.779 12 19.2727V12H19.2727C20.779 12 22 13.221 22 14.7273V19.2727Z" fill="#38BDF8"/>
    <path d="M20 2C21.1046 2 22 2.89543 22 4V7C22 8.10457 21.1046 9 20 9H17C15.8954 9 15 8.10457 15 7V4C15 2.89543 15.8954 2 17 2H20Z" fill="#0284C7"/>
    <path d="M7 15C8.10457 15 9 15.8954 9 17V20C9 21.1046 8.10457 22 7 22H4C2.89543 22 2 21.1046 2 20V17C2 15.8954 2.89543 15 4 15H7Z" fill="#0284C7"/>
    <path d="M12 12H4.72727C3.22104 12 2 10.779 2 9.27273V4.72727C2 3.22104 3.22104 2 4.72727 2H9.27273C10.779 2 12 3.22104 12 4.72727V12Z" fill="#0EA5E9"/>
  </g>
</svg>
`;

async function generate() {
  const baseBuffer = Buffer.from(svgContent);

  const targets = [
    { size: 512, file: 'icon-512x512.png' },
    { size: 192, file: 'icon-192x192.png' },
    { size: 180, file: 'apple-touch-icon.png' },
    { size: 144, file: 'icon-144x144.png' },
    { size: 96, file: 'icon-96x96.png' },
    { size: 512, file: 'icon-maskable-512x512.png' },
  ];

  for (const t of targets) {
    const dest = path.join(iconsDir, t.file);
    await sharp(baseBuffer)
      .resize(t.size, t.size)
      .png()
      .toFile(dest);
    console.log(`Generated: ${t.file} (${t.size}x${t.size})`);
  }
}

generate().catch(console.error);
