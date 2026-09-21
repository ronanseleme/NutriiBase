import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateAssets() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Common SVG definitions for Neon Effects
  const neonDefs = `
    <defs>
      <!-- Gradient for Neon Heart + Leaf + Dumbbell -->
      <linearGradient id="neonGradient" x1="15%" y1="10%" x2="85%" y2="90%">
        <stop offset="0%" stop-color="#FF6EB4" />
        <stop offset="30%" stop-color="#E879F9" />
        <stop offset="65%" stop-color="#A855F7" />
        <stop offset="100%" stop-color="#6366F1" />
      </linearGradient>

      <!-- Gradient for 'Base' text accent -->
      <linearGradient id="textNeonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#C084FC" />
        <stop offset="100%" stop-color="#A855F7" />
      </linearGradient>

      <!-- Atmospheric Neon Bloom Filter -->
      <filter id="neonGlowWide" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="14" result="blurWide" />
        <feGaussianBlur stdDeviation="6" result="blurMid" />
        <feMerge>
          <feMergeNode in="blurWide" />
          <feMergeNode in="blurMid" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <!-- Text Subtle Bloom -->
      <filter id="textGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="sparkleFilter" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  `;

  // Reusable Icon Vector Components (Heart + Leaf + Dumbbell)
  // Master icon designed in a 360 x 360 coordinate space
  function renderIconElements(options = { bgFill: 'none', isDarkBg: true }) {
    const innerFill = options.isDarkBg ? '#0D0A18' : 'none';

    return `
    <g transform="rotate(10, 180, 180)">
      <!-- 1. DEEP NEON GLOW PASS (Aura) -->
      <g stroke="url(#neonGradient)" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.45" filter="url(#neonGlowWide)">
        <!-- Heart left lobe & flank -->
        <path d="M 170 145 C 170 145 130 100 80 110 C 25 120 10 180 30 240 C 40 270 65 310 95 345 L 165 415 L 195 375" stroke-width="26" />
        
        <!-- Right side: Leaf & outer contour -->
        <path d="M 170 145 C 170 145 205 105 245 105 C 265 105 290 85 310 55 C 310 100 300 150 260 200 C 235 230 210 270 180 320" stroke-width="26" />
        <path d="M 245 105 C 270 125 285 160 280 195" stroke-width="22" />
        <!-- Leaf inner vein -->
        <path d="M 220 160 Q 265 115 300 70" stroke-width="14" />

        <!-- Heart bottom V tip -->
        <path d="M 115 370 L 165 425 L 205 365" stroke-width="26" />

        <!-- Dumbbell Bar -->
        <line x1="80" y1="285" x2="245" y2="320" stroke-width="28" />

        <!-- Left Dumbbell Plates -->
        <rect x="70" y="245" width="20" height="80" rx="9" transform="rotate(13, 80, 285)" stroke-width="24" />
        <rect x="38" y="225" width="24" height="118" rx="12" transform="rotate(13, 50, 284)" stroke-width="24" />

        <!-- Right Dumbbell Plates -->
        <rect x="235" y="280" width="20" height="80" rx="9" transform="rotate(13, 245, 320)" stroke-width="24" />
        <rect x="265" y="260" width="24" height="118" rx="12" transform="rotate(13, 277, 319)" stroke-width="24" />
      </g>

      <!-- 2. SHARP VIVID NEON TUBE PASS -->
      <g stroke="url(#neonGradient)" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <!-- Heart left lobe & flank -->
        <path d="M 170 145 C 170 145 130 100 80 110 C 25 120 10 180 30 240 C 40 270 65 310 95 345 L 165 415 L 195 375" stroke-width="16" />
        
        <!-- Right side: Leaf & outer contour -->
        <path d="M 170 145 C 170 145 205 105 245 105 C 265 105 290 85 310 55 C 310 100 300 150 260 200 C 235 230 210 270 180 320" stroke-width="16" />
        <path d="M 245 105 C 270 125 285 160 280 195" stroke-width="14" />
        <!-- Leaf inner vein -->
        <path d="M 220 160 Q 265 115 300 70" stroke-width="10" />

        <!-- Heart bottom V tip -->
        <path d="M 115 370 L 165 425 L 205 365" stroke-width="16" />

        <!-- Dumbbell Bar -->
        <line x1="80" y1="285" x2="245" y2="320" stroke-width="18" />

        <!-- Left Dumbbell Plates -->
        <rect x="70" y="245" width="20" height="80" rx="9" transform="rotate(13, 80, 285)" stroke-width="16" fill="${innerFill}" />
        <rect x="38" y="225" width="24" height="118" rx="12" transform="rotate(13, 50, 284)" stroke-width="16" fill="${innerFill}" />

        <!-- Right Dumbbell Plates -->
        <rect x="235" y="280" width="20" height="80" rx="9" transform="rotate(13, 245, 320)" stroke-width="16" fill="${innerFill}" />
        <rect x="265" y="260" width="24" height="118" rx="12" transform="rotate(13, 277, 319)" stroke-width="16" fill="${innerFill}" />
      </g>

      <!-- 3. INNER LUMINOUS WHITE GAS CORE PASS -->
      <g stroke="#FFFFFF" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.94">
        <!-- Heart left lobe & flank -->
        <path d="M 170 145 C 170 145 130 100 80 110 C 25 120 10 180 30 240 C 40 270 65 310 95 345 L 165 415 L 195 375" stroke-width="5" />
        
        <!-- Right side: Leaf & outer contour -->
        <path d="M 170 145 C 170 145 205 105 245 105 C 265 105 290 85 310 55 C 310 100 300 150 260 200 C 235 230 210 270 180 320" stroke-width="5" />
        <path d="M 245 105 C 270 125 285 160 280 195" stroke-width="4" />
        <!-- Leaf inner vein -->
        <path d="M 220 160 Q 265 115 300 70" stroke-width="3" />

        <!-- Heart bottom V tip -->
        <path d="M 115 370 L 165 425 L 205 365" stroke-width="5" />

        <!-- Dumbbell Bar -->
        <line x1="80" y1="285" x2="245" y2="320" stroke-width="6" />

        <!-- Left Dumbbell Plates -->
        <rect x="70" y="245" width="20" height="80" rx="9" transform="rotate(13, 80, 285)" stroke-width="4.5" />
        <rect x="38" y="225" width="24" height="118" rx="12" transform="rotate(13, 50, 284)" stroke-width="4.5" />

        <!-- Right Dumbbell Plates -->
        <rect x="235" y="280" width="20" height="80" rx="9" transform="rotate(13, 245, 320)" stroke-width="4.5" />
        <rect x="265" y="260" width="24" height="118" rx="12" transform="rotate(13, 277, 319)" stroke-width="4.5" />
      </g>
    </g>
    `;
  }

  // =========================================================================
  // 1. OFFICIAL SQUARE LOGO (1024x1024) - Exact match of Logo 2.jpeg
  // =========================================================================
  const logoSquareSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    ${neonDefs}
    <!-- Dark Background -->
    <rect width="1024" height="1024" fill="#0D0A18" />

    <!-- Diamond Sparkle in bottom right corner -->
    <g transform="translate(900, 890)" filter="url(#sparkleFilter)" opacity="0.65">
      <path d="M 0,-24 Q 0,0 24,0 Q 0,0 0,24 Q 0,0 -24,0 Q 0,0 0,-24 Z" fill="#7C5D9F" />
      <circle cx="0" cy="0" r="3" fill="#E9D5FF" />
    </g>

    <!-- Icon on Left -->
    <g transform="translate(80, 210) scale(1.15)">
      ${renderIconElements({ bgFill: '#0D0A18', isDarkBg: true })}
    </g>

    <!-- Wordmark on Right -->
    <g transform="translate(435, 545)">
      <!-- Ambient Glow for 'Base' -->
      <text x="248" y="0" font-family="'Inter', -apple-system, system-ui, sans-serif" font-weight="700" font-size="108" fill="url(#textNeonGrad)" letter-spacing="-1.5" filter="url(#textGlowFilter)" opacity="0.8">
        Base
      </text>
      <!-- Crisp Text -->
      <text x="0" y="0" font-family="'Inter', -apple-system, system-ui, sans-serif" font-weight="700" font-size="108" letter-spacing="-1.5">
        <tspan fill="#FFFFFF">Nutrii</tspan><tspan fill="url(#textNeonGrad)">Base</tspan>
      </text>
    </g>
  </svg>
  `;

  // =========================================================================
  // 2. FULL LOGO WITHOUT BACKGROUND (Transparent for Header & Footer)
  // Dimensions: 640 x 180
  // =========================================================================
  const logoTransparentSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 180" width="640" height="180">
    ${neonDefs}
    <!-- Icon Left (Scaled & Positioned) -->
    <g transform="translate(5, -45) scale(0.55)">
      ${renderIconElements({ bgFill: 'none', isDarkBg: false })}
    </g>

    <!-- Wordmark Right -->
    <g transform="translate(200, 115)">
      <!-- Ambient Glow for 'Base' -->
      <text x="175" y="0" font-family="'Inter', -apple-system, system-ui, sans-serif" font-weight="700" font-size="76" fill="url(#textNeonGrad)" letter-spacing="-1" filter="url(#textGlowFilter)" opacity="0.8">
        Base
      </text>
      <!-- Crisp Text -->
      <text x="0" y="0" font-family="'Inter', -apple-system, system-ui, sans-serif" font-weight="700" font-size="76" letter-spacing="-1">
        <tspan fill="#FFFFFF">Nutrii</tspan><tspan fill="url(#textNeonGrad)">Base</tspan>
      </text>
    </g>
  </svg>
  `;

  // =========================================================================
  // 3. ISOLATED ICON (App Icon / Squircle or Transparent, 256x256)
  // =========================================================================
  const iconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
    ${neonDefs}
    <rect width="256" height="256" rx="56" fill="#0D0A18" />
    <rect width="256" height="256" rx="56" fill="none" stroke="#282044" stroke-width="4" />
    <g transform="translate(30, 0) scale(0.56)">
      ${renderIconElements({ bgFill: '#0D0A18', isDarkBg: true })}
    </g>
  </svg>
  `;

  // =========================================================================
  // 4. CRISP FAVICON (64x64)
  // =========================================================================
  const faviconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    ${neonDefs}
    <rect width="64" height="64" rx="16" fill="#0D0A18" />
    <g transform="translate(6, 0) scale(0.14)">
      ${renderIconElements({ bgFill: '#0D0A18', isDarkBg: true })}
    </g>
  </svg>
  `;

  // =========================================================================
  // 5. HERO BANNER (1920x1080)
  // Featuring atmospheric dark violet mood, nutritious rustic bowl, and smartphone
  // displaying the official glowing NutriiBase logo and UI!
  // =========================================================================
  const bannerSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
    <defs>
      ${neonDefs}

      <!-- Ambient Mood Background -->
      <linearGradient id="bgAmbient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#08060F" />
        <stop offset="45%" stop-color="#0F0C1B" />
        <stop offset="100%" stop-color="#181329" />
      </linearGradient>
      
      <linearGradient id="woodPlanks" x1="0%" y1="30%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#141021" />
        <stop offset="35%" stop-color="#1D172F" />
        <stop offset="70%" stop-color="#130F20" />
        <stop offset="100%" stop-color="#0A0812" />
      </linearGradient>

      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="45%" stop-color="#000000" stop-opacity="0" />
        <stop offset="85%" stop-color="#07050E" stop-opacity="0.65" />
        <stop offset="100%" stop-color="#030207" stop-opacity="0.9" />
      </radialGradient>

      <radialGradient id="neonAmbientLight" cx="68%" cy="45%" r="45%">
        <stop offset="0%" stop-color="#A855F7" stop-opacity="0.18" />
        <stop offset="45%" stop-color="#7C3AED" stop-opacity="0.08" />
        <stop offset="100%" stop-color="#0F0C1B" stop-opacity="0" />
      </radialGradient>

      <!-- Shadows -->
      <filter id="phoneShadow" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="-18" dy="28" stdDeviation="38" flood-color="#000000" flood-opacity="0.85" />
      </filter>
      <filter id="bowlShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="15" dy="30" stdDeviation="40" flood-color="#000000" flood-opacity="0.8" />
      </filter>

      <!-- Clip paths -->
      <clipPath id="phoneScreenClip">
        <rect x="1105" y="165" width="410" height="850" rx="42" />
      </clipPath>
      <clipPath id="bowlClip">
        <circle cx="560" cy="560" r="320" />
      </clipPath>
    </defs>

    <!-- 1. Background Scene -->
    <rect width="1920" height="1080" fill="url(#bgAmbient)" />
    <path d="M 0 340 L 1920 280 L 1920 1080 L 0 1080 Z" fill="url(#woodPlanks)" />
    <path d="M 0 520 L 1920 460" stroke="#0D0A14" stroke-width="3" opacity="0.6" />
    <path d="M 0 740 L 1920 680" stroke="#0D0A14" stroke-width="4" opacity="0.7" />
    <path d="M 0 960 L 1920 900" stroke="#0D0A14" stroke-width="3" opacity="0.5" />

    <!-- Ambient Neon Reflection -->
    <rect width="1920" height="1080" fill="url(#neonAmbientLight)" />

    <!-- 2. LEFT SIDE: Healthy Gourmet Bowl -->
    <g filter="url(#bowlShadow)">
      <circle cx="560" cy="560" r="340" fill="#231C33" stroke="#382D5C" stroke-width="12" />
      <circle cx="560" cy="560" r="328" fill="#151121" />

      <g clip-path="url(#bowlClip)">
        <!-- Fresh Greens -->
        <rect x="240" y="240" width="640" height="640" fill="#1D2A20" />
        <path d="M 280 460 C 350 350 500 370 540 450 C 470 520 370 510 280 460 Z" fill="#2E4A35" />
        <path d="M 460 300 C 530 250 670 290 680 380 C 600 420 520 380 460 300 Z" fill="#3D5E46" />
        <path d="M 330 620 C 420 540 580 570 580 680 C 480 730 380 700 330 620 Z" fill="#263E2C" />

        <!-- Grilled Chicken Breast with sear marks -->
        <g transform="translate(560, 360)">
          <path d="M -30 20 C 30 -50 140 -20 180 50 C 210 110 150 170 80 180 C 0 190 -70 120 -30 20 Z" fill="#B38A58" stroke="#8C6638" stroke-width="3" />
          <path d="M 0 10 L 40 80 M 30 0 L 70 70 M 60 -5 L 100 65 M 90 0 L 130 65 M 120 10 L 150 65" stroke="#4A331A" stroke-width="5" stroke-linecap="round" />
        </g>

        <!-- Brown Rice & Quinoa Bed -->
        <path d="M 400 560 C 480 520 620 550 660 630 C 620 720 480 740 390 670 Z" fill="#9C8262" />

        <!-- Cherry Tomatoes (Vibrant Red) -->
        <circle cx="430" cy="460" r="32" fill="#D32F2F" />
        <circle cx="420" cy="450" r="7" fill="#FF8A80" opacity="0.8" />
        <circle cx="490" cy="480" r="28" fill="#C62828" />
        <circle cx="482" cy="472" r="6" fill="#FF8A80" opacity="0.8" />
        <circle cx="470" cy="530" r="26" fill="#E53935" />

        <!-- Fresh Avocado Slices -->
        <path d="M 680 480 C 720 530 710 610 660 650 C 620 630 610 570 630 520 Z" fill="#8BC34A" />
        <path d="M 650 510 C 680 540 670 590 640 610" stroke="#33691E" stroke-width="4" fill="none" />
      </g>
    </g>

    <!-- 3. RIGHT SIDE: Smartphone with NutriiBase App UI -->
    <g filter="url(#phoneShadow)">
      <!-- Outer Metal Chassis -->
      <rect x="1090" y="150" width="440" height="880" rx="52" fill="#1C182B" stroke="#4A3B66" stroke-width="5" />
      <!-- Inner Bezel -->
      <rect x="1100" y="160" width="420" height="860" rx="46" fill="#0D0A18" />

      <!-- Screen Content (Clipped) -->
      <g clip-path="url(#phoneScreenClip)">
        <rect x="1105" y="165" width="410" height="850" fill="#0F0C1B" />

        <!-- Dynamic Island / Speaker Notch -->
        <rect x="1245" y="180" width="130" height="28" rx="14" fill="#000000" />
        <circle cx="1350" cy="194" r="5" fill="#1E1833" />

        <!-- Phone Top Status Bar -->
        <text x="1140" y="200" font-family="'Inter', sans-serif" font-weight="600" font-size="13" fill="#F8F6FD">9:41</text>
        <g transform="translate(1460, 190)">
          <path d="M 0 10 L 0 4 M 4 10 L 4 2 M 8 10 L 8 0" stroke="#F8F6FD" stroke-width="2" stroke-linecap="round" />
          <rect x="16" y="0" width="22" height="11" rx="3" fill="none" stroke="#F8F6FD" stroke-width="1.5" />
          <rect x="18" y="2" width="14" height="7" rx="1.5" fill="#B388FF" />
        </g>

        <!-- App Header with the Official Glowing Logo -->
        <g transform="translate(1125, 230)">
          <!-- Mini Icon -->
          <g transform="translate(0, -18) scale(0.24)">
            ${renderIconElements({ bgFill: '#0F0C1B', isDarkBg: true })}
          </g>
          <!-- Wordmark -->
          <text x="88" y="44" font-family="'Inter', sans-serif" font-weight="700" font-size="28" letter-spacing="-0.5">
            <tspan fill="#FFFFFF">Nutrii</tspan><tspan fill="url(#textNeonGrad)">Base</tspan>
          </text>
          
          <!-- Date Pill -->
          <rect x="290" y="22" width="75" height="28" rx="14" fill="#1E1833" stroke="#382D5C" stroke-width="1" />
          <text x="327" y="41" font-family="'Inter', sans-serif" font-size="11" font-weight="600" fill="#CAC2DF" text-anchor="middle">Hoje</text>
        </g>

        <!-- Daily Calorie Target Card -->
        <g transform="translate(1125, 315)">
          <rect width="370" height="160" rx="24" fill="#1E1833" stroke="#382D5C" stroke-width="1.5" />
          <text x="24" y="38" font-family="'Inter', sans-serif" font-size="14" font-weight="500" fill="#CAC2DF">Meta diária de calorias</text>
          
          <!-- Main Calorie Display -->
          <text x="24" y="90" font-family="'Inter', sans-serif" font-size="44" font-weight="700" fill="#F8F6FD">
            1.840 <tspan font-size="18" font-weight="500" fill="#8D82AA">/ 2.200 kcal</tspan>
          </text>

          <!-- Macro bars -->
          <g transform="translate(24, 118)">
            <!-- Carbs -->
            <rect x="0" y="0" width="100" height="6" rx="3" fill="#282044" />
            <rect x="0" y="0" width="75" height="6" rx="3" fill="#B388FF" />
            <text x="0" y="22" font-family="'Inter', sans-serif" font-size="11" fill="#CAC2DF">Carbs: 165g</text>

            <!-- Protein -->
            <rect x="112" y="0" width="100" height="6" rx="3" fill="#282044" />
            <rect x="112" y="0" width="88" height="6" rx="3" fill="#7C3AED" />
            <text x="112" y="22" font-family="'Inter', sans-serif" font-size="11" fill="#CAC2DF">Prot: 142g</text>

            <!-- Fat -->
            <rect x="224" y="0" width="98" height="6" rx="3" fill="#282044" />
            <rect x="224" y="0" width="55" height="6" rx="3" fill="#F472B6" />
            <text x="224" y="22" font-family="'Inter', sans-serif" font-size="11" fill="#CAC2DF">Gord: 48g</text>
          </g>
        </g>

        <!-- AI Food Input Simulation (Instant Speech/Text Card) -->
        <g transform="translate(1125, 495)">
          <rect width="370" height="150" rx="22" fill="#282044" stroke="#7C3AED" stroke-width="1.5" />
          
          <!-- Tag -->
          <rect x="20" y="18" width="100" height="24" rx="12" fill="#7C3AED" opacity="0.3" />
          <text x="70" y="34" font-family="'Inter', sans-serif" font-size="11" font-weight="600" fill="#E9D5FF" text-anchor="middle">IA NutriiBase</text>

          <text x="20" y="68" font-family="'Inter', sans-serif" font-size="14" font-weight="600" fill="#F8F6FD">
            "2 fatias de pão integral com 2 ovos mexidos e café"
          </text>

          <!-- Estimation Result -->
          <g transform="translate(20, 92)">
            <rect width="330" height="42" rx="10" fill="#1E1833" />
            <text x="16" y="26" font-family="'Inter', sans-serif" font-size="13" font-weight="600" fill="#B388FF">345 kcal</text>
            <text x="85" y="26" font-family="'Inter', sans-serif" font-size="12" fill="#CAC2DF">• 28g C • 19g P • 14g G</text>
            <text x="270" y="26" font-family="'Inter', sans-serif" font-size="11" fill="#8D82AA">calculado</text>
          </g>
        </g>

        <!-- Quick Log Input Bar -->
        <g transform="translate(1125, 665)">
          <rect width="370" height="74" rx="20" fill="#1E1833" stroke="#B388FF" stroke-width="1.5" />
          <text x="24" y="38" font-family="'Inter', sans-serif" font-size="14" fill="#F8F6FD">O que você comeu agora?</text>
          <text x="24" y="58" font-family="'Inter', sans-serif" font-size="11" fill="#8D82AA">A IA calcula calorias e macros na hora...</text>
          
          <!-- Send CTA Button -->
          <circle cx="330" cy="37" r="22" fill="#7C3AED" />
          <path d="M 324 37 L 336 37 M 332 31 L 338 37 L 332 43" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>
      </g>
    </g>

    <!-- Overall Vignette to integrate edges -->
    <rect width="1920" height="1080" fill="url(#vignette)" />
  </svg>
  `;

  // Targets to output
  const targets = [
    { svg: logoTransparentSvg, name: 'LOGO NS SEM FUNDO.png', width: 640, height: 180 },
    { svg: logoSquareSvg, name: 'Logo 2.png', width: 1024, height: 1024 },
    { svg: logoSquareSvg, name: 'LOGO_OFICIAL.png', width: 1024, height: 1024 },
    { svg: iconSvg, name: 'ICONE NS.png', width: 256, height: 256 },
    { svg: faviconSvg, name: 'NutriiBase.favicon.png', width: 64, height: 64 },
    { svg: bannerSvg, name: 'BANNER NUTRIIBASE.png', width: 1920, height: 1080 },
  ];

  console.log('Generating official brand assets matching Logo 2.jpeg...');

  for (const t of targets) {
    const buf = Buffer.from(t.svg);
    // Write in public/
    const publicPath = path.join(publicDir, t.name);
    await sharp(buf).resize(t.width, t.height).png().toFile(publicPath);
    console.log(`Created in public: ${t.name}`);

    // Also write in root
    const rootPath = path.resolve(t.name);
    await sharp(buf).resize(t.width, t.height).png().toFile(rootPath);
    console.log(`Created in root: ${t.name}`);
  }

  console.log('All official assets successfully generated!');
}

generateAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
