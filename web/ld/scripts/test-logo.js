import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// SVG generator matching Logo 2.jpeg exactly
function createLogoOfficialSvg({ width = 1024, height = 1024, transparent = false } = {}) {
  const bgFill = transparent ? 'none' : '#0D0A18';

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${width}" height="${height}">
    <defs>
      <!-- Neon Linear Gradient across the Heart & Dumbbell -->
      <linearGradient id="neonGradient" x1="20%" y1="10%" x2="80%" y2="90%">
        <stop offset="0%" stop-color="#F472B6" />
        <stop offset="35%" stop-color="#E879F9" />
        <stop offset="65%" stop-color="#A855F7" />
        <stop offset="100%" stop-color="#6366F1" />
      </linearGradient>

      <!-- Neon Gradient for Text Accent (Base) -->
      <linearGradient id="textNeon" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#C084FC" />
        <stop offset="100%" stop-color="#A855F7" />
      </linearGradient>

      <!-- Multi-tier Neon Glow Filters -->
      <filter id="neonBloom" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur3" />
        <feMerge>
          <feMergeNode in="blur1" />
          <feMergeNode in="blur2" />
          <feMergeNode in="blur3" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="textGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="sparkleGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    ${!transparent ? `<rect width="1024" height="1024" fill="${bgFill}" />` : ''}

    <!-- SPARKLE (Bottom Right Corner as in Logo 2.jpeg) -->
    <g transform="translate(900, 890)" filter="url(#sparkleGlow)" opacity="0.6">
      <path d="M 0,-24 Q 0,0 24,0 Q 0,0 0,24 Q 0,0 -24,0 Q 0,0 0,-24 Z" fill="#7C5D9F" />
      <circle cx="0" cy="0" r="3" fill="#E9D5FF" />
    </g>

    <!-- ICON GROUP (Heart + Leaves + Dumbbell) -->
    <g transform="translate(70, 160) scale(1.15)">
      <!-- Transform container centered around (240, 280) with slight clockwise tilt ~8-10deg -->
      <g transform="rotate(8, 220, 260)">

        <!-- ============================================ -->
        <!-- 1. WIDE NEON AURA (Deep atmospheric glow)     -->
        <!-- ============================================ -->
        <g stroke="url(#neonGradient)" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.45" filter="url(#neonBloom)">
          <!-- Heart outline -->
          <path d="M 185 170 C 185 170 145 125 90 135 C 30 145 15 210 35 270 C 45 300 70 340 100 375 L 175 445 L 210 405" stroke-width="26" />
          
          <!-- Leaf on right side -->
          <path d="M 185 170 C 185 170 215 130 255 130 C 275 130 300 115 320 85 C 320 130 310 180 270 230 C 245 260 220 300 190 350" stroke-width="26" />
          <path d="M 255 130 C 280 150 295 185 290 220" stroke-width="22" />
          <!-- Leaf inner vein -->
          <path d="M 230 185 Q 275 140 310 95" stroke-width="14" />

          <!-- Heart bottom V tip -->
          <path d="M 120 400 L 175 455 L 220 395" stroke-width="26" />

          <!-- Dumbbell Bar -->
          <line x1="85" y1="315" x2="255" y2="350" stroke-width="28" />

          <!-- Left Dumbbell Weights -->
          <!-- Inner collar -->
          <rect x="75" y="275" width="20" height="80" rx="9" transform="rotate(13, 85, 315)" stroke-width="24" />
          <!-- Outer plate -->
          <rect x="42" y="255" width="24" height="118" rx="12" transform="rotate(13, 54, 314)" stroke-width="24" />

          <!-- Right Dumbbell Weights -->
          <!-- Inner collar -->
          <rect x="245" y="310" width="20" height="80" rx="9" transform="rotate(13, 255, 350)" stroke-width="24" />
          <!-- Outer plate -->
          <rect x="275" y="290" width="24" height="118" rx="12" transform="rotate(13, 287, 349)" stroke-width="24" />
        </g>

        <!-- ============================================ -->
        <!-- 2. SHARP VIVID NEON TUBE (Gradient Body)     -->
        <!-- ============================================ -->
        <g stroke="url(#neonGradient)" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <!-- Heart outline left side -->
          <path d="M 185 170 C 185 170 145 125 90 135 C 30 145 15 210 35 270 C 45 300 70 340 100 375 L 175 445 L 210 405" stroke-width="16" />
          
          <!-- Leaf on right side -->
          <path d="M 185 170 C 185 170 215 130 255 130 C 275 130 300 115 320 85 C 320 130 310 180 270 230 C 245 260 220 300 190 350" stroke-width="16" />
          <path d="M 255 130 C 280 150 295 185 290 220" stroke-width="14" />
          <!-- Leaf inner vein -->
          <path d="M 230 185 Q 275 140 310 95" stroke-width="10" />

          <!-- Heart bottom V tip -->
          <path d="M 120 400 L 175 455 L 220 395" stroke-width="16" />

          <!-- Dumbbell Bar -->
          <line x1="85" y1="315" x2="255" y2="350" stroke-width="18" />

          <!-- Left Dumbbell Weights -->
          <rect x="75" y="275" width="20" height="80" rx="9" transform="rotate(13, 85, 315)" stroke-width="16" fill="#0D0A18" />
          <rect x="42" y="255" width="24" height="118" rx="12" transform="rotate(13, 54, 314)" stroke-width="16" fill="#0D0A18" />

          <!-- Right Dumbbell Weights -->
          <rect x="245" y="310" width="20" height="80" rx="9" transform="rotate(13, 255, 350)" stroke-width="16" fill="#0D0A18" />
          <rect x="275" y="290" width="24" height="118" rx="12" transform="rotate(13, 287, 349)" stroke-width="16" fill="#0D0A18" />
        </g>

        <!-- ============================================ -->
        <!-- 3. INNER WHITE NEON CORE (Luminous center)   -->
        <!-- ============================================ -->
        <g stroke="#FFFFFF" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
          <!-- Heart outline left side -->
          <path d="M 185 170 C 185 170 145 125 90 135 C 30 145 15 210 35 270 C 45 300 70 340 100 375 L 175 445 L 210 405" stroke-width="5" />
          
          <!-- Leaf on right side -->
          <path d="M 185 170 C 185 170 215 130 255 130 C 275 130 300 115 320 85 C 320 130 310 180 270 230 C 245 260 220 300 190 350" stroke-width="5" />
          <path d="M 255 130 C 280 150 295 185 290 220" stroke-width="4" />
          <!-- Leaf inner vein -->
          <path d="M 230 185 Q 275 140 310 95" stroke-width="3" />

          <!-- Heart bottom V tip -->
          <path d="M 120 400 L 175 455 L 220 395" stroke-width="5" />

          <!-- Dumbbell Bar -->
          <line x1="85" y1="315" x2="255" y2="350" stroke-width="6" />

          <!-- Left Dumbbell Weights -->
          <rect x="75" y="275" width="20" height="80" rx="9" transform="rotate(13, 85, 315)" stroke-width="4.5" />
          <rect x="42" y="255" width="24" height="118" rx="12" transform="rotate(13, 54, 314)" stroke-width="4.5" />

          <!-- Right Dumbbell Weights -->
          <rect x="245" y="310" width="20" height="80" rx="9" transform="rotate(13, 255, 350)" stroke-width="4.5" />
          <rect x="275" y="290" width="24" height="118" rx="12" transform="rotate(13, 287, 349)" stroke-width="4.5" />
        </g>

      </g>
    </g>

    <!-- WORDMARK TYPOGRAPHY ("NutriiBase") -->
    <!-- Positioned to the right of the icon, vertically centered around y = 515 -->
    <g transform="translate(435, 545)">
      <!-- Ambient Text Glow for "Base" -->
      <text x="248" y="0" font-family="'Inter', -apple-system, system-ui, sans-serif" font-weight="700" font-size="108" fill="url(#textNeon)" letter-spacing="-1.5" filter="url(#textGlow)" opacity="0.75">
        Base
      </text>

      <!-- Main crisp text -->
      <text x="0" y="0" font-family="'Inter', -apple-system, system-ui, sans-serif" font-weight="700" font-size="108" letter-spacing="-1.5">
        <tspan fill="#FFFFFF">Nutrii</tspan><tspan fill="url(#textNeon)">Base</tspan>
      </text>
    </g>
  </svg>
  `;
}

async function test() {
  const svg = createLogoOfficialSvg({ width: 1024, height: 1024, transparent: false });
  await sharp(Buffer.from(svg)).png().toFile('test_logo.png');
  console.log('test_logo.png written successfully');
}

test();
