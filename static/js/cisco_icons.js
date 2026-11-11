/**
 * cisco_icons.js - Official Cisco-style vector iconography for PXL Web NetSim
 * Provides pixel-perfect SVG graphics for Routers, Switches, PCs, Laptops, Servers, APs, and Cloud.
 * NOTE: Explicit xmlns is required for XML/Blob image parsing in HTML5 Canvas.
 */

const CiscoIcons = {
  // Cisco 2D/3D Cylindrical Router with 4 Cross-Arrows
  router: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
      <defs>
        <radialGradient id="routerGrad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="70%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </radialGradient>
      </defs>
      <!-- Base Cylinder Disc -->
      <ellipse cx="35" cy="35" rx="30" ry="30" fill="url(#routerGrad)" stroke="#0c4a6e" stroke-width="2"/>
      <ellipse cx="35" cy="35" rx="27" ry="27" fill="none" stroke="#e0f2fe" stroke-width="1" opacity="0.6"/>
      
      <!-- Four Classic Cisco Arrows (White with dark border) -->
      <!-- Left Inward Arrow -->
      <path d="M 14 35 L 23 30 L 23 33 L 30 33 L 30 37 L 23 37 L 23 40 Z" fill="#ffffff" stroke="#0c4a6e" stroke-width="0.75"/>
      <!-- Right Inward Arrow -->
      <path d="M 56 35 L 47 30 L 47 33 L 40 33 L 40 37 L 47 37 L 47 40 Z" fill="#ffffff" stroke="#0c4a6e" stroke-width="0.75"/>
      <!-- Top Outward Arrow -->
      <path d="M 35 14 L 40 23 L 37 23 L 37 30 L 33 30 L 33 23 L 30 23 Z" fill="#ffffff" stroke="#0c4a6e" stroke-width="0.75"/>
      <!-- Bottom Outward Arrow -->
      <path d="M 35 56 L 40 47 L 37 47 L 37 40 L 33 40 L 33 47 L 30 47 Z" fill="#ffffff" stroke="#0c4a6e" stroke-width="0.75"/>
    </svg>`,

  // Cisco 2D/3D Rectangular Switch with Opposing Horizontal Arrows
  switch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 56" width="76" height="56">
      <defs>
        <linearGradient id="switchGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0ea5e9"/>
          <stop offset="50%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#075985"/>
        </linearGradient>
      </defs>
      <!-- Switch Box Body -->
      <rect x="4" y="6" width="68" height="44" rx="5" ry="5" fill="url(#switchGrad)" stroke="#0c4a6e" stroke-width="2"/>
      <rect x="7" y="9" width="62" height="38" rx="3" ry="3" fill="none" stroke="#bae6fd" stroke-width="1" opacity="0.4"/>
      
      <!-- Top Pair of Opposing Arrows -->
      <path d="M 16 19 L 36 19 L 36 16 L 42 20 L 36 24 L 36 21 L 16 21 Z" fill="#ffffff" stroke="#0c4a6e" stroke-width="0.75"/>
      <path d="M 60 27 L 40 27 L 40 24 L 34 28 L 40 32 L 40 29 L 60 29 Z" fill="#ffffff" stroke="#0c4a6e" stroke-width="0.75"/>
      
      <!-- Bottom Pair of Opposing Arrows -->
      <path d="M 16 35 L 36 35 L 36 32 L 42 36 L 36 40 L 36 37 L 16 37 Z" fill="#ffffff" stroke="#0c4a6e" stroke-width="0.75"/>
      <path d="M 60 43 L 40 43 L 40 40 L 34 44 L 40 48 L 40 45 L 60 45 Z" fill="#ffffff" stroke="#0c4a6e" stroke-width="0.75"/>
    </svg>`,

  // Cisco Multilayer Switch (L3)
  multilayer_switch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 56" width="76" height="56">
      <defs>
        <linearGradient id="l3Grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#06b6d4"/>
          <stop offset="100%" stop-color="#0e7490"/>
        </linearGradient>
      </defs>
      <rect x="4" y="6" width="68" height="44" rx="5" ry="5" fill="url(#l3Grad)" stroke="#164e63" stroke-width="2"/>
      <circle cx="38" cy="28" r="14" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="8 4"/>
      <path d="M 24 28 L 31 23 L 31 33 Z" fill="#ffffff"/>
      <path d="M 52 28 L 45 23 L 45 33 Z" fill="#ffffff"/>
      <path d="M 38 14 L 33 21 L 43 21 Z" fill="#ffffff"/>
      <path d="M 38 42 L 33 35 L 43 35 Z" fill="#ffffff"/>
    </svg>`,

  // Cisco Wireless Router (Linksys WRT300N Home Gateway)
  wireless_router: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
      <defs>
        <linearGradient id="wrtGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </linearGradient>
      </defs>
      <!-- Dual Antennas -->
      <line x1="18" y1="36" x2="12" y2="12" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="52" y1="36" x2="58" y2="12" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
      
      <!-- Radiating Wireless Waves -->
      <path d="M 26 18 A 12 12 0 0 1 44 18" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M 20 12 A 19 19 0 0 1 50 12" fill="none" stroke="#0ea5e9" stroke-width="2.2" stroke-linecap="round"/>
      
      <!-- WRT300N Base Unit (Black Body & Classic Blue Faceplate) -->
      <rect x="8" y="34" width="54" height="26" rx="4" fill="#0f172a" stroke="#0284c7" stroke-width="2"/>
      <rect x="12" y="38" width="46" height="10" rx="2" fill="url(#wrtGrad)"/>
      <text x="35" y="46" font-family="Arial, sans-serif" font-weight="900" font-size="7" fill="#ffffff" text-anchor="middle">WRT300N</text>
      <!-- Activity LEDs -->
      <circle cx="16" cy="53" r="1.5" fill="#22c55e"/>
      <circle cx="23" cy="53" r="1.5" fill="#22c55e"/>
      <circle cx="30" cy="53" r="1.5" fill="#22c55e"/>
      <circle cx="37" cy="53" r="1.5" fill="#22c55e"/>
      <circle cx="44" cy="53" r="1.5" fill="#38bdf8"/>
      <circle cx="51" cy="53" r="1.5" fill="#22c55e"/>
    </svg>`,

  // Cisco Lightweight Access Point (LAP-PT / Aironet 3702i Ceiling Dome)
  wireless_ap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
      <defs>
        <radialGradient id="apDomeGrad" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="75%" stop-color="#e2e8f0"/>
          <stop offset="100%" stop-color="#94a3b8"/>
        </radialGradient>
      </defs>
      <!-- Concentric Radiating RF Waves -->
      <path d="M 22 18 A 18 18 0 0 1 48 18" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>
      <path d="M 16 12 A 25 25 0 0 1 54 12" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <!-- Ceiling Mount AP Round Disc/Dome -->
      <circle cx="35" cy="40" r="23" fill="url(#apDomeGrad)" stroke="#475569" stroke-width="2"/>
      <circle cx="35" cy="40" r="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
      <!-- Cisco Multi-color Status LED Ring -->
      <circle cx="35" cy="40" r="4.5" fill="#22c55e" stroke="#16a34a" stroke-width="1.5"/>
      <text x="35" y="58" font-family="Arial, sans-serif" font-weight="bold" font-size="6.5" fill="#334155" text-anchor="middle">AIR-AP</text>
    </svg>`,

  // Cisco 3504 Wireless LAN Controller (WLC)
  wlc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 56" width="76" height="56">
      <defs>
        <linearGradient id="wlcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <!-- 1U Rackmount Chassis -->
      <rect x="4" y="12" width="68" height="34" rx="3" fill="url(#wlcGrad)" stroke="#0284c7" stroke-width="2"/>
      <!-- Mounting Ears -->
      <rect x="2" y="14" width="4" height="30" fill="#475569" rx="1"/>
      <circle cx="4" cy="18" r="1" fill="#cbd5e1"/>
      <circle cx="4" cy="40" r="1" fill="#cbd5e1"/>
      <rect x="70" y="14" width="4" height="30" fill="#475569" rx="1"/>
      <circle cx="72" cy="18" r="1" fill="#cbd5e1"/>
      <circle cx="72" cy="40" r="1" fill="#cbd5e1"/>
      <!-- LCD Screen / Brand -->
      <rect x="10" y="17" width="22" height="10" rx="1" fill="#082f49" stroke="#0284c7" stroke-width="0.75"/>
      <text x="21" y="24" font-family="monospace" font-weight="bold" font-size="5" fill="#38bdf8" text-anchor="middle">WLC 3504</text>
      <!-- Controller Emblem / Cross-arrows -->
      <circle cx="42" cy="22" r="5" fill="#0284c7"/>
      <path d="M 40 22 L 44 22 M 42 20 L 42 24" stroke="#ffffff" stroke-width="1.2"/>
      <!-- 4x Gigabit Port Array -->
      <rect x="52" y="18" width="16" height="8" rx="1" fill="#020617" stroke="#64748b" stroke-width="0.5"/>
      <rect x="54" y="20" width="3" height="4" fill="#38bdf8"/>
      <rect x="58" y="20" width="3" height="4" fill="#38bdf8"/>
      <rect x="62" y="20" width="3" height="4" fill="#38bdf8"/>
      <!-- Radiating Controller Waves -->
      <path d="M 12 38 A 12 12 0 0 1 30 38" fill="none" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M 8 42 A 18 18 0 0 1 34 42" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Status LEDs -->
      <circle cx="46" cy="38" r="1.5" fill="#22c55e"/>
      <circle cx="52" cy="38" r="1.5" fill="#22c55e"/>
      <circle cx="58" cy="38" r="1.5" fill="#38bdf8"/>
      <circle cx="64" cy="38" r="1.5" fill="#22c55e"/>
    </svg>`,

  // Cisco PC Workstation
  pc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 65" width="70" height="65">
      <defs>
        <linearGradient id="pcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="100%" stop-color="#cbd5e1"/>
        </linearGradient>
      </defs>
      <!-- PC Monitor -->
      <rect x="6" y="8" width="40" height="30" rx="2" fill="url(#pcGrad)" stroke="#334155" stroke-width="2"/>
      <rect x="9" y="11" width="34" height="24" rx="1" fill="#0284c7"/>
      <!-- Monitor Stand & Base -->
      <rect x="23" y="38" width="6" height="6" fill="#64748b" stroke="#334155" stroke-width="1.5"/>
      <path d="M 15 44 L 37 44 L 39 47 L 13 47 Z" fill="#94a3b8" stroke="#334155" stroke-width="1.5"/>
      <!-- Keyboard -->
      <path d="M 12 50 L 40 50 L 43 55 L 9 55 Z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5"/>
      
      <!-- Tower Case -->
      <rect x="50" y="10" width="16" height="45" rx="2" fill="#475569" stroke="#1e293b" stroke-width="2"/>
      <rect x="53" y="15" width="10" height="4" fill="#0284c7"/>
      <circle cx="58" cy="25" r="2" fill="#22c55e"/>
      <circle cx="58" cy="48" r="3" fill="#cbd5e1"/>
    </svg>`,

  // Cisco Laptop Workstation
  laptop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 60" width="70" height="60">
      <!-- Laptop Screen (Open Clamshell) -->
      <path d="M 14 10 L 56 10 L 53 38 L 17 38 Z" fill="#334155" stroke="#1e293b" stroke-width="2"/>
      <rect x="18" y="13" width="34" height="22" fill="#0284c7" rx="1"/>
      <!-- Keyboard Base -->
      <path d="M 8 38 L 62 38 L 66 48 L 4 48 Z" fill="#64748b" stroke="#1e293b" stroke-width="2"/>
      <!-- Trackpad -->
      <rect x="29" y="42" width="12" height="4" rx="1" fill="#94a3b8"/>
    </svg>`,

  // Cisco Server
  server: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 70" width="60" height="70">
      <rect x="8" y="8" width="44" height="54" rx="3" fill="#334155" stroke="#0f172a" stroke-width="2"/>
      <!-- Drive Bay 1 -->
      <rect x="12" y="14" width="36" height="10" rx="1" fill="#475569" stroke="#1e293b" stroke-width="1"/>
      <circle cx="16" cy="19" r="1.5" fill="#22c55e"/>
      <circle cx="21" cy="19" r="1.5" fill="#38bdf8"/>
      <!-- Drive Bay 2 -->
      <rect x="12" y="28" width="36" height="10" rx="1" fill="#475569" stroke="#1e293b" stroke-width="1"/>
      <circle cx="16" cy="33" r="1.5" fill="#22c55e"/>
      <circle cx="21" cy="33" r="1.5" fill="#38bdf8"/>
      <!-- Drive Bay 3 -->
      <rect x="12" y="42" width="36" height="10" rx="1" fill="#475569" stroke="#1e293b" stroke-width="1"/>
      <circle cx="16" cy="47" r="1.5" fill="#22c55e"/>
      <line x1="28" y1="47" x2="44" y2="47" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2 2"/>
    </svg>`,

  // Cisco Cloud / WAN
  cloud: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 56" width="76" height="56">
      <defs>
        <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#cbd5e1"/>
        </linearGradient>
      </defs>
      <path d="M 22 42 L 56 42 A 12 12 0 0 0 58 18 A 16 16 0 0 0 28 16 A 14 14 0 0 0 16 32 A 10 10 0 0 0 22 42 Z"
            fill="url(#cloudGrad)" stroke="#475569" stroke-width="2"/>
      <text x="38" y="33" font-family="Arial, sans-serif" font-weight="bold" font-size="11" fill="#0369a1" text-anchor="middle">WAN</text>
    </svg>`,

  // MikroTik Router (hEX lite RB750r2)
  mikrotik: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 56" width="76" height="56">
      <defs>
        <linearGradient id="mtGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="68" height="40" rx="4" fill="url(#mtGrad)" stroke="#475569" stroke-width="2"/>
      <polygon points="12,22 17,22 23,28 17,34 12,34 18,28" fill="#0284c7"/>
      <polygon points="20,22 25,22 31,28 25,34 20,34 26,28" fill="#334155"/>
      <rect x="36" y="24" width="5" height="7" rx="1" fill="#334155" stroke="#0284c7" stroke-width="0.75"/>
      <rect x="43" y="24" width="5" height="7" rx="1" fill="#334155" stroke="#0284c7" stroke-width="0.75"/>
      <rect x="50" y="24" width="5" height="7" rx="1" fill="#334155" stroke="#0284c7" stroke-width="0.75"/>
      <rect x="57" y="24" width="5" height="7" rx="1" fill="#334155" stroke="#0284c7" stroke-width="0.75"/>
      <rect x="64" y="24" width="5" height="7" rx="1" fill="#334155" stroke="#0284c7" stroke-width="0.75"/>
      <circle cx="38" cy="18" r="1" fill="#22c55e"/>
      <circle cx="45" cy="18" r="1" fill="#22c55e"/>
      <circle cx="52" cy="18" r="1" fill="#22c55e"/>
      <circle cx="59" cy="18" r="1" fill="#22c55e"/>
      <circle cx="66" cy="18" r="1" fill="#22c55e"/>
      <text x="12" y="44" font-family="Arial, sans-serif" font-weight="bold" font-size="6" fill="#475569">hEX lite</text>
    </svg>`,

  // OpenWrt Gateway Router
  openwrt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 56" width="76" height="56">
      <defs>
        <linearGradient id="owrtGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <line x1="14" y1="12" x2="10" y2="2" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="62" y1="12" x2="66" y2="2" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="6" y="12" width="64" height="36" rx="4" fill="url(#owrtGrad)" stroke="#38bdf8" stroke-width="1.5"/>
      <circle cx="22" cy="30" r="8" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <circle cx="22" cy="30" r="4" fill="#38bdf8"/>
      <circle cx="36" cy="30" r="1.5" fill="#22c55e"/>
      <circle cx="42" cy="30" r="1.5" fill="#22c55e"/>
      <circle cx="48" cy="30" r="1.5" fill="#38bdf8"/>
      <circle cx="54" cy="30" r="1.5" fill="#22c55e"/>
      <text x="63" y="42" font-family="Arial, sans-serif" font-weight="bold" font-size="6.5" fill="#f8fafc" text-anchor="end">OpenWrt</text>
    </svg>`,

  // Het Internet Global Cloud Simulator
  internet_cloud: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 60" width="84" height="60">
      <defs>
        <linearGradient id="inetGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="50%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#0369a1"/>
        </linearGradient>
      </defs>
      <path d="M 24 45 L 62 45 A 14 14 0 0 0 64 18 A 18 18 0 0 0 31 16 A 16 16 0 0 0 17 33 A 12 12 0 0 0 24 45 Z"
            fill="url(#inetGrad)" stroke="#e0f2fe" stroke-width="2"/>
      <circle cx="42" cy="30" r="11" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.85"/>
      <ellipse cx="42" cy="30" rx="5" ry="11" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.85"/>
      <line x1="31" y1="30" x2="53" y2="30" stroke="#ffffff" stroke-width="0.8" opacity="0.85"/>
      <text x="42" y="55" font-family="Arial, sans-serif" font-weight="bold" font-size="7.5" fill="#0369a1" text-anchor="middle">INTERNET</text>
    </svg>`,

  // HPE Aruba 2530 / 2930F Managed Switch
  hpe_switch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 78 56" width="78" height="56">
      <defs>
        <linearGradient id="hpeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="50%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <!-- Switch Chassis -->
      <rect x="3" y="8" width="72" height="40" rx="4" ry="4" fill="url(#hpeGrad)" stroke="#475569" stroke-width="1.5"/>
      <!-- Aruba Orange Accent Bar -->
      <rect x="3" y="8" width="72" height="4" rx="2" fill="#ff7900"/>
      <!-- Port Matrix (2 Rows of Ports) -->
      <g fill="#020617" stroke="#64748b" stroke-width="0.5">
        <rect x="8" y="16" width="6" height="5" rx="1"/>
        <rect x="16" y="16" width="6" height="5" rx="1"/>
        <rect x="24" y="16" width="6" height="5" rx="1"/>
        <rect x="32" y="16" width="6" height="5" rx="1"/>
        <rect x="40" y="16" width="6" height="5" rx="1"/>
        <rect x="48" y="16" width="6" height="5" rx="1"/>
        
        <rect x="8" y="24" width="6" height="5" rx="1"/>
        <rect x="16" y="24" width="6" height="5" rx="1"/>
        <rect x="24" y="24" width="6" height="5" rx="1"/>
        <rect x="32" y="24" width="6" height="5" rx="1"/>
        <rect x="40" y="24" width="6" height="5" rx="1"/>
        <rect x="48" y="24" width="6" height="5" rx="1"/>
      </g>
      <!-- SFP Slots (4x) -->
      <g fill="#1e1b4b" stroke="#818cf8" stroke-width="0.75">
        <rect x="58" y="16" width="5" height="13" rx="1"/>
        <rect x="65" y="16" width="5" height="13" rx="1"/>
      </g>
      <!-- Status LEDs -->
      <circle cx="8" cy="34" r="1.2" fill="#22c55e"/>
      <circle cx="12" cy="34" r="1.2" fill="#22c55e"/>
      <circle cx="16" cy="34" r="1.2" fill="#38bdf8"/>
      <!-- Brand Text -->
      <text x="39" y="44" font-family="Arial, sans-serif" font-weight="900" font-size="7" fill="#ff7900" text-anchor="middle">aruba</text>
    </svg>`
};

/**
 * Helper to get SVG string by device type
 */
function getCiscoDeviceIcon(type, model = "") {
  const t = (type || "").toLowerCase();
  const m = (model || "").toLowerCase();

  if (t === 'hpe_switch' || m.includes('aruba') || m.includes('hpe') || m.includes('2530') || m.includes('2930')) {
    return CiscoIcons.hpe_switch;
  }
  if (t === 'router') return CiscoIcons.router;
  if (t === 'switch') {
    if (m.includes('3560') || m.includes('layer3') || m.includes('l3')) {
      return CiscoIcons.multilayer_switch;
    }
    return CiscoIcons.switch;
  }
  if (t === 'wlc' || m.includes('3504') || m.includes('wlc')) {
    return CiscoIcons.wlc;
  }
  if (t === 'wireless_router' || m.includes('wrt300n') || m.includes('home gateway') || m.includes('router-wireless')) {
    return CiscoIcons.wireless_router;
  }
  if (t === 'wireless_ap' || t === 'ap' || t === 'access_point' || m.includes('aironet') || m.includes('lap') || m.includes('eap')) {
    return CiscoIcons.wireless_ap;
  }
  if (t === 'laptop') return CiscoIcons.laptop;
  if (t === 'server') return CiscoIcons.server;
  if (t === 'mikrotik') return CiscoIcons.mikrotik;
  if (t === 'openwrt') return CiscoIcons.openwrt;
  if (t === 'internet_cloud' || t === 'internet') return CiscoIcons.internet_cloud;
  if (t === 'cloud') return CiscoIcons.cloud;
  return CiscoIcons.pc; // default PC
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CiscoIcons, getCiscoDeviceIcon };
}
