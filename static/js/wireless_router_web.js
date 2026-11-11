/**
 * wireless_router_web.js - Web Management Interfaces for Cisco WRT300N and Cisco 3504 WLC
 * Matches SNE Networks 1 (Hogeschool PXL) Enterprise Wireless Lab
 */

(function(window) {
  'use strict';

  let wrtActiveTab = 'setup';
  let wlcActiveTab = 'monitor';

  // --- 1. CISCO LINKSYS WRT300N WEB MANAGEMENT INTERFACE ---
  function renderWrtWebInterfaceHtml(device, sim) {
    if (!device) return '<div style="color:red; padding:20px;">Geen apparaat geselecteerd.</div>';
    const cfg = device.wrtConfig || {
      model: 'WRT300N',
      lanIp: '192.168.0.1',
      lanMask: '255.255.255.0',
      dhcpEnabled: true,
      dhcpStartIp: '192.168.0.100',
      dhcpMaxUsers: 50,
      dns: '8.8.8.8',
      wanType: 'dhcp'
    };
    const w = device.wireless || { ssid: 'PXL-Wireless-Router', authMode: 'WPA2-PSK', passphrase: 'PXL2026Net!', channel: 6 };

    return `
      <div style="font-family: Arial, sans-serif; background: #0c4a6e; border: 2px solid #0284c7; border-radius: 8px; overflow: hidden; color: #333; max-width: 820px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <!-- Top Blue Header -->
        <div style="background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%); color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f59e0b;">
          <div>
            <span style="font-size: 20px; font-weight: 900; letter-spacing: 1px;">LINKSYS</span>
            <span style="font-size: 13px; margin-left: 8px; color: #bae6fd;">A Division of Cisco Systems, Inc.</span>
          </div>
          <div style="text-align: right; font-size: 11px;">
            <div style="font-weight: bold; color: #f8fafc;">Wireless-N Broadband Router</div>
            <div style="color: #93c5fd;">Model: WRT300N (PXL Edition)</div>
          </div>
        </div>

        <!-- Navigation Tabs Bar -->
        <div style="background: #1e293b; display: flex; border-bottom: 2px solid #334155;">
          <button class="pt-btn" onclick="window.PXLWrtWeb.switchTab('setup', '${device.id}')" style="background: ${wrtActiveTab === 'setup' ? '#f59e0b' : '#334155'}; color: ${wrtActiveTab === 'setup' ? '#000' : '#fff'}; border: none; font-weight: bold; padding: 8px 18px; cursor: pointer;">
            Setup
          </button>
          <button class="pt-btn" onclick="window.PXLWrtWeb.switchTab('wireless', '${device.id}')" style="background: ${wrtActiveTab === 'wireless' ? '#f59e0b' : '#334155'}; color: ${wrtActiveTab === 'wireless' ? '#000' : '#fff'}; border: none; font-weight: bold; padding: 8px 18px; cursor: pointer;">
            Wireless
          </button>
          <button class="pt-btn" onclick="window.PXLWrtWeb.switchTab('security', '${device.id}')" style="background: ${wrtActiveTab === 'security' ? '#f59e0b' : '#334155'}; color: ${wrtActiveTab === 'security' ? '#000' : '#fff'}; border: none; font-weight: bold; padding: 8px 18px; cursor: pointer;">
            Wireless Security
          </button>
          <button class="pt-btn" onclick="window.PXLWrtWeb.switchTab('status', '${device.id}')" style="background: ${wrtActiveTab === 'status' ? '#f59e0b' : '#334155'}; color: ${wrtActiveTab === 'status' ? '#000' : '#fff'}; border: none; font-weight: bold; padding: 8px 18px; cursor: pointer;">
            Status
          </button>
        </div>

        <!-- Tab Body -->
        <div style="background: #f8fafc; padding: 20px; color: #1e293b; font-size: 12px; min-height: 380px;">
          ${wrtActiveTab === 'setup' ? `
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">Internet Setup (WAN)</h3>
              <table style="width: 100%; font-size: 12px;">
                <tr>
                  <td style="width: 200px; font-weight: bold; padding: 6px 0;">Internet Connection Type:</td>
                  <td>
                    <select id="wrtWanType" class="pt-input" style="width: 220px;">
                      <option value="dhcp" ${cfg.wanType === 'dhcp' ? 'selected' : ''}>Automatic Configuration - DHCP</option>
                      <option value="static" ${cfg.wanType === 'static' ? 'selected' : ''}>Static IP</option>
                    </select>
                  </td>
                </tr>
              </table>
            </div>

            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">Network Setup (LAN & DHCP)</h3>
              <table style="width: 100%; font-size: 12px; line-height: 2;">
                <tr>
                  <td style="width: 200px; font-weight: bold;">Router IP Address:</td>
                  <td><input type="text" id="wrtLanIp" class="pt-input" value="${cfg.lanIp || '192.168.0.1'}" style="width: 160px;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Subnet Mask:</td>
                  <td><input type="text" id="wrtLanMask" class="pt-input" value="${cfg.lanMask || '255.255.255.0'}" style="width: 160px;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">DHCP Server:</td>
                  <td>
                    <label style="margin-right: 15px;"><input type="radio" name="wrtDhcp" value="1" ${cfg.dhcpEnabled ? 'checked' : ''}> Enabled</label>
                    <label><input type="radio" name="wrtDhcp" value="0" ${!cfg.dhcpEnabled ? 'checked' : ''}> Disabled</label>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Starting IP Address:</td>
                  <td><input type="text" id="wrtStartIp" class="pt-input" value="${cfg.dhcpStartIp || '192.168.0.100'}" style="width: 160px;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Maximum Number of Users:</td>
                  <td><input type="number" id="wrtMaxUsers" class="pt-input" value="${cfg.dhcpMaxUsers || 50}" style="width: 80px;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Static DNS 1:</td>
                  <td><input type="text" id="wrtDns" class="pt-input" value="${cfg.dns || '8.8.8.8'}" style="width: 160px;"></td>
                </tr>
              </table>
            </div>
          ` : wrtActiveTab === 'wireless' ? `
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">Basic Wireless Settings</h3>
              <table style="width: 100%; font-size: 12px; line-height: 2;">
                <tr>
                  <td style="width: 220px; font-weight: bold;">Wireless Network Mode:</td>
                  <td>
                    <select class="pt-input" style="width: 180px;">
                      <option>Mixed (802.11b/g/n)</option>
                      <option>Wireless-N Only</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Wireless Network Name (SSID):</td>
                  <td><input type="text" id="wrtSsid" class="pt-input" value="${w.ssid || 'PXL-Wireless-Router'}" style="width: 220px; font-weight: bold;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Wireless Channel Width:</td>
                  <td>
                    <select id="wrtChanWidth" class="pt-input" style="width: 180px;">
                      <option value="20" ${w.channelWidth === 20 ? 'selected' : ''}>Standard - 20MHz Channel</option>
                      <option value="40" ${w.channelWidth === 40 ? 'selected' : ''}>Auto - 20/40MHz Channel</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Wireless Channel:</td>
                  <td>
                    <select id="wrtChannel" class="pt-input" style="width: 220px;">
                      <option value="1" ${w.channel === 1 ? 'selected' : ''}>1 - 2.412 GHz (PXL Best Practice)</option>
                      <option value="6" ${w.channel === 6 ? 'selected' : ''}>6 - 2.437 GHz (PXL Best Practice)</option>
                      <option value="11" ${w.channel === 11 ? 'selected' : ''}>11 - 2.462 GHz (PXL Best Practice)</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">SSID Broadcast:</td>
                  <td>
                    <label style="margin-right: 15px;"><input type="radio" name="wrtBcast" value="1" checked> Enabled</label>
                    <label><input type="radio" name="wrtBcast" value="0"> Disabled</label>
                  </td>
                </tr>
              </table>
            </div>
          ` : wrtActiveTab === 'security' ? `
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">Wireless Security</h3>
              <table style="width: 100%; font-size: 12px; line-height: 2;">
                <tr>
                  <td style="width: 220px; font-weight: bold;">Security Mode:</td>
                  <td>
                    <select id="wrtSecMode" class="pt-input" style="width: 220px;">
                      <option value="WPA2-PSK" ${w.authMode === 'WPA2-PSK' ? 'selected' : ''}>WPA2-Personal (AES)</option>
                      <option value="WPA3-SAE" ${w.authMode === 'WPA3-SAE' ? 'selected' : ''}>WPA3-Personal (SAE)</option>
                      <option value="Open" ${w.authMode === 'Open' ? 'selected' : ''}>Disabled (Open Network)</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">WPA Encryption:</td>
                  <td><strong>AES</strong> (Advanced Encryption Standard)</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Passphrase / Pre-Shared Key:</td>
                  <td><input type="text" id="wrtPass" class="pt-input" value="${w.passphrase || 'PXL2026Net!'}" style="width: 220px; font-weight: bold;"></td>
                </tr>
              </table>
            </div>
          ` : `
            <!-- Tab 4: STATUS -->
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; line-height: 1.8;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">Router Status Overview</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div>
                  <h4 style="margin: 6px 0; color: #0284c7;">Internet Status</h4>
                  <div>Configuration Type: <strong>Automatic (DHCP)</strong></div>
                  <div>Internet IP: <strong>${device.interfaces['Internet']?.ip || 'Connected via DHCP'}</strong></div>
                  <div>Subnet Mask: <strong>255.255.255.0</strong></div>
                  <div>Default Gateway: <strong>10.0.0.1</strong></div>
                  <div>DNS 1: <strong>8.8.8.8</strong></div>
                </div>
                <div>
                  <h4 style="margin: 6px 0; color: #0284c7;">Local Wireless Network</h4>
                  <div>Router LAN IP: <strong>${cfg.lanIp || '192.168.0.1'}</strong></div>
                  <div>DHCP Server: <strong>${cfg.dhcpEnabled ? 'Active (Lease pool ready)' : 'Disabled'}</strong></div>
                  <div>Wireless Radio: <strong>Enabled (2.4GHz / 5GHz)</strong></div>
                  <div>Network Name (SSID): <strong>${w.ssid}</strong></div>
                  <div>Channel: <strong>${w.channel} (20MHz)</strong></div>
                  <div>Security: <strong>${w.authMode} (AES)</strong></div>
                </div>
              </div>
            </div>
          `}

          <!-- Bottom Action Buttons -->
          <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
            <button class="pt-btn pt-btn-secondary" onclick="window.PXLWrtWeb.switchTab('${wrtActiveTab}', '${device.id}')">Annuleren</button>
            <button class="pt-btn pt-btn-primary" onclick="window.PXLWrtWeb.saveConfig('${device.id}')" style="background: #0284c7; font-weight: bold;">Instellingen Opslaan (Save Settings)</button>
          </div>
        </div>
      </div>
    `;
  }

  // --- 2. CISCO 3504 WIRELESS LAN CONTROLLER (WLC) WEB GUI ---
  function renderWlcWebInterfaceHtml(device, sim) {
    if (!device) return '<div style="color:red; padding:20px;">Geen apparaat geselecteerd.</div>';
    const cfg = device.wlcConfig || {
      model: '3504',
      mgmtIp: '10.10.0.254',
      interfaces: {},
      wlans: []
    };

    return `
      <div style="font-family: Arial, sans-serif; background: #0f172a; border: 2px solid #0284c7; border-radius: 8px; overflow: hidden; color: #f8fafc; max-width: 860px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
        <!-- Cisco WLC Top Navy Blue Header -->
        <div style="background: #0c4a6e; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: #0284c7; color: white; font-weight: 900; font-size: 14px; padding: 4px 8px; border-radius: 4px;">CISCO</div>
            <span style="font-size: 16px; font-weight: 700; color: #f8fafc;">3504 Wireless LAN Controller</span>
          </div>
          <div style="font-size: 11px; color: #94a3b8;">
            Logged in as: <strong style="color: #38bdf8;">admin</strong> | Hostname: <strong style="color: #f8fafc;">${device.hostname}</strong>
          </div>
        </div>

        <!-- WLC Main Horizontal Navigation Bar -->
        <div style="background: #1e293b; display: flex; border-bottom: 1px solid #334155;">
          <button class="pt-btn" onclick="window.PXLWlcWeb.switchTab('monitor', '${device.id}')" style="background: ${wlcActiveTab === 'monitor' ? '#0284c7' : 'transparent'}; color: white; border: none; font-weight: bold; padding: 9px 18px; cursor: pointer;">
            MONITOR
          </button>
          <button class="pt-btn" onclick="window.PXLWlcWeb.switchTab('wlans', '${device.id}')" style="background: ${wlcActiveTab === 'wlans' ? '#0284c7' : 'transparent'}; color: white; border: none; font-weight: bold; padding: 9px 18px; cursor: pointer;">
            WLANs
          </button>
          <button class="pt-btn" onclick="window.PXLWlcWeb.switchTab('controller', '${device.id}')" style="background: ${wlcActiveTab === 'controller' ? '#0284c7' : 'transparent'}; color: white; border: none; font-weight: bold; padding: 9px 18px; cursor: pointer;">
            CONTROLLER
          </button>
          <button class="pt-btn" onclick="window.PXLWlcWeb.switchTab('wireless', '${device.id}')" style="background: ${wlcActiveTab === 'wireless' ? '#0284c7' : 'transparent'}; color: white; border: none; font-weight: bold; padding: 9px 18px; cursor: pointer;">
            WIRELESS (APs)
          </button>
        </div>

        <!-- WLC Tab Content -->
        <div style="padding: 20px; font-size: 12px; min-height: 380px;">
          ${wlcActiveTab === 'monitor' ? `
            <h3 style="margin-top: 0; color: #38bdf8; font-size: 14px;">Controller Summary</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 14px;">
                <h4 style="margin: 0 0 10px 0; color: #f8fafc; font-size: 12px; border-bottom: 1px solid #334155; padding-bottom: 4px;">Hardware & Software</h4>
                <table style="width: 100%; font-size: 11px; line-height: 2;">
                  <tr><td style="color:#94a3b8;">Controller Model:</td><td><strong>AIR-CT3504-K9</strong></td></tr>
                  <tr><td style="color:#94a3b8;">Software Version:</td><td><strong>8.5.140.0</strong></td></tr>
                  <tr><td style="color:#94a3b8;">Management IP:</td><td style="color:#38bdf8; font-weight:bold;">${cfg.mgmtIp}</td></tr>
                  <tr><td style="color:#94a3b8;">System Up Time:</td><td>4 days, 12 hours</td></tr>
                </table>
              </div>

              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 14px;">
                <h4 style="margin: 0 0 10px 0; color: #f8fafc; font-size: 12px; border-bottom: 1px solid #334155; padding-bottom: 4px;">Wireless Statistics</h4>
                <table style="width: 100%; font-size: 11px; line-height: 2;">
                  <tr><td style="color:#94a3b8;">Configured WLANs:</td><td><strong>${cfg.wlans.length} active</strong></td></tr>
                  <tr><td style="color:#94a3b8;">Registered Access Points:</td><td style="color:#22c55e; font-weight:bold;">1 Online (LAP-PT)</td></tr>
                  <tr><td style="color:#94a3b8;">Associated Clients:</td><td style="color:#38bdf8; font-weight:bold;">${sim ? Object.keys(sim.wirelessAssociations).length : 0} clients</td></tr>
                  <tr><td style="color:#94a3b8;">Operational State:</td><td><span style="background:#064e3b; color:#34d399; padding:2px 6px; border-radius:4px;">Normal</span></td></tr>
                </table>
              </div>
            </div>
          ` : wlcActiveTab === 'wlans' ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="margin: 0; color: #38bdf8; font-size: 14px;">WLANs (Wireless Local Area Networks)</h3>
              <button class="pt-btn pt-btn-primary" onclick="window.PXLWlcWeb.createWlanPrompt('${device.id}')" style="font-size: 11px; padding: 5px 12px;">+ Create New WLAN</button>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; background: #1e293b; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr style="background: #0f172a; color: #94a3b8; font-size: 10px; text-transform: uppercase;">
                  <th style="padding: 8px 12px;">WLAN ID</th>
                  <th style="padding: 8px 12px;">Profile Name</th>
                  <th style="padding: 8px 12px;">SSID</th>
                  <th style="padding: 8px 12px;">Status</th>
                  <th style="padding: 8px 12px;">Interface / VLAN Mapping</th>
                  <th style="padding: 8px 12px;">Security Policies</th>
                </tr>
              </thead>
              <tbody>
                ${cfg.wlans.map(wlan => `
                  <tr style="border-top: 1px solid #334155;">
                    <td style="padding: 10px 12px;">${wlan.id}</td>
                    <td style="padding: 10px 12px; font-weight: bold; color: #38bdf8;">${wlan.profile}</td>
                    <td style="padding: 10px 12px; font-weight: bold; color: #f8fafc;">${wlan.ssid}</td>
                    <td style="padding: 10px 12px;">
                      <span style="background: #064e3b; color: #34d399; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${wlan.status}</span>
                    </td>
                    <td style="padding: 10px 12px; color: #facc15; font-weight: bold;">
                      ${wlan.intf} (VLAN ${wlan.vlan})
                    </td>
                    <td style="padding: 10px 12px;">
                      ${wlan.authMode === 'Open' ? '<span style="color:#94a3b8;">None (Open)</span>' : `[WPA2-PSK] AES (${wlan.passphrase})`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : wlcActiveTab === 'controller' ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="margin: 0; color: #38bdf8; font-size: 14px;">Controller Interfaces (VLAN & IP Mapping)</h3>
              <button class="pt-btn pt-btn-secondary" style="font-size: 11px; padding: 5px 12px;">+ New Interface...</button>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; background: #1e293b; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr style="background: #0f172a; color: #94a3b8; font-size: 10px; text-transform: uppercase;">
                  <th style="padding: 8px 12px;">Interface Name</th>
                  <th style="padding: 8px 12px;">VLAN ID</th>
                  <th style="padding: 8px 12px;">IP Address</th>
                  <th style="padding: 8px 12px;">Netmask</th>
                  <th style="padding: 8px 12px;">Gateway</th>
                  <th style="padding: 8px 12px;">Primary DHCP</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(cfg.interfaces).map(intf => `
                  <tr style="border-top: 1px solid #334155;">
                    <td style="padding: 10px 12px; font-weight: bold; color: #38bdf8;">${intf.name}</td>
                    <td style="padding: 10px 12px; font-weight: bold; color: #facc15;">VLAN ${intf.vlan}</td>
                    <td style="padding: 10px 12px; font-family: monospace;">${intf.ip}</td>
                    <td style="padding: 10px 12px; font-family: monospace;">${intf.mask}</td>
                    <td style="padding: 10px 12px; font-family: monospace;">${intf.gateway}</td>
                    <td style="padding: 10px 12px; font-family: monospace;">${intf.dhcpServer || intf.gateway}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <!-- Tab 4: WIRELESS (APs) -->
            <h3 style="margin-top: 0; color: #38bdf8; font-size: 14px;">All Registered Cisco Lightweight Access Points</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; background: #1e293b; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr style="background: #0f172a; color: #94a3b8; font-size: 10px; text-transform: uppercase;">
                  <th style="padding: 8px 12px;">AP Name</th>
                  <th style="padding: 8px 12px;">Model</th>
                  <th style="padding: 8px 12px;">IP Address</th>
                  <th style="padding: 8px 12px;">MAC Address</th>
                  <th style="padding: 8px 12px;">Administrative Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-top: 1px solid #334155;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #38bdf8;">LAP1 (Campus AP)</td>
                  <td style="padding: 10px 12px;">AIR-LAP1142N</td>
                  <td style="padding: 10px 12px; font-family: monospace;">10.10.0.100 (DHCP Lease)</td>
                  <td style="padding: 10px 12px; font-family: monospace;">0021.d8aa.3344</td>
                  <td style="padding: 10px 12px;"><span style="background: #064e3b; color: #34d399; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Registered / CAPWAP Up</span></td>
                </tr>
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // Controller Actions
  window.PXLWrtWeb = {
    render: renderWrtWebInterfaceHtml,
    switchTab(tab, devId) {
      wrtActiveTab = tab;
      if (window.PXLApp && window.PXLApp.activeDevice && window.PXLApp.activeDevice.id === devId) {
        window.PXLApp.renderWrtWebTab();
      }
    },
    saveConfig(devId) {
      const sim = window.PXLNetworkSim;
      const dev = sim ? sim.devices[devId] : null;
      if (!dev) return;

      const lanIpInput = document.getElementById('wrtLanIp');
      const ssidInput = document.getElementById('wrtSsid');
      const passInput = document.getElementById('wrtPass');
      const secModeInput = document.getElementById('wrtSecMode');
      const chanInput = document.getElementById('wrtChannel');

      if (lanIpInput && dev.wrtConfig) dev.wrtConfig.lanIp = lanIpInput.value.trim();
      if (ssidInput && dev.wireless) dev.wireless.ssid = ssidInput.value.trim();
      if (passInput && dev.wireless) dev.wireless.passphrase = passInput.value.trim();
      if (secModeInput && dev.wireless) dev.wireless.authMode = secModeInput.value;
      if (chanInput && dev.wireless) dev.wireless.channel = parseInt(chanInput.value, 10);

      sim.updateWirelessAssociations();
      if (window.PXLApp) {
        window.PXLApp.showToast('💾 WRT300N instellingen succesvol opgeslagen!');
        window.PXLApp.canvasWorkspace.render();
        window.PXLApp.triggerScoreUpdate();
      }
    }
  };

  window.PXLWlcWeb = {
    render: renderWlcWebInterfaceHtml,
    switchTab(tab, devId) {
      wlcActiveTab = tab;
      if (window.PXLApp && window.PXLApp.activeDevice && window.PXLApp.activeDevice.id === devId) {
        window.PXLApp.renderWlcWebTab();
      }
    },
    createWlanPrompt(devId) {
      const ssid = prompt('Voer de gewenste SSID in voor het nieuwe WLAN:', 'PXL-Guest');
      if (!ssid) return;
      const sim = window.PXLNetworkSim;
      const dev = sim ? sim.devices[devId] : null;
      if (!dev || !dev.wlcConfig) return;

      const newId = dev.wlcConfig.wlans.length + 1;
      dev.wlcConfig.wlans.push({
        id: newId,
        profile: `WLAN-${ssid}`,
        ssid: ssid,
        status: 'Enabled',
        intf: 'int_guest',
        vlan: 30,
        authMode: 'Open',
        passphrase: ''
      });

      sim.updateWirelessAssociations();
      if (window.PXLApp) {
        window.PXLApp.showToast(`✅ WLAN '${ssid}' aangemaakt op WLC 3504!`);
        window.PXLApp.renderWlcWebTab();
        window.PXLApp.canvasWorkspace.render();
        window.PXLApp.triggerScoreUpdate();
      }
    }
  };

  // --- 3. CISCO AIRONET / STANDALONE AP WEB MANAGEMENT INTERFACE ---
  let apActiveTab = 'network';

  function renderApWebInterfaceHtml(device, sim) {
    if (!device) return '<div style="color:red; padding:20px;">Geen apparaat geselecteerd.</div>';
    if (!device.apConfig) {
      device.apConfig = {
        mode: 'autonomous',
        ip: '10.10.0.100',
        mask: '255.255.255.0',
        gateway: '10.10.0.1',
        dns: '8.8.8.8',
        webEnabled: true,
        webPort: 80,
        dhcpEnabled: true,
        dhcpPool: { startIp: '10.10.0.101', mask: '255.255.255.0', gateway: '10.10.0.100', dns: '8.8.8.8', maxUsers: 30 },
        dhcpLeases: [],
        authMode: 'WPA2-PSK',
        passphrase: 'PXL_Geheim2026!',
        radiusServer: '10.10.0.10',
        radiusSecret: 'PXL_Secret2026!'
      };
    }
    const cfg = device.apConfig;
    const w = device.wireless || { ssid: 'PXL-Klas-AP', authMode: 'WPA2-PSK', passphrase: 'PXL_Geheim2026!', channel: 6, band: '2.4GHz' };

    // Get connected clients
    const clients = [];
    if (sim && sim.wirelessAssociations) {
      for (const [clientId, apId] of Object.entries(sim.wirelessAssociations)) {
        if (apId === device.id) {
          const cDev = sim.devices[clientId];
          if (cDev) {
            clients.push({
              name: cDev.hostname || cDev.id,
              ip: cDev.ip || cDev.interfaces['Wireless0']?.ip || '10.10.0.x',
              mac: cDev.mac || cDev.interfaces['Wireless0']?.mac || '0050.79.xx',
              rssi: cDev.wireless?.rssi || -65,
              snr: cDev.wireless?.snr || 25,
              txRate: cDev.wireless?.txRate || 144
            });
          }
        }
      }
    }

    return `
      <div style="font-family: Arial, sans-serif; background: #0f172a; border: 2px solid #0284c7; border-radius: 8px; overflow: hidden; color: #333; max-width: 840px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <!-- Top Cisco Aironet Header -->
        <div style="background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%); color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #38bdf8;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">📡</span>
            <div>
              <span style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">CISCO AIRONET WEB MANAGEMENT</span>
              <div style="font-size: 11.5px; color: #bae6fd;">Cisco Autonomous Access Point OS &bull; Standalone Mode</div>
            </div>
          </div>
          <div style="text-align: right; font-size: 11px;">
            <div style="font-weight: bold; color: #f8fafc;">AP: ${device.hostname || 'AP-Klas'}</div>
            <div style="color: #93c5fd;">IP: ${cfg.ip || '10.10.0.100'} &bull; MAC: ${device.interfaces['GigabitEthernet0']?.mac || '0021.d8.e1.01'}</div>
          </div>
        </div>

        <!-- Navigation Tabs Bar -->
        <div style="background: #1e293b; display: flex; border-bottom: 2px solid #334155; flex-wrap: wrap;">
          <button class="pt-btn" onclick="window.PXLApWeb.switchTab('network', '${device.id}')" style="background: ${apActiveTab === 'network' ? '#0284c7' : '#334155'}; color: #fff; border: none; font-weight: bold; padding: 8px 16px; cursor: pointer;">
            🌐 Netwerk & DHCP
          </button>
          <button class="pt-btn" onclick="window.PXLApWeb.switchTab('wireless', '${device.id}')" style="background: ${apActiveTab === 'wireless' ? '#0284c7' : '#334155'}; color: #fff; border: none; font-weight: bold; padding: 8px 16px; cursor: pointer;">
            📶 Radio & SSID
          </button>
          <button class="pt-btn" onclick="window.PXLApWeb.switchTab('security', '${device.id}')" style="background: ${apActiveTab === 'security' ? '#0284c7' : '#334155'}; color: #fff; border: none; font-weight: bold; padding: 8px 16px; cursor: pointer;">
            🔒 Beveiliging & LDAP / 802.1X
          </button>
          <button class="pt-btn" onclick="window.PXLApWeb.switchTab('clients', '${device.id}')" style="background: ${apActiveTab === 'clients' ? '#0284c7' : '#334155'}; color: #fff; border: none; font-weight: bold; padding: 8px 16px; cursor: pointer;">
            👥 Verbonden Clients (${clients.length})
          </button>
          <button class="pt-btn" onclick="window.PXLApWeb.switchTab('guide', '${device.id}')" style="background: ${apActiveTab === 'guide' ? '#059669' : '#1e3a5f'}; color: #fff; border: none; font-weight: bold; padding: 8px 16px; cursor: pointer; margin-left: auto;">
            📖 Activatie Handleiding
          </button>
        </div>

        <!-- Tab Body -->
        <div style="background: #f8fafc; padding: 20px; color: #1e293b; font-size: 12px; min-height: 380px;">
          ${apActiveTab === 'network' ? `
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">AP Management Interface (BVI1 / GigabitEthernet0)</h3>
              <table style="width: 100%; font-size: 12px; line-height: 2;">
                <tr>
                  <td style="width: 200px; font-weight: bold;">Management IP Adres:</td>
                  <td><input type="text" id="apIpInput" class="pt-input" value="${cfg.ip || '10.10.0.100'}" style="width: 160px;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Subnet Mask:</td>
                  <td><input type="text" id="apMaskInput" class="pt-input" value="${cfg.mask || '255.255.255.0'}" style="width: 160px;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Default Gateway:</td>
                  <td><input type="text" id="apGwInput" class="pt-input" value="${cfg.gateway || '10.10.0.1'}" style="width: 160px;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">DNS Server:</td>
                  <td><input type="text" id="apDnsInput" class="pt-input" value="${cfg.dns || '8.8.8.8'}" style="width: 160px;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Web Management (HTTP):</td>
                  <td>
                    <label style="cursor: pointer;"><input type="checkbox" id="apWebEnabled" ${cfg.webEnabled !== false ? 'checked' : ''}> Ingeschakeld op poort 80 (HTTP Server)</label>
                  </td>
                </tr>
              </table>
            </div>

            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 4px; margin-bottom: 12px;">
                <h3 style="margin: 0; color: #0369a1; font-size: 14px;">Interne DHCP Server (Voor Draadloze Clients)</h3>
                <span style="background: ${cfg.dhcpEnabled ? '#dcfce7' : '#fee2e2'}; color: ${cfg.dhcpEnabled ? '#15803d' : '#991b1b'}; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 11px;">
                  ${cfg.dhcpEnabled ? '● DHCP ACTIEF' : '○ UITGESCHAKELD'}
                </span>
              </div>
              <table style="width: 100%; font-size: 12px; line-height: 2;">
                <tr>
                  <td style="width: 200px; font-weight: bold;">DHCP Server Status:</td>
                  <td>
                    <label style="margin-right: 15px; cursor: pointer;"><input type="radio" name="apDhcpToggle" value="1" ${cfg.dhcpEnabled ? 'checked' : ''} onchange="document.getElementById('apDhcpFields').style.display='table-row-group'"> Ingeschakeld</label>
                    <label style="cursor: pointer;"><input type="radio" name="apDhcpToggle" value="0" ${!cfg.dhcpEnabled ? 'checked' : ''} onchange="document.getElementById('apDhcpFields').style.display='none'"> Uitgeschakeld</label>
                  </td>
                </tr>
                <tbody id="apDhcpFields" style="display: ${cfg.dhcpEnabled ? 'table-row-group' : 'none'};">
                  <tr>
                    <td style="font-weight: bold;">Start IP Adres Pool:</td>
                    <td><input type="text" id="apDhcpStartIp" class="pt-input" value="${cfg.dhcpPool?.startIp || '10.10.0.101'}" style="width: 160px;"></td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold;">Subnet Mask:</td>
                    <td><input type="text" id="apDhcpMask" class="pt-input" value="${cfg.dhcpPool?.mask || '255.255.255.0'}" style="width: 160px;"></td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold;">Maximum Aantal Users:</td>
                    <td><input type="number" id="apDhcpMaxUsers" class="pt-input" value="${cfg.dhcpPool?.maxUsers || 30}" style="width: 80px;"></td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold;">Client Default Gateway:</td>
                    <td><input type="text" id="apDhcpGw" class="pt-input" value="${cfg.dhcpPool?.gateway || cfg.ip || '10.10.0.100'}" style="width: 160px;"></td>
                  </tr>
                </tbody>
              </table>

              ${cfg.dhcpLeases && cfg.dhcpLeases.length > 0 ? `
                <h4 style="margin: 16px 0 8px; color: #334155;">Actieve DHCP Leases (${cfg.dhcpLeases.length}):</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                  <thead>
                    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                      <th style="padding: 4px 8px;">IP Adres</th>
                      <th style="padding: 4px 8px;">MAC Adres</th>
                      <th style="padding: 4px 8px;">Hostname</th>
                      <th style="padding: 4px 8px;">Leasetijd</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${cfg.dhcpLeases.map(l => `
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 4px 8px; font-weight: bold; color: #0284c7;">${l.ip}</td>
                        <td style="padding: 4px 8px; font-family: monospace;">${l.mac}</td>
                        <td style="padding: 4px 8px;">${l.hostname || 'Client'}</td>
                        <td style="padding: 4px 8px; color: #64748b;">${l.expires || '24u'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div style="font-size: 11px; color: #94a3b8; margin-top: 10px; font-style: italic;">Nog geen actieve DHCP-leases uitgereikt. Zodra een draadloze client verbindt, verschijnt deze hier.</div>
              `}
            </div>
          ` : apActiveTab === 'wireless' ? `
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">Wireless Radio Configuratie (802.11a/b/g/n/ac)</h3>
              <table style="width: 100%; font-size: 12px; line-height: 2.2;">
                <tr>
                  <td style="width: 200px; font-weight: bold;">Radio Status:</td>
                  <td>
                    <label style="margin-right: 15px;"><input type="radio" name="apRadioToggle" value="1" ${w.enabled !== false ? 'checked' : ''}> Ingeschakeld (On)</label>
                    <label><input type="radio" name="apRadioToggle" value="0" ${w.enabled === false ? 'checked' : ''}> Uitgeschakeld (Off)</label>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Netwerknaam (SSID):</td>
                  <td><input type="text" id="apSsidInput" class="pt-input" value="${w.ssid || 'PXL-Klas-AP'}" style="width: 220px; font-weight: bold;"></td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Frequentieband:</td>
                  <td>
                    <select id="apBandInput" class="pt-input" style="width: 220px;" onchange="window.PXLApWeb.onBandChange(this.value)">
                      <option value="2.4GHz" ${w.band !== '5GHz' ? 'selected' : ''}>2.4 GHz (802.11b/g/n)</option>
                      <option value="5GHz" ${w.band === '5GHz' ? 'selected' : ''}>5 GHz (802.11a/n/ac)</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Wi-Fi Kanaal:</td>
                  <td>
                    <select id="apChannelInput" class="pt-input" style="width: 220px;">
                      <option value="1" ${w.channel === 1 ? 'selected' : ''}>Kanaal 1 (2412 MHz - Aanbevolen)</option>
                      <option value="6" ${w.channel === 6 || !w.channel ? 'selected' : ''}>Kanaal 6 (2437 MHz - Standaard)</option>
                      <option value="11" ${w.channel === 11 ? 'selected' : ''}>Kanaal 11 (2462 MHz - Aanbevolen)</option>
                      <option value="36" ${w.channel === 36 ? 'selected' : ''}>Kanaal 36 (5180 MHz - 5GHz)</option>
                      <option value="40" ${w.channel === 40 ? 'selected' : ''}>Kanaal 40 (5200 MHz - 5GHz)</option>
                      <option value="44" ${w.channel === 44 ? 'selected' : ''}>Kanaal 44 (5220 MHz - 5GHz)</option>
                      <option value="48" ${w.channel === 48 ? 'selected' : ''}>Kanaal 48 (5240 MHz - 5GHz)</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">SSID Broadcast (Beacon):</td>
                  <td><label><input type="checkbox" id="apBroadcastSsid" checked> Broadcast SSID inschakelen (Zichtbaar in Site Survey)</label></td>
                </tr>
              </table>
            </div>
          ` : apActiveTab === 'security' ? `
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">Wireless Beveiliging & LDAP / 802.1X Authenticatie</h3>
              <table style="width: 100%; font-size: 12px; line-height: 2.2;">
                <tr>
                  <td style="width: 200px; font-weight: bold;">Beveiligingsmodus:</td>
                  <td>
                    <select id="apAuthMode" class="pt-input" style="width: 260px;" onchange="window.PXLApWeb.onAuthModeChange(this.value)">
                      <option value="Open" ${w.authMode === 'Open' ? 'selected' : ''}>Geen Beveiliging (Open)</option>
                      <option value="WPA2-PSK" ${w.authMode === 'WPA2-PSK' ? 'selected' : ''}>WPA2-Personal (Pre-Shared Key / AES)</option>
                      <option value="WPA3-SAE" ${w.authMode === 'WPA3-SAE' ? 'selected' : ''}>WPA3-Personal (SAE Dragonfly)</option>
                      <option value="WPA2-Enterprise" ${w.authMode === 'WPA2-Enterprise' ? 'selected' : ''}>WPA2-Enterprise (802.1X / RADIUS / LDAP)</option>
                    </select>
                  </td>
                </tr>
                <tr id="apPskRow" style="display: ${w.authMode !== 'Open' && w.authMode !== 'WPA2-Enterprise' ? 'table-row' : 'none'};">
                  <td style="font-weight: bold;">WPA2 Passphrase / Wachtwoord:</td>
                  <td><input type="text" id="apPassInput" class="pt-input" value="${w.passphrase || 'PXL_Geheim2026!'}" style="width: 260px;"></td>
                </tr>
                <tbody id="apRadiusRows" style="display: ${w.authMode === 'WPA2-Enterprise' ? 'table-row-group' : 'none'};">
                  <tr>
                    <td style="font-weight: bold; color: #0284c7;">RADIUS / LDAP Server IP:</td>
                    <td><input type="text" id="apRadiusIpInput" class="pt-input" value="${cfg.radiusServer || '10.10.0.10'}" placeholder="bv. 10.10.0.10" style="width: 200px;"></td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; color: #0284c7;">RADIUS Shared Secret:</td>
                    <td><input type="password" id="apRadiusSecretInput" class="pt-input" value="${cfg.radiusSecret || 'PXL_Secret2026!'}" style="width: 200px;"></td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold;">Authenticatiepoort:</td>
                    <td><input type="number" id="apRadiusPortInput" class="pt-input" value="1812" style="width: 80px;" readonly> <span style="color: #64748b;">(RFC 2865 RADIUS Auth)</span></td>
                  </tr>
                </tbody>
              </table>

              <div id="apEnterpriseNotice" style="display: ${w.authMode === 'WPA2-Enterprise' ? 'block' : 'none'}; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin-top: 14px; font-size: 11.5px; color: #166534;">
                <strong>👥 Gekoppeld aan Server LDAP / Active Directory:</strong><br>
                Wanneer een client verbindt via WPA2-Enterprise, vraagt de client een <em>Username</em> en <em>Wachtwoord</em>. De AP stuurt een RADIUS Access-Request naar de geconfigureerde server. De inloggegevens van de huidige student worden automatisch geverifieerd!
              </div>
            </div>
          ` : apActiveTab === 'clients' ? `
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 4px; font-size: 14px;">Verbonden Draadloze Clients (${clients.length})</h3>
              ${clients.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px;">
                  <thead>
                    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                      <th style="padding: 6px 10px;">Client Hostname</th>
                      <th style="padding: 6px 10px;">IP Adres</th>
                      <th style="padding: 6px 10px;">MAC Adres</th>
                      <th style="padding: 6px 10px;">Signaal (RSSI)</th>
                      <th style="padding: 6px 10px;">SNR</th>
                      <th style="padding: 6px 10px;">Link Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${clients.map(c => `
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px 10px; font-weight: bold; color: #0f172a;">${c.name}</td>
                        <td style="padding: 6px 10px; color: #0284c7; font-weight: bold;">${c.ip}</td>
                        <td style="padding: 6px 10px; font-family: monospace; font-size: 11px;">${c.mac}</td>
                        <td style="padding: 6px 10px;">
                          <span style="background: ${c.rssi >= -67 ? '#dcfce7' : '#fef3c7'}; color: ${c.rssi >= -67 ? '#15803d' : '#b45309'}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                            📶 ${c.rssi} dBm
                          </span>
                        </td>
                        <td style="padding: 6px 10px; color: #64748b;">+${c.snr} dB</td>
                        <td style="padding: 6px 10px; font-weight: bold;">${c.txRate} Mbps</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : `
                <div style="text-align: center; padding: 40px; color: #94a3b8;">
                  <div style="font-size: 32px; margin-bottom: 10px;">📡</div>
                  <div style="font-size: 14px; font-weight: bold; color: #64748b;">Geen draadloze clients verbonden</div>
                  <div style="font-size: 12px; margin-top: 4px;">Zorg dat een PC of laptop binnen RF-bereik is en verbind via de <strong>PC Wireless</strong> app.</div>
                </div>
              `}
            </div>
          ` : `
            <!-- ACTIVATIE HANDLEIDING TAB -->
            <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 18px; line-height: 1.6;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-size: 15px;">
                📖 Hoe activeer en benader je de Webinterface op deze Access Point?
              </h3>

              <div style="background: #eff6ff; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 12px 0; border-radius: 0 6px 6px 0;">
                <strong style="color: #1e40af;">In de praktijk (Cisco Aironet Autonomous AP):</strong><br>
                Standaard heeft een nieuw access point vaak geen actief IP-adres of staat de HTTP webserver uit. Om de grafische webmanagement interface in te schakelen en te openen, volg je deze 4 stappen:
              </div>

              <ol style="padding-left: 20px; font-size: 12.5px; color: #334155;">
                <li style="margin-bottom: 10px;">
                  <strong>1. Management IP-adres toekennen (BVI1 of GigabitEthernet0):</strong><br>
                  Verbind via de console-kabel en voer op de AP de basis IP-configuratie in:
                  <div style="background: #0f172a; color: #38bdf8; font-family: monospace; padding: 8px 12px; border-radius: 4px; margin: 5px 0; font-size: 11px;">
                    ap# configure terminal<br>
                    ap(config)# interface BVI1<br>
                    ap(config-if)# ip address 10.10.0.100 255.255.255.0<br>
                    ap(config-if)# no shutdown
                  </div>
                  <em>(In deze simulator staat het IP standaard al ingesteld op <code>10.10.0.100</code>).</em>
                </li>

                <li style="margin-bottom: 10px;">
                  <strong>2. HTTP Webserver Inschakelen:</strong><br>
                  Activeer de ingebouwde webserver van Cisco IOS:
                  <div style="background: #0f172a; color: #38bdf8; font-family: monospace; padding: 8px 12px; border-radius: 4px; margin: 5px 0; font-size: 11px;">
                    ap(config)# ip http server<br>
                    ap(config)# ip http authentication local
                  </div>
                  <em>(In deze simulator kun je dit ook met één klik aanzetten via het vinkje "Web Management (HTTP)" in het tabblad Netwerk).</em>
                </li>

                <li style="margin-bottom: 10px;">
                  <strong>3. Interne DHCP-server configureren (optioneel):</strong><br>
                  Schakel de interne DHCP-server van het AP in zodat draadloze laptops en pc's direct automatisch een IP-adres krijgen:
                  <div style="background: #0f172a; color: #38bdf8; font-family: monospace; padding: 8px 12px; border-radius: 4px; margin: 5px 0; font-size: 11px;">
                    ap(config)# ip dhcp pool AP_WIFI_POOL<br>
                    ap(dhcp-config)# network 10.10.0.0 255.255.255.0<br>
                    ap(dhcp-config)# default-router 10.10.0.100<br>
                    ap(dhcp-config)# dns-server 8.8.8.8
                  </div>
                </li>

                <li style="margin-bottom: 10px;">
                  <strong>4. Openen via de PC Web Browser:</strong><br>
                  Ga naar een pc of laptop die via switch of Wi-Fi in hetzelfde subnet zit (bijv. IP <code>10.10.0.50</code>).<br>
                  Open de <strong>Web Browser</strong> app op het bureaublad en surf naar:
                  <div style="background: #e2e8f0; color: #0f172a; font-family: monospace; padding: 6px 12px; border-radius: 4px; margin: 5px 0; font-weight: bold; font-size: 12px;">
                    http://10.10.0.100
                  </div>
                  Of klik op het tabblad <strong>"AP Web GUI"</strong> direct in het AP venster!
                </li>
              </ol>
            </div>
          `}

          <!-- Footer Save Button -->
          <div style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
            <button class="pt-btn pt-btn-primary" onclick="window.PXLApWeb.saveConfig('${device.id}')" style="padding: 8px 20px; font-weight: bold;">
              💾 Instellingen Toepassen & Opslaan
            </button>
          </div>
        </div>
      </div>
    `;
  }

  window.PXLApWeb = {
    render: renderApWebInterfaceHtml,
    switchTab(tab, devId) {
      apActiveTab = tab;
      if (window.PXLApp && window.PXLApp.activeDevice && window.PXLApp.activeDevice.id === devId) {
        window.PXLApp.renderApWebTab();
      }
    },
    onBandChange(band) {
      const chan = document.getElementById('apChannelInput');
      if (!chan) return;
      if (band === '5GHz') {
        chan.value = '36';
      } else {
        chan.value = '6';
      }
    },
    onAuthModeChange(mode) {
      const pskRow = document.getElementById('apPskRow');
      const radiusRows = document.getElementById('apRadiusRows');
      const notice = document.getElementById('apEnterpriseNotice');
      if (pskRow) pskRow.style.display = (mode !== 'Open' && mode !== 'WPA2-Enterprise') ? 'table-row' : 'none';
      if (radiusRows) radiusRows.style.display = (mode === 'WPA2-Enterprise') ? 'table-row-group' : 'none';
      if (notice) notice.style.display = (mode === 'WPA2-Enterprise') ? 'block' : 'none';
    },
    saveConfig(devId) {
      const sim = window.PXLNetworkSim;
      const dev = sim ? sim.devices[devId] : null;
      if (!dev) return;

      const ipInput = document.getElementById('apIpInput');
      const maskInput = document.getElementById('apMaskInput');
      const gwInput = document.getElementById('apGwInput');
      const dnsInput = document.getElementById('apDnsInput');
      const webChk = document.getElementById('apWebEnabled');
      const dhcpRad = document.querySelector('input[name="apDhcpToggle"]:checked');
      const dhcpStart = document.getElementById('apDhcpStartIp');
      const dhcpMax = document.getElementById('apDhcpMaxUsers');
      const dhcpGw = document.getElementById('apDhcpGw');

      const ssidInput = document.getElementById('apSsidInput');
      const bandInput = document.getElementById('apBandInput');
      const chanInput = document.getElementById('apChannelInput');
      const authModeSelect = document.getElementById('apAuthMode');
      const passInput = document.getElementById('apPassInput');
      const radIp = document.getElementById('apRadiusIpInput');
      const radSec = document.getElementById('apRadiusSecretInput');

      if (!dev.apConfig) dev.apConfig = {};
      if (ipInput) dev.apConfig.ip = ipInput.value.trim();
      if (maskInput) dev.apConfig.mask = maskInput.value.trim();
      if (gwInput) dev.apConfig.gateway = gwInput.value.trim();
      if (dnsInput) dev.apConfig.dns = dnsInput.value.trim();
      if (webChk) dev.apConfig.webEnabled = webChk.checked;
      if (dhcpRad) dev.apConfig.dhcpEnabled = (dhcpRad.value === '1');

      if (!dev.apConfig.dhcpPool) dev.apConfig.dhcpPool = {};
      if (dhcpStart) dev.apConfig.dhcpPool.startIp = dhcpStart.value.trim();
      if (dhcpMax) dev.apConfig.dhcpPool.maxUsers = parseInt(dhcpMax.value, 10) || 30;
      if (dhcpGw) dev.apConfig.dhcpPool.gateway = dhcpGw.value.trim();

      dev.ip = dev.apConfig.ip;
      dev.mask = dev.apConfig.mask;
      dev.defaultGateway = dev.apConfig.gateway;
      if (dev.interfaces && dev.interfaces['GigabitEthernet0']) {
        dev.interfaces['GigabitEthernet0'].ip = dev.apConfig.ip;
        dev.interfaces['GigabitEthernet0'].mask = dev.apConfig.mask;
      }

      if (dev.wireless) {
        if (ssidInput) dev.wireless.ssid = ssidInput.value.trim();
        if (bandInput) dev.wireless.band = bandInput.value;
        if (chanInput) dev.wireless.channel = parseInt(chanInput.value, 10);
        if (authModeSelect) dev.wireless.authMode = authModeSelect.value;
        if (passInput) dev.wireless.passphrase = passInput.value.trim();
      }

      if (radIp) dev.apConfig.radiusServer = radIp.value.trim();
      if (radSec) dev.apConfig.radiusSecret = radSec.value.trim();

      sim.updateWirelessAssociations();
      if (window.PXLApp) {
        window.PXLApp.showToast('💾 Cisco Aironet AP instellingen succesvol opgeslagen!');
        window.PXLApp.canvasWorkspace.render();
        window.PXLApp.triggerScoreUpdate();
      }
    }
  };

  window.renderWrtWebInterfaceHtml = renderWrtWebInterfaceHtml;
  window.renderWlcWebInterfaceHtml = renderWlcWebInterfaceHtml;
  window.renderApWebInterfaceHtml = renderApWebInterfaceHtml;

})(typeof window !== 'undefined' ? window : this);
