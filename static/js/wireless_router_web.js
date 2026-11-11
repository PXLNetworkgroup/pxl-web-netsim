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

  window.renderWrtWebInterfaceHtml = renderWrtWebInterfaceHtml;
  window.renderWlcWebInterfaceHtml = renderWlcWebInterfaceHtml;

})(typeof window !== 'undefined' ? window : this);
