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

  // Cisco Wireless Access Point / Home Router (WRT300N)
  wireless_ap: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
      <defs>
        <linearGradient id="apGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#64748b"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>
      </defs>
      <!-- Dual Antennas -->
      <line x1="20" y1="36" x2="14" y2="12" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
      <line x1="50" y1="36" x2="56" y2="12" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
      
      <!-- Radiating Wireless Waves -->
      <path d="M 26 18 A 12 12 0 0 1 44 18" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <path d="M 21 12 A 18 18 0 0 1 49 12" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round"/>
      
      <!-- AP Base Unit -->
      <rect x="10" y="36" width="50" height="24" rx="4" fill="url(#apGrad)" stroke="#1e293b" stroke-width="2"/>
      <line x1="14" y1="48" x2="56" y2="48" stroke="#0ea5e9" stroke-width="3"/>
      <!-- LED indicators -->
      <circle cx="20" cy="54" r="1.5" fill="#22c55e"/>
      <circle cx="26" cy="54" r="1.5" fill="#22c55e"/>
      <circle cx="32" cy="54" r="1.5" fill="#22c55e"/>
      <circle cx="38" cy="54" r="1.5" fill="#38bdf8"/>
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
    </svg>`
};

/**
 * Helper to get SVG string by device type
 */
function getCiscoDeviceIcon(type, model = "") {
  const t = (type || "").toLowerCase();
  const m = (model || "").toLowerCase();

  if (t === 'router') return CiscoIcons.router;
  if (t === 'switch') {
    if (m.includes('3560') || m.includes('layer3') || m.includes('l3')) {
      return CiscoIcons.multilayer_switch;
    }
    return CiscoIcons.switch;
  }
  if (t === 'wireless_ap' || t === 'ap' || t === 'wireless' || m.includes('wrt300n')) {
    return CiscoIcons.wireless_ap;
  }
  if (t === 'laptop') return CiscoIcons.laptop;
  if (t === 'server') return CiscoIcons.server;
  if (t === 'cloud') return CiscoIcons.cloud;
  return CiscoIcons.pc; // default PC
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CiscoIcons, getCiscoDeviceIcon };
}
