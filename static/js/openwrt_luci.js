/**
 * openwrt_luci.js - OpenWrt LuCI Web Management Interface
 * Authentic LuCI (Bootstrap/Argon style) Web GUI for OpenWrt 23.05
 * Accessible via Device Modal and via PC/Laptop Web Browser (http://192.168.1.1)
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

(function () {
  'use strict';

  function initOpenWrtConfig(device) {
    if (!device.openwrtConfig) {
      device.openwrtConfig = {
        model: 'Generic x86/64 / TP-Link Archer C7 v5',
        architecture: 'x86_64 / MIPS 74Kc V5.0',
        firmware: 'OpenWrt 23.05.3 r23809-234f1a2',
        kernel: 'Linux 5.15.150',
        hostname: device.hostname || 'OpenWrt',
        uptime: '2d 14h 32m 10s',
        loadAvg: '0.08, 0.04, 0.01',
        dhcp: {
          enabled: true,
          start: 100,
          limit: 150,
          leasetime: '12h',
          leases: [
            { hostname: 'PC-1', ip: '192.168.1.142', mac: '00:50:79:66:68:01', leasetime: '11h 48m' },
            { hostname: 'Laptop-1', ip: '192.168.1.189', mac: '00:50:79:66:68:02', leasetime: '9h 12m' }
          ]
        },
        firewall: {
          zones: [
            { name: 'lan', input: 'ACCEPT', output: 'ACCEPT', forward: 'ACCEPT', masq: false },
            { name: 'wan', input: 'REJECT', output: 'ACCEPT', forward: 'REJECT', masq: true }
          ]
        }
      };
    }
    return device.openwrtConfig;
  }

  function getLanIp(device) {
    return device.interfaces['eth1']?.ip || device.interfaces['br-lan']?.ip || '192.168.1.1';
  }

  function getLanMask(device) {
    return device.interfaces['eth1']?.mask || device.interfaces['br-lan']?.mask || '255.255.255.0';
  }

  function getWanIp(device) {
    return device.interfaces['eth0']?.ip || '198.51.100.25';
  }

  function renderOpenWrtLuciHtml(device, sim, activeSubTab = 'status') {
    if (!device) return '<div style="padding:20px; color:#fff;">Geen OpenWrt apparaat geselecteerd.</div>';
    const cfg = initOpenWrtConfig(device);
    const lanIp = getLanIp(device);
    const lanMask = getLanMask(device);
    const wanIp = getWanIp(device);

    return `
      <div class="luci-container" style="background: #181b20; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; height: 100%; display: flex; flex-direction: column; overflow: hidden; font-size: 13px;">
        <!-- Top LuCI Nav Bar -->
        <div style="background: #101216; border-bottom: 2px solid #009999; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; height: 46px; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 16px; color: #00ffff; letter-spacing: 0.5px;">
              <span style="background: #009999; color: #000; padding: 2px 7px; border-radius: 4px; font-weight: 900; font-size: 12px;">OW</span>
              <span>OpenWrt</span>
            </div>
            <span style="font-size: 12px; color: #8b949e; margin-left: 4px;">(${device.hostname})</span>
            <!-- Top Links -->
            <div style="display: flex; gap: 4px; margin-left: 20px;">
              <button class="luci-tab-btn ${activeSubTab === 'status' ? 'active' : ''}" onclick="window.OpenWrtLuciApp.switchSubTab('${device.id}', 'status')" style="${getTabStyle(activeSubTab === 'status')}">📊 Status</button>
              <button class="luci-tab-btn ${activeSubTab === 'interfaces' ? 'active' : ''}" onclick="window.OpenWrtLuciApp.switchSubTab('${device.id}', 'interfaces')" style="${getTabStyle(activeSubTab === 'interfaces')}">🔌 Interfaces</button>
              <button class="luci-tab-btn ${activeSubTab === 'dhcp' ? 'active' : ''}" onclick="window.OpenWrtLuciApp.switchSubTab('${device.id}', 'dhcp')" style="${getTabStyle(activeSubTab === 'dhcp')}">📋 DHCP &amp; DNS</button>
              <button class="luci-tab-btn ${activeSubTab === 'firewall' ? 'active' : ''}" onclick="window.OpenWrtLuciApp.switchSubTab('${device.id}', 'firewall')" style="${getTabStyle(activeSubTab === 'firewall')}">🛡️ Firewall</button>
              <button class="luci-tab-btn ${activeSubTab === 'system' ? 'active' : ''}" onclick="window.OpenWrtLuciApp.switchSubTab('${device.id}', 'system')" style="${getTabStyle(activeSubTab === 'system')}">⚙️ Systeem</button>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: #8b949e;">
            <span style="background: #21262d; padding: 3px 8px; border-radius: 4px; border: 1px solid #30363d; color: #58a6ff;">● Auto Refresh: On</span>
            <span>👤 root@${device.hostname}</span>
          </div>
        </div>

        <!-- Main LuCI Content Viewport -->
        <div id="luciContentArea_${device.id}" style="flex: 1; padding: 18px 24px; overflow-y: auto;">
          ${renderLuciSubTabContent(device, cfg, activeSubTab, lanIp, lanMask, wanIp)}
        </div>
      </div>
    `;
  }

  function getTabStyle(isActive) {
    if (isActive) {
      return 'background: #009999; color: #ffffff; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 700; cursor: pointer; font-size: 12px;';
    }
    return 'background: transparent; color: #c9d1d9; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background 0.15s;';
  }

  function renderLuciSubTabContent(device, cfg, subTab, lanIp, lanMask, wanIp) {
    if (subTab === 'interfaces') {
      return `
        <div style="max-width: 900px; margin: 0 auto;">
          <h3 style="margin-top:0; color:#58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 8px;">Network &raquo; Interfaces (Netwerkconfiguratie)</h3>
          <p style="color:#8b949e; font-size:12px;">Hier kan je de LAN- en WAN-interfaces van de OpenWrt router instellen. Wijzigingen worden direct actief in de netwerksimulatie.</p>

          <!-- LAN Card -->
          <div style="background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-bottom: 12px;">
              <div>
                <strong style="color: #3fb950; font-size: 15px;">🟢 LAN (br-lan)</strong>
                <span style="font-size: 11px; color: #8b949e; margin-left: 8px;">Poorten: eth1, eth2, eth3, eth4</span>
              </div>
              <span style="background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb; font-size: 11px; padding: 2px 8px; border-radius: 12px;">Statisch IP</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div>
                <label style="display:block; font-size: 12px; color: #c9d1d9; font-weight: 600; margin-bottom: 4px;">IPv4-Adres:</label>
                <input type="text" id="luciLanIp_${device.id}" value="${lanIp}" style="width: 100%; background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 6px 10px; border-radius: 4px; box-sizing: border-box;">
              </div>
              <div>
                <label style="display:block; font-size: 12px; color: #c9d1d9; font-weight: 600; margin-bottom: 4px;">IPv4-Netmask:</label>
                <input type="text" id="luciLanMask_${device.id}" value="${lanMask}" style="width: 100%; background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 6px 10px; border-radius: 4px; box-sizing: border-box;">
              </div>
            </div>

            <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
              <button onclick="window.OpenWrtLuciApp.saveLanSettings('${device.id}')" style="background: #238636; color: white; border: none; padding: 7px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">💾 Save &amp; Apply (Opslaan)</button>
            </div>
          </div>

          <!-- WAN Card -->
          <div style="background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-bottom: 12px;">
              <div>
                <strong style="color: #58a6ff; font-size: 15px;">🌐 WAN (eth0)</strong>
                <span style="font-size: 11px; color: #8b949e; margin-left: 8px;">Uplink naar ISP / Internet</span>
              </div>
              <span style="background: #23863622; color: #3fb950; border: 1px solid #238636; font-size: 11px; padding: 2px 8px; border-radius: 12px;">DHCP Client</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div>
                <label style="display:block; font-size: 12px; color: #c9d1d9; font-weight: 600; margin-bottom: 4px;">WAN IP Adres:</label>
                <input type="text" id="luciWanIp_${device.id}" value="${wanIp}" style="width: 100%; background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 6px 10px; border-radius: 4px; box-sizing: border-box;">
              </div>
              <div>
                <label style="display:block; font-size: 12px; color: #c9d1d9; font-weight: 600; margin-bottom: 4px;">WAN Gateway:</label>
                <input type="text" id="luciWanGw_${device.id}" value="${device.defaultGateway || '198.51.100.1'}" style="width: 100%; background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 6px 10px; border-radius: 4px; box-sizing: border-box;">
              </div>
            </div>

            <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
              <button onclick="window.OpenWrtLuciApp.saveWanSettings('${device.id}')" style="background: #238636; color: white; border: none; padding: 7px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">💾 Save &amp; Apply</button>
            </div>
          </div>
        </div>
      `;
    }

    if (subTab === 'dhcp') {
      const dhcp = cfg.dhcp || { start: 100, limit: 150, leasetime: '12h' };
      return `
        <div style="max-width: 900px; margin: 0 auto;">
          <h3 style="margin-top:0; color:#58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 8px;">Network &raquo; DHCP and DNS (dnsmasq)</h3>
          
          <div style="background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 10px; color: #e6edf3;">Dnsmasq DHCP Server Settings</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 12px; color: #8b949e;">Start IP:</label>
                <input type="number" id="luciDhcpStart_${device.id}" value="${dhcp.start || 100}" style="width:100%; background:#0d1117; border:1px solid #30363d; color:#e6edf3; padding:6px; border-radius:4px;">
              </div>
              <div>
                <label style="font-size: 12px; color: #8b949e;">Max Leases (Limit):</label>
                <input type="number" id="luciDhcpLimit_${device.id}" value="${dhcp.limit || 150}" style="width:100%; background:#0d1117; border:1px solid #30363d; color:#e6edf3; padding:6px; border-radius:4px;">
              </div>
              <div>
                <label style="font-size: 12px; color: #8b949e;">Lease Time:</label>
                <input type="text" id="luciDhcpTime_${device.id}" value="${dhcp.leasetime || '12h'}" style="width:100%; background:#0d1117; border:1px solid #30363d; color:#e6edf3; padding:6px; border-radius:4px;">
              </div>
            </div>
            <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
              <button onclick="window.OpenWrtLuciApp.saveDhcpSettings('${device.id}')" style="background: #238636; color: white; border: none; padding: 6px 14px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">💾 Instellingen Opslaan</button>
            </div>
          </div>

          <div style="background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px;">
            <h4 style="margin: 0 0 10px; color: #e6edf3;">Actieve DHCP Leases</h4>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #30363d; color: #8b949e; text-align: left;">
                  <th style="padding: 6px;">Hostname</th><th>IPv4 Adres</th><th>MAC Adres</th><th>Geldig Tot</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style="padding:6px; color:#58a6ff; font-weight:bold;">PC-1</td><td>192.168.1.142</td><td><code>00:50:79:66:68:01</code></td><td>11h 48m</td></tr>
                <tr><td style="padding:6px; color:#58a6ff; font-weight:bold;">Laptop-PT</td><td>192.168.1.189</td><td><code>00:50:79:66:68:02</code></td><td>9h 12m</td></tr>
                <tr><td style="padding:6px; color:#58a6ff; font-weight:bold;">Server-Web</td><td>192.168.1.200</td><td><code>00:50:79:66:68:03</code></td><td>12h 00m (Static)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (subTab === 'firewall') {
      return `
        <div style="max-width: 900px; margin: 0 auto;">
          <h3 style="margin-top:0; color:#58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 8px;">Network &raquo; Firewall (Zone Settings &amp; NAT)</h3>
          <div style="background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px;">
            <h4 style="margin: 0 0 10px; color: #e6edf3;">Firewall Zones</h4>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #30363d; color: #8b949e; text-align: left;">
                  <th style="padding: 6px;">Zone</th><th>Input</th><th>Output</th><th>Forward</th><th>Masquerading (NAT)</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #30363d;">
                  <td style="padding: 8px 6px; font-weight: bold; color: #3fb950;">🟢 lan &raquo; wan</td>
                  <td><span style="color:#3fb950;">ACCEPT</span></td>
                  <td><span style="color:#3fb950;">ACCEPT</span></td>
                  <td><span style="color:#3fb950;">ACCEPT</span></td>
                  <td><span style="color:#8b949e;">Uit (Niet nodig op LAN)</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 6px; font-weight: bold; color: #f85149;">🔴 wan &raquo; REJECT</td>
                  <td><span style="color:#f85149;">REJECT</span></td>
                  <td><span style="color:#3fb950;">ACCEPT</span></td>
                  <td><span style="color:#f85149;">REJECT</span></td>
                  <td><span style="color:#3fb950; font-weight: bold;">● Ingeschakeld (Masquerade)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (subTab === 'system') {
      return `
        <div style="max-width: 900px; margin: 0 auto;">
          <h3 style="margin-top:0; color:#58a6ff; border-bottom: 1px solid #30363d; padding-bottom: 8px;">System &raquo; System (Algemene Eigenschappen)</h3>
          <div style="background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px;">
            <div style="margin-bottom: 14px;">
              <label style="display:block; font-size: 12px; color: #c9d1d9; font-weight: 600; margin-bottom: 4px;">Hostname:</label>
              <input type="text" id="luciHostnameInput_${device.id}" value="${device.hostname}" style="width: 100%; max-width: 320px; background: #0d1117; border: 1px solid #30363d; color: #e6edf3; padding: 6px 10px; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 14px;">
              <label style="display:block; font-size: 12px; color: #c9d1d9; font-weight: 600; margin-bottom: 4px;">Timezone:</label>
              <span style="color:#8b949e; font-size:12px;">Europe/Brussels (CET, +0100)</span>
            </div>
            <button onclick="window.OpenWrtLuciApp.saveSystemSettings('${device.id}')" style="background: #238636; color: white; border: none; padding: 7px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">💾 Opslaan</button>
          </div>
        </div>
      `;
    }

    // Default: 'status' (Overview Dashboard)
    return `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 1100px; margin: 0 auto;">
        <!-- System Box -->
        <div style="background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px;">
          <h4 style="margin: 0 0 12px; color: #58a6ff; font-size: 13px; border-bottom: 1px solid #30363d; padding-bottom: 6px;">System Information</h4>
          <table style="width: 100%; font-size: 12px; line-height: 1.9;">
            <tr><td style="color:#8b949e; width: 140px;">Hostname:</td><td><strong>${device.hostname}</strong></td></tr>
            <tr><td style="color:#8b949e;">Model:</td><td>${cfg.model}</td></tr>
            <tr><td style="color:#8b949e;">Architecture:</td><td>${cfg.architecture}</td></tr>
            <tr><td style="color:#8b949e;">Firmware:</td><td>${cfg.firmware}</td></tr>
            <tr><td style="color:#8b949e;">Kernel Version:</td><td>${cfg.kernel}</td></tr>
            <tr><td style="color:#8b949e;">Local Time:</td><td>${new Date().toLocaleString()}</td></tr>
            <tr><td style="color:#8b949e;">Uptime:</td><td>${cfg.uptime}</td></tr>
            <tr><td style="color:#8b949e;">Load Average:</td><td>${cfg.loadAvg}</td></tr>
          </table>
        </div>

        <!-- Memory & Flash Storage Box -->
        <div style="background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h4 style="margin: 0 0 12px; color: #58a6ff; font-size: 13px; border-bottom: 1px solid #30363d; padding-bottom: 6px;">Memory &amp; Storage</h4>
            <div style="margin-bottom: 12px;">
              <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                <span>Total Available RAM:</span>
                <strong style="color:#3fb950;">52 MB / 128 MB (41%)</strong>
              </div>
              <div style="background:#0d1117; height:8px; border-radius:4px; overflow:hidden;">
                <div style="background:#238636; width:41%; height:100%;"></div>
              </div>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                <span>Flash Rootfs:</span>
                <strong style="color:#58a6ff;">4.2 MB / 16 MB (26%)</strong>
              </div>
              <div style="background:#0d1117; height:8px; border-radius:4px; overflow:hidden;">
                <div style="background:#1f6feb; width:26%; height:100%;"></div>
              </div>
            </div>
          </div>

          <div style="background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 10px; margin-top: 14px;">
            <div style="color: #00ffff; font-weight: bold; font-size: 11px; margin-bottom: 4px;">💡 PXL Tip: LuCI WebGUI</div>
            <div style="font-size: 11px; color: #8b949e;">Je kan deze router vanaf elke PC of Laptop via de Web Browser bereiken op <code>http://${lanIp}</code>.</div>
          </div>
        </div>

        <!-- Network Interfaces Overview (Full Width) -->
        <div style="grid-column: 1 / -1; background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px;">
          <h4 style="margin: 0 0 12px; color: #58a6ff; font-size: 13px; border-bottom: 1px solid #30363d; padding-bottom: 6px;">Active Network Interfaces</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- LAN Card -->
            <div style="background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
                <strong style="color: #3fb950; font-size: 13px;">🟢 LAN (br-lan)</strong>
                <span style="background: #23863622; color: #3fb950; border: 1px solid #238636; font-size: 10px; padding: 1px 6px; border-radius: 10px;">UP</span>
              </div>
              <div style="font-size: 12px; line-height: 1.8;">
                <div><span style="color:#8b949e;">IP Address:</span> <strong>${lanIp}</strong></div>
                <div><span style="color:#8b949e;">Netmask:</span> ${lanMask}</div>
                <div><span style="color:#8b949e;">Bridge Ports:</span> eth1, eth2, eth3, eth4</div>
                <div><span style="color:#8b949e;">RX / TX Packets:</span> 1,429 / 1,894</div>
              </div>
            </div>

            <!-- WAN Card -->
            <div style="background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
                <strong style="color: #58a6ff; font-size: 13px;">🌐 WAN (eth0)</strong>
                <span style="background: #1f6feb22; color: #58a6ff; border: 1px solid #1f6feb; font-size: 10px; padding: 1px 6px; border-radius: 10px;">UP</span>
              </div>
              <div style="font-size: 12px; line-height: 1.8;">
                <div><span style="color:#8b949e;">IP Address:</span> <strong>${wanIp}</strong></div>
                <div><span style="color:#8b949e;">Type:</span> DHCP client</div>
                <div><span style="color:#8b949e;">Gateway:</span> ${device.defaultGateway || '198.51.100.1'}</div>
                <div><span style="color:#8b949e;">DNS Server:</span> 8.8.8.8, 1.1.1.1</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const OpenWrtLuciApp = {
    activeSubTabs: {},

    renderLuciHtml(device, sim, activeSubTab = 'status') {
      return renderOpenWrtLuciHtml(device, sim, activeSubTab);
    },

    renderLuci(device, container, activeSubTab = 'status') {
      if (!container) return;
      container.innerHTML = renderOpenWrtLuciHtml(device, window.PXLApp?.sim, activeSubTab);
    },

    switchSubTab(devId, subTab) {
      this.activeSubTabs[devId] = subTab;
      const dev = window.PXLApp?.sim?.devices[devId];
      if (!dev) return;
      const container = document.getElementById(`luciContentArea_${devId}`);
      if (container) {
        const cfg = initOpenWrtConfig(dev);
        const lanIp = getLanIp(dev);
        const lanMask = getLanMask(dev);
        const wanIp = getWanIp(dev);
        container.innerHTML = renderLuciSubTabContent(dev, cfg, subTab, lanIp, lanMask, wanIp);

        // Update tab buttons active class
        const modalContainer = container.closest('.luci-container');
        if (modalContainer) {
          modalContainer.querySelectorAll('.luci-tab-btn').forEach(btn => {
            const isMatch = btn.textContent.toLowerCase().includes(subTab);
            btn.style.cssText = getTabStyle(isMatch);
          });
        }
      }
    },

    saveLanSettings(devId) {
      const dev = window.PXLApp?.sim?.devices[devId];
      if (!dev) return;
      const ipInput = document.getElementById(`luciLanIp_${devId}`);
      const maskInput = document.getElementById(`luciLanMask_${devId}`);
      if (ipInput && ipInput.value) {
        const newIp = ipInput.value.trim();
        const newMask = maskInput ? maskInput.value.trim() : '255.255.255.0';
        if (dev.interfaces['eth1']) {
          dev.interfaces['eth1'].ip = newIp;
          dev.interfaces['eth1'].mask = newMask;
        }
        if (dev.interfaces['br-lan']) {
          dev.interfaces['br-lan'].ip = newIp;
          dev.interfaces['br-lan'].mask = newMask;
        }
        dev.ip = newIp;
        dev.mask = newMask;

        if (window.PXLApp) {
          window.PXLApp.canvasWorkspace.render();
          window.PXLApp.triggerScoreUpdate();
          window.PXLApp.showToast(`✅ OpenWrt LAN IP ingesteld op ${newIp} (${newMask})`);
        }
        this.switchSubTab(devId, 'status');
      }
    },

    saveWanSettings(devId) {
      const dev = window.PXLApp?.sim?.devices[devId];
      if (!dev) return;
      const ipInput = document.getElementById(`luciWanIp_${devId}`);
      const gwInput = document.getElementById(`luciWanGw_${devId}`);
      if (ipInput && ipInput.value) {
        const newIp = ipInput.value.trim();
        if (dev.interfaces['eth0']) {
          dev.interfaces['eth0'].ip = newIp;
        }
        if (gwInput && gwInput.value) {
          dev.defaultGateway = gwInput.value.trim();
        }
        if (window.PXLApp) {
          window.PXLApp.canvasWorkspace.render();
          window.PXLApp.triggerScoreUpdate();
          window.PXLApp.showToast(`✅ OpenWrt WAN IP ingesteld op ${newIp}`);
        }
        this.switchSubTab(devId, 'status');
      }
    },

    saveDhcpSettings(devId) {
      const dev = window.PXLApp?.sim?.devices[devId];
      if (!dev) return;
      const cfg = initOpenWrtConfig(dev);
      const startEl = document.getElementById(`luciDhcpStart_${devId}`);
      const limitEl = document.getElementById(`luciDhcpLimit_${devId}`);
      const timeEl = document.getElementById(`luciDhcpTime_${devId}`);
      if (startEl) cfg.dhcp.start = parseInt(startEl.value) || 100;
      if (limitEl) cfg.dhcp.limit = parseInt(limitEl.value) || 150;
      if (timeEl) cfg.dhcp.leasetime = timeEl.value || '12h';

      if (window.PXLApp) {
        window.PXLApp.showToast('✅ OpenWrt DHCP instellingen opgeslagen.');
      }
    },

    saveSystemSettings(devId) {
      const dev = window.PXLApp?.sim?.devices[devId];
      if (!dev) return;
      const hostInput = document.getElementById(`luciHostnameInput_${devId}`);
      if (hostInput && hostInput.value.trim()) {
        dev.hostname = hostInput.value.trim();
        if (window.PXLApp) {
          window.PXLApp.canvasWorkspace.render();
          window.PXLApp.triggerScoreUpdate();
          window.PXLApp.showToast(`✅ OpenWrt hostname gewijzigd naar '${dev.hostname}'`);
        }
        this.switchSubTab(devId, 'status');
      }
    }
  };

  window.renderOpenWrtLuciHtml = renderOpenWrtLuciHtml;
  window.OpenWrtLuciApp = OpenWrtLuciApp;

})();
