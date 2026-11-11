/**
 * pc_wireless_app.js - Cisco Packet Tracer Style PC Wireless Application
 * Implements Link Information, Site Survey (AP scan), Connect, and PXL Wi-Fi Theory
 * Part of PXL Web NetSim (Hogeschool PXL - SNE Networks 1)
 */

(function(window) {
  'use strict';

  let activeTab = 'link_info';

  function renderPcWirelessAppHtml(device, sim, onUpdateCallback) {
    if (!device) return '<div class="pt-app-error">Geen actief apparaat geselecteerd.</div>';

    // If device doesn't have wireless installed
    if (!device.wireless || !device.wireless.installed) {
      return `
        <div class="pt-app-window" style="text-align: center; padding: 30px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px;">📶❌</div>
          <h3 style="margin: 0 0 10px 0; color: #f8fafc;">Geen Draadloze Netwerkkaart Geïnstalleerd</h3>
          <p style="color: #94a3b8; max-width: 440px; margin: 0 auto 20px auto; font-size: 13px; line-height: 1.5;">
            Dit toestel (${device.hostname}) beschikt momenteel niet over een actieve Wi-Fi module (WMP300N / WPC300N).
            Installeer een draadloze netwerkkaart om verbinding te maken met draadloze netwerken.
          </p>
          <button class="pt-btn pt-btn-primary" onclick="window.PXLWirelessApp.installCard('${device.id}')" style="padding: 8px 18px; font-weight: 700;">
            ➕ Installeer WMP300N Wi-Fi Kaart
          </button>
        </div>
      `;
    }

    // Refresh simulator wireless associations to have latest metrics
    if (sim && typeof sim.updateWirelessAssociations === 'function') {
      sim.updateWirelessAssociations();
    }

    const w = device.wireless;
    const isConnected = !!w.associatedAp;
    const apDev = isConnected && sim ? sim.devices[w.associatedAp] : null;

    // Signal color & width calculation
    let sigColor = '#ef4444';
    if (w.rssi >= -60) sigColor = '#10b981';
    else if (w.rssi >= -68) sigColor = '#0ea5e9';
    else if (w.rssi >= -78) sigColor = '#f59e0b';
    else if (w.rssi >= -85) sigColor = '#f97316';

    const sigPct = isConnected ? Math.max(0, Math.min(100, Math.round(2 * (w.rssi + 100)))) : 0;
    const lqPct = isConnected ? Math.max(0, Math.min(100, w.linkQuality || sigPct)) : 0;

    let barsText = '⚪⚪⚪⚪ (0/4)';
    if (w.bars === 4) barsText = '🟢🟢🟢🟢 (4/4)';
    else if (w.bars === 3) barsText = '🟢🟢🟢⚪ (3/4)';
    else if (w.bars === 2) barsText = '🟡🟡⚪⚪ (2/4)';
    else if (w.bars === 1) barsText = '🟠⚪⚪⚪ (1/4)';

    // PXL Course Enterprise Norm Assessment
    let normBadge = '';
    if (!isConnected) {
      normBadge = `<span style="background: #334155; color: #94a3b8; padding: 3px 8px; border-radius: 4px; font-size: 11px;">Niet verbonden</span>`;
    } else if (w.rssi >= -67) {
      normBadge = `<span style="background: #064e3b; color: #34d399; border: 1px solid #059669; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">✅ Voldoet aan PXL Gouden Regel (Min. -67 dBm voor VoIP)</span>`;
    } else if (w.rssi >= -80) {
      normBadge = `<span style="background: #78350f; color: #fcd34d; border: 1px solid #d97706; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">⚠️ Onder Enterprise Norm (-67 tot -80 dBm: Roaming geadviseerd)</span>`;
    } else {
      normBadge = `<span style="background: #7f1d1d; color: #fca5a5; border: 1px solid #dc2626; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">❌ Kritiek Signaal (< -80 dBm: Roaming noodzakelijk)</span>`;
    }

    return `
      <div class="pt-app-window pt-wireless-app" style="display: flex; flex-direction: column; height: 100%; color: #f8fafc; font-size: 12px;">
        <!-- Top App Navigation Tabs -->
        <div class="pt-wireless-tabs" style="display: flex; gap: 4px; border-bottom: 2px solid #334155; padding-bottom: 6px; margin-bottom: 12px;">
          <button class="pt-tab-btn ${activeTab === 'link_info' ? 'active' : ''}" onclick="window.PXLWirelessApp.switchTab('link_info', '${device.id}')" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px;">
            📊 Link Information
          </button>
          <button class="pt-tab-btn ${activeTab === 'site_survey' ? 'active' : ''}" onclick="window.PXLWirelessApp.switchTab('site_survey', '${device.id}')" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px;">
            📡 Site Survey (Scan)
          </button>
          <button class="pt-tab-btn ${activeTab === 'connect' ? 'active' : ''}" onclick="window.PXLWirelessApp.switchTab('connect', '${device.id}')" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px;">
            🔐 Connect / Profiel
          </button>
          <button class="pt-tab-btn ${activeTab === 'theory' ? 'active' : ''}" onclick="window.PXLWirelessApp.switchTab('theory', '${device.id}')" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 6px;">
            📖 Wi-Fi Theorie & Leidraad
          </button>
        </div>

        <!-- Tab 1: LINK INFORMATION -->
        <div id="wirelessTabContent" style="flex: 1; overflow-y: auto; padding-right: 4px;">
          ${activeTab === 'link_info' ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <!-- Left Column: Status & Meters -->
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <h4 style="margin: 0; font-size: 13px; color: #38bdf8;">Verbindingsstatus</h4>
                  ${normBadge}
                </div>

                <div style="margin-bottom: 12px;">
                  <div style="font-size: 11px; color: #94a3b8;">Verbonden SSID:</div>
                  <div style="font-size: 16px; font-weight: 800; color: ${isConnected ? '#38bdf8' : '#94a3b8'};">
                    ${isConnected ? w.ssid : 'Geen actieve verbinding'}
                  </div>
                </div>

                <!-- Signal Strength Bar -->
                <div style="margin-bottom: 12px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                    <span style="color: #94a3b8;">Signaalsterkte (RSSI):</span>
                    <strong style="color: ${sigColor};">${isConnected ? `${w.rssi} dBm (${sigPct}%)` : '-95 dBm (0%)'}</strong>
                  </div>
                  <div style="background: #0f172a; border-radius: 6px; height: 10px; overflow: hidden; border: 1px solid #334155;">
                    <div style="width: ${sigPct}%; height: 100%; background: ${sigColor}; transition: width 0.3s ease, background 0.3s ease;"></div>
                  </div>
                  <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Signaalbalken: ${barsText}</div>
                </div>

                <!-- Link Quality Bar -->
                <div style="margin-bottom: 14px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                    <span style="color: #94a3b8;">Link Kwaliteit:</span>
                    <strong style="color: #38bdf8;">${isConnected ? `${lqPct}%` : '0%'}</strong>
                  </div>
                  <div style="background: #0f172a; border-radius: 6px; height: 10px; overflow: hidden; border: 1px solid #334155;">
                    <div style="width: ${lqPct}%; height: 100%; background: #0284c7; transition: width 0.3s ease;"></div>
                  </div>
                </div>

                <!-- Live Theoretical RF Metrics -->
                <div style="background: #0f172a; border-radius: 6px; padding: 10px; border: 1px solid #334155;">
                  <div style="font-weight: 700; color: #f1f5f9; margin-bottom: 6px; font-size: 11px; display: flex; align-items: center; gap: 4px;">
                    📐 PXL Theoretische RF Metrieken:
                  </div>
                  <table style="width: 100%; font-size: 11px; line-height: 1.6;">
                    <tr>
                      <td style="color: #94a3b8;">Ruisvloer (Noise Floor):</td>
                      <td style="text-align: right; font-weight: bold; color: #f8fafc;">${w.noiseFloor || -95} dBm</td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">SNR (RSSI - Ruisvloer):</td>
                      <td style="text-align: right; font-weight: bold; color: ${w.snr >= 25 ? '#34d399' : w.snr >= 15 ? '#fbbf24' : '#f87171'};">
                        ${isConnected ? `+${w.snr} dB (${w.snr >= 25 ? 'Uitstekend ≥ 25dB' : 'Matig'})` : '0 dB'}
                      </td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">Afstand tot AP:</td>
                      <td style="text-align: right; font-weight: bold; color: #f8fafc;">
                        ${isConnected ? `${w.distanceM || (Math.round((w.distancePx || 50)/8*10)/10)} m (${w.distancePx || 50} px)` : 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">Datasnelheid (Tx Rate):</td>
                      <td style="text-align: right; font-weight: bold; color: #38bdf8;">
                        ${isConnected ? `${w.txRate} Mbps (MCS Rate)` : '0 Mbps'}
                      </td>
                    </tr>
                  </table>
                </div>
              </div>

              <!-- Right Column: Network Config Details -->
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #38bdf8;">Draadloze Netwerkparameters</h4>
                  <table style="width: 100%; font-size: 11px; line-height: 1.8;">
                    <tr>
                      <td style="color: #94a3b8;">Access Point / BSSID:</td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold; color: #f8fafc;">
                        ${apDev ? `${apDev.hostname} (${apDev.interfaces['Wireless0']?.mac || '0021.d8.bb.01'})` : 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">Frequentieband:</td>
                      <td style="text-align: right; font-weight: bold; color: #f8fafc;">${w.band || '2.4GHz'} (20 MHz)</td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">Draadloos Kanaal:</td>
                      <td style="text-align: right; font-weight: bold; color: #f8fafc;">Kanaal ${w.channel || 6}</td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">Beveiliging / Encryptie:</td>
                      <td style="text-align: right; font-weight: bold; color: #f8fafc;">${w.authMode || 'WPA2-PSK'} (AES)</td>
                    </tr>
                    <tr style="border-top: 1px solid #334155;">
                      <td style="color: #94a3b8; padding-top: 6px;">IP Configuratie:</td>
                      <td style="text-align: right; font-weight: bold; color: #38bdf8; padding-top: 6px;">${device.dhcpEnabled ? 'DHCP (Automatisch)' : 'Statisch IP'}</td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">IPv4-adres:</td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold; color: #f8fafc;">${device.ip || '0.0.0.0'}</td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">Subnetmasker:</td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold; color: #f8fafc;">${device.mask || '0.0.0.0'}</td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">Standaardgateway:</td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold; color: #f8fafc;">${device.gateway || '0.0.0.0'}</td>
                    </tr>
                    <tr>
                      <td style="color: #94a3b8;">DNS-server:</td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold; color: #f8fafc;">${device.dns || '8.8.8.8'}</td>
                    </tr>
                  </table>
                </div>

                <div style="margin-top: 14px; display: flex; gap: 8px;">
                  <button class="pt-btn pt-btn-secondary" onclick="window.PXLWirelessApp.switchTab('site_survey', '${device.id}')" style="flex: 1; font-size: 11px;">
                    🔍 Zoek Andere Netwerken
                  </button>
                  ${isConnected ? `
                    <button class="pt-btn" onclick="window.PXLWirelessApp.disconnect('${device.id}')" style="background: #991b1b; color: white; border: none; font-size: 11px; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                      Verbreken
                    </button>
                  ` : `
                    <button class="pt-btn pt-btn-primary" onclick="window.PXLWirelessApp.switchTab('connect', '${device.id}')" style="flex: 1; font-size: 11px;">
                      Verbinden
                    </button>
                  `}
                </div>
              </div>
            </div>
          ` : activeTab === 'site_survey' ? `
            <!-- Tab 2: SITE SURVEY (SCAN) -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                  <h4 style="margin: 0; font-size: 13px; color: #38bdf8;">Site Survey • Beschikbare Draadloze Netwerken</h4>
                  <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">Alle gedetecteerde Access Points en WLANs binnen zendbereik (max 380px).</p>
                </div>
                <button class="pt-btn pt-btn-secondary" onclick="window.PXLWirelessApp.refreshScan('${device.id}')" style="font-size: 11px; padding: 6px 12px;">
                  🔄 Opnieuw Scannen
                </button>
              </div>

              ${(() => {
                const visibleNets = sim ? sim.getVisibleWirelessNetworks(device) : [];
                if (visibleNets.length === 0) {
                  return `
                    <div style="text-align: center; padding: 30px 10px; color: #94a3b8;">
                      <div style="font-size: 32px; margin-bottom: 8px;">📡❓</div>
                      <strong>Geen draadloze netwerken binnen bereik gevonden.</strong>
                      <p style="font-size: 11px; margin-top: 6px; color: #64748b;">Plaats een Access Point of Wireless Router dichterbij op het werkveld of zet het toestel aan.</p>
                    </div>
                  `;
                }

                return `
                  <table class="pt-survey-table" style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                    <thead>
                      <tr style="border-bottom: 2px solid #475569; color: #94a3b8; font-size: 10px; text-transform: uppercase;">
                        <th style="padding: 6px 8px;">SSID</th>
                        <th style="padding: 6px 8px;">BSSID (AP)</th>
                        <th style="padding: 6px 8px;">Signaal</th>
                        <th style="padding: 6px 8px;">RSSI</th>
                        <th style="padding: 6px 8px;">Kanaal</th>
                        <th style="padding: 6px 8px;">Band</th>
                        <th style="padding: 6px 8px;">Beveiliging</th>
                        <th style="padding: 6px 8px; text-align: right;">Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${visibleNets.map(net => {
                        const isCurrent = (w.associatedAp === net.apId && w.ssid === net.ssid);
                        let barColor = '#10b981';
                        if (net.rssi < -68) barColor = '#0ea5e9';
                        if (net.rssi < -78) barColor = '#f59e0b';
                        if (net.rssi < -85) barColor = '#ef4444';

                        return `
                          <tr style="border-bottom: 1px solid #334155; ${isCurrent ? 'background: rgba(14, 165, 233, 0.12);' : ''}">
                            <td style="padding: 8px; font-weight: bold; color: ${isCurrent ? '#38bdf8' : '#f8fafc'};">
                              ${net.ssid} ${isCurrent ? '<span style="color:#22c55e; font-size:10px;">(Actief)</span>' : ''}
                            </td>
                            <td style="padding: 8px; font-family: monospace; color: #94a3b8;">${net.apName}</td>
                            <td style="padding: 8px;">
                              <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 45px; background: #0f172a; height: 6px; border-radius: 3px; overflow: hidden;">
                                  <div style="width: ${net.linkQuality}%; height: 100%; background: ${barColor};"></div>
                                </div>
                                <span style="font-weight: bold; color: ${barColor};">${net.linkQuality}%</span>
                              </div>
                            </td>
                            <td style="padding: 8px; font-weight: bold; color: ${barColor};">${net.rssi} dBm</td>
                            <td style="padding: 8px;">Ch ${net.channel}</td>
                            <td style="padding: 8px;">${net.band}</td>
                            <td style="padding: 8px;">
                              <span style="background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${net.authMode}</span>
                            </td>
                            <td style="padding: 8px; text-align: right;">
                              ${isCurrent ? `
                                <button class="pt-btn" onclick="window.PXLWirelessApp.disconnect('${device.id}')" style="padding: 3px 8px; font-size: 10px; background: #991b1b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                  Verbreken
                                </button>
                              ` : `
                                <button class="pt-btn pt-btn-primary" onclick="window.PXLWirelessApp.quickConnectPrompt('${device.id}', '${net.ssid}', '${net.authMode}', '${net.apId}')" style="padding: 3px 10px; font-size: 10px; font-weight: 700;">
                                  Verbinden
                                </button>
                              `}
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                `;
              })()}
            </div>
          ` : activeTab === 'connect' ? `
            <!-- Tab 3: CONNECT / PROFILE CONFIGURATION -->
            <div style="max-width: 520px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 18px;">
              <h4 style="margin: 0 0 14px 0; font-size: 14px; color: #38bdf8;">Draadloos Profiel & Verbindingsinstellingen</h4>

              <div class="pt-form-group" style="margin-bottom: 12px;">
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Draadloos Netwerk (SSID):</label>
                <input type="text" class="pt-input" id="cfgWifiSsid" value="${w.ssid || ''}" placeholder="bv. PXL-Klas-AP of PXL-Staff" style="width: 100%; box-sizing: border-box;">
              </div>

              <div class="pt-form-group" style="margin-bottom: 12px;">
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Authenticatiemethode (Security Mode):</label>
                <select class="pt-input" id="cfgWifiAuth" onchange="window.PXLWirelessApp.handleAuthChange()" style="width: 100%; box-sizing: border-box;">
                  <option value="Open" ${w.authMode === 'Open' ? 'selected' : ''}>Open (Geen versleuteling)</option>
                  <option value="WPA2-PSK" ${w.authMode === 'WPA2-PSK' ? 'selected' : ''}>WPA2-Personal (Pre-Shared Key / AES)</option>
                  <option value="WPA3-SAE" ${w.authMode === 'WPA3-SAE' ? 'selected' : ''}>WPA3-Personal (Simultaneous Authentication of Equals)</option>
                  <option value="WPA2-Enterprise" ${w.authMode === 'WPA2-Enterprise' ? 'selected' : ''}>WPA2-Enterprise (802.1X / RADIUS)</option>
                </select>
              </div>

              <div class="pt-form-group" id="cfgPassGroup" style="margin-bottom: 16px; ${(w.authMode === 'Open' || w.authMode === 'WPA2-Enterprise') ? 'display:none;' : ''}">
                <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 4px;">WPA2/WPA3 Wachtwoord (Pre-Shared Key):</label>
                <input type="password" class="pt-input" id="cfgWifiPass" value="${w.passphrase || ''}" placeholder="Voer het Wi-Fi wachtwoord in" style="width: 100%; box-sizing: border-box;">
              </div>

              <!-- 802.1X Enterprise LDAP / RADIUS Credentials -->
              <div id="cfgEnterpriseGroup" style="margin-bottom: 16px; padding: 12px; background: #0f172a; border-radius: 6px; border: 1px solid #0284c7; ${w.authMode === 'WPA2-Enterprise' ? 'display:block;' : 'display:none;'}">
                <div style="font-size: 11.5px; font-weight: bold; color: #38bdf8; margin-bottom: 8px;">👥 802.1X EAP-PEAP Domein Inloggegevens (LDAP):</div>
                <div style="margin-bottom: 8px;">
                  <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 3px;">Domeingebruiker (Student / User):</label>
                  <input type="text" class="pt-input" id="cfgWifiUser" value="${w.enterpriseUser || (window.PXLApp?.currentUser?.username) || 'student1'}" placeholder="bv. student1 of student" style="width: 100%; box-sizing: border-box;">
                </div>
                <div>
                  <label style="display: block; font-size: 11px; color: #94a3b8; margin-bottom: 3px;">Wachtwoord:</label>
                  <input type="password" class="pt-input" id="cfgWifiEntPass" value="${w.enterprisePass || 'PXL2026!'}" placeholder="Wachtwoord invoeren..." style="width: 100%; box-sizing: border-box;">
                </div>
                <div style="font-size: 10.5px; color: #6ee7b7; margin-top: 6px;">
                  ✓ Geverifieerd via Server Active Directory / LDAP Service
                </div>
              </div>

              <div class="pt-form-group" style="margin-bottom: 16px; padding: 10px; background: #0f172a; border-radius: 6px; border: 1px solid #334155;">
                <label style="display: block; font-size: 11px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">IP-Adrestoewijzing na Verbinding:</label>
                <label style="margin-right: 15px; font-size: 11px; color: #cbd5e1; cursor: pointer;">
                  <input type="radio" name="wlanIpMode" value="dhcp" ${device.dhcpEnabled ? 'checked' : ''} onchange="window.PXLApp.activeDevice.dhcpEnabled=true"> DHCP (Aanbevolen)
                </label>
                <label style="font-size: 11px; color: #cbd5e1; cursor: pointer;">
                  <input type="radio" name="wlanIpMode" value="static" ${!device.dhcpEnabled ? 'checked' : ''} onchange="window.PXLApp.activeDevice.dhcpEnabled=false"> Statisch IP
                </label>
              </div>

              <div style="display: flex; gap: 10px;">
                <button class="pt-btn pt-btn-primary" onclick="window.PXLWirelessApp.saveAndConnect('${device.id}')" style="flex: 2; padding: 8px; font-weight: 700;">
                  🚀 Opslaan & Verbinden
                </button>
                ${isConnected ? `
                  <button class="pt-btn" onclick="window.PXLWirelessApp.disconnect('${device.id}')" style="flex: 1; background: #991b1b; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
                    Verbreken
                  </button>
                ` : ''}
              </div>
            </div>
          ` : `
            <!-- Tab 4: THEORIE & LEIDRAAD (PXL NETWORKS 1 CHAPTER 8) -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 18px; line-height: 1.6; font-size: 12px; color: #cbd5e1;">
              <h3 style="margin-top: 0; color: #38bdf8; font-size: 15px;">8. Enterprise Wireless & Wi-Fi: Theoretische Concepten & Ontwerpleidraad</h3>
              <p>Deze richtlijnen komen rechtstreeks uit de cursus <strong>SNE Networks 1 (Hogeschool PXL)</strong>:</p>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 15px 0;">
                <div style="background: #0f172a; border-radius: 6px; padding: 12px; border-left: 4px solid #10b981;">
                  <h4 style="margin: 0 0 6px 0; color: #34d399; font-size: 12px;">1. De Decibelschaal & Rekenregels</h4>
                  <p style="margin: 0 0 4px 0; font-size: 11px;">Decibel (dB) is een logaritmische verhouding; vermogen in dBm is gerelateerd aan 1 mW (0 dBm = 1 mW).</p>
                  <ul style="margin: 0; padding-left: 16px; font-size: 11px;">
                    <li><strong>Regel van 3:</strong> +3 dB = 2× vermogen; -3 dB = 0.5× vermogen.</li>
                    <li><strong>Regel van 10:</strong> +10 dB = 10× vermogen; -10 dB = 0.1× vermogen.</li>
                  </ul>
                </div>

                <div style="background: #0f172a; border-radius: 6px; padding: 12px; border-left: 4px solid #0ea5e9;">
                  <h4 style="margin: 0 0 6px 0; color: #38bdf8; font-size: 12px;">2. Gouden RSSI & SNR Regels</h4>
                  <ul style="margin: 0; padding-left: 16px; font-size: 11px;">
                    <li><strong>Minimaal -67 dBm:</strong> De PXL-norm voor VoIP, Microsoft Teams en video-calls.</li>
                    <li><strong>-70 dBm:</strong> Aanbevolen drempelwaarde voor roaming (802.11k/v/r).</li>
                    <li><strong>SNR ≥ 25 dB:</strong> Minimaal vereist voor een stabiele zakelijke verbinding.</li>
                    <li><strong>-90 dBm:</strong> Verbinding valt definitief weg (Drop Threshold).</li>
                  </ul>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 15px 0;">
                <div style="background: #0f172a; border-radius: 6px; padding: 12px; border-left: 4px solid #f59e0b;">
                  <h4 style="margin: 0 0 6px 0; color: #fbbf24; font-size: 12px;">3. Kanaalplanning (2.4 GHz vs 5 GHz)</h4>
                  <ul style="margin: 0; padding-left: 16px; font-size: 11px;">
                    <li><strong>2.4 GHz:</strong> Uitsluitend kanalen <strong>1, 6 en 11</strong> gebruiken (20 MHz)! Tussenkanalen veroorzaken zware <em>Adjacent Channel Interference (ACI)</em>.</li>
                    <li><strong>5 GHz:</strong> Kanalen 36 t/m 48 (UNII-1) vallen nooit uit door weerradar (Non-DFS).</li>
                  </ul>
                </div>

                <div style="background: #0f172a; border-radius: 6px; padding: 12px; border-left: 4px solid #ef4444;">
                  <h4 style="margin: 0 0 6px 0; color: #f87171; font-size: 12px;">4. De Asymmetrische Link Valstrik</h4>
                  <p style="margin: 0; font-size: 11px;">
                    Zet een AP nooit op maximaal zendvermogen (100-200 mW / 20-23 dBm)! Smartphones en laptops zenden slechts met 12-15 dBm.
                    Bij een te luid AP 'hoort' de smartphone het AP prima, maar kan het AP de zwakke client niet verstaan.
                  </p>
                </div>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // --- CONTROLLER ACTIONS ---
  window.PXLWirelessApp = {
    render: renderPcWirelessAppHtml,

    switchTab(tab, devId) {
      activeTab = tab;
      if (window.PXLApp && window.PXLApp.activeDevice && window.PXLApp.activeDevice.id === devId) {
        window.PXLApp.openPcApp('wireless');
      }
    },

    installCard(devId) {
      const sim = window.PXLNetworkSim;
      const dev = sim ? sim.devices[devId] : null;
      if (!dev) return;
      dev.installWirelessCard('WMP300N');
      if (window.PXLApp) {
        window.PXLApp.showToast(`✅ WMP300N Wi-Fi kaart succesvol geïnstalleerd in ${dev.hostname}!`);
        window.PXLApp.openPcApp('wireless');
        window.PXLApp.canvasWorkspace.render();
      }
    },

    removeCard(devId) {
      const sim = window.PXLNetworkSim;
      const dev = sim ? sim.devices[devId] : null;
      if (!dev) return;
      dev.removeWirelessCard();
      if (window.PXLApp) {
        window.PXLApp.showToast(`➖ Wi-Fi kaart verwijderd uit ${dev.hostname}`);
        window.PXLApp.openPcApp('wireless');
        window.PXLApp.canvasWorkspace.render();
      }
    },

    handleAuthChange() {
      const sel = document.getElementById('cfgWifiAuth');
      const passGroup = document.getElementById('cfgPassGroup');
      const entGroup = document.getElementById('cfgEnterpriseGroup');
      if (!sel) return;
      if (passGroup) passGroup.style.display = (sel.value === 'Open' || sel.value === 'WPA2-Enterprise') ? 'none' : 'block';
      if (entGroup) entGroup.style.display = (sel.value === 'WPA2-Enterprise') ? 'block' : 'none';
    },

    refreshScan(devId) {
      if (window.PXLNetworkSim) {
        window.PXLNetworkSim.updateWirelessAssociations();
      }
      if (window.PXLApp) {
        window.PXLApp.openPcApp('wireless');
        window.PXLApp.showToast('🔄 Wi-Fi netwerken succesvol gescand.');
      }
    },

    quickConnectPrompt(devId, ssid, authMode, apId) {
      const sim = window.PXLNetworkSim;
      const dev = sim ? sim.devices[devId] : null;
      if (!dev || !dev.wireless) return;

      dev.wireless.ssid = ssid;
      dev.wireless.authMode = authMode;

      if (authMode === 'Open') {
        dev.wireless.passphrase = '';
        sim.updateWirelessAssociations();
        if (window.PXLApp) {
          window.PXLApp.showToast(`📡 Succesvol verbonden met open netwerk ${ssid}!`);
          window.PXLApp.openPcApp('wireless');
          window.PXLApp.canvasWorkspace.render();
          window.PXLApp.triggerScoreUpdate();
        }
      } else {
        // Switch to Connect tab with prefilled values
        activeTab = 'connect';
        if (window.PXLApp) {
          window.PXLApp.openPcApp('wireless');
          setTimeout(() => {
            const ssidInput = document.getElementById('cfgWifiSsid');
            const authSel = document.getElementById('cfgWifiAuth');
            const passInput = document.getElementById('cfgWifiPass');
            if (ssidInput) ssidInput.value = ssid;
            if (authSel) {
              authSel.value = authMode;
              window.PXLWirelessApp.handleAuthChange();
            }
            if (passInput) passInput.focus();
          }, 50);
        }
      }
    },

    saveAndConnect(devId) {
      const sim = window.PXLNetworkSim;
      const dev = sim ? sim.devices[devId] : null;
      if (!dev || !dev.wireless) return;

      const ssidEl = document.getElementById('cfgWifiSsid');
      const authEl = document.getElementById('cfgWifiAuth');
      const passEl = document.getElementById('cfgWifiPass');

      dev.wireless.ssid = ssidEl ? ssidEl.value.trim() : '';
      dev.wireless.authMode = authEl ? authEl.value : 'WPA2-PSK';
      dev.wireless.passphrase = passEl ? passEl.value.trim() : '';

      // 802.1X Enterprise LDAP / RADIUS Verification
      if (dev.wireless.authMode === 'WPA2-Enterprise') {
        const userEl = document.getElementById('cfgWifiUser');
        const entPassEl = document.getElementById('cfgWifiEntPass');
        const entUser = userEl ? userEl.value.trim() : '';
        const entPass = entPassEl ? entPassEl.value.trim() : '';

        // Find AP or Server IP
        let radServerIp = '10.10.0.10';
        let radSecret = 'PXL_Secret2026!';

        // Search for any AP broadcasting this SSID or server with LDAP
        for (const d of Object.values(sim.devices)) {
          if (d.type === 'wireless_ap' && d.wireless?.ssid === dev.wireless.ssid) {
            radServerIp = d.apConfig?.radiusServer || radServerIp;
            radSecret = d.apConfig?.radiusSecret || radSecret;
            break;
          }
          if (d.type === 'server' && d.services?.ldap?.enabled) {
            radServerIp = d.ip;
            radSecret = d.services.ldap.radiusSecret || radSecret;
          }
        }

        const authRes = sim.authenticateRadiusLdap(radServerIp, radSecret, entUser, entPass);
        if (!authRes.success) {
          if (window.PXLApp) {
            window.PXLApp.showToast(`❌ 802.1X Authenticatie geweigerd: ${authRes.reason}`);
          }
          dev.wireless.associatedAp = null;
          dev.wireless.enterpriseUser = entUser;
          sim.updateWirelessAssociations();
          window.PXLApp.canvasWorkspace.render();
          return;
        }

        dev.wireless.enterpriseUser = entUser;
        dev.wireless.enterprisePass = entPass;
        dev.wireless.passphrase = entPass;
      }

      sim.updateWirelessAssociations();

      if (window.PXLApp) {
        if (dev.wireless.associatedAp) {
          const ap = sim.devices[dev.wireless.associatedAp];
          const isEnt = dev.wireless.authMode === 'WPA2-Enterprise';
          window.PXLApp.showToast(`📶 Verbonden met ${dev.wireless.ssid} via ${ap?.hostname || 'AP'}! ${isEnt ? `(802.1X LDAP: ${dev.wireless.enterpriseUser})` : ''}`);
        } else {
          window.PXLApp.showToast(`⚠️ Kan niet verbinden met ${dev.wireless.ssid}. Controleer SSID, beveiliging of afstand.`);
        }
        activeTab = 'link_info';
        window.PXLApp.openPcApp('wireless');
        window.PXLApp.canvasWorkspace.render();
        window.PXLApp.triggerScoreUpdate();
      }
    },

    disconnect(devId) {
      const sim = window.PXLNetworkSim;
      const dev = sim ? sim.devices[devId] : null;
      if (!dev || !dev.wireless) return;

      dev.wireless.ssid = '';
      dev.wireless.associatedAp = null;
      dev.wireless.rssi = -95;
      dev.wireless.snr = 0;
      dev.wireless.linkQuality = 0;
      dev.wireless.bars = 0;
      dev.wireless.txRate = 0;

      sim.updateWirelessAssociations();

      if (window.PXLApp) {
        window.PXLApp.showToast('📡 Draadloze verbinding verbroken.');
        window.PXLApp.openPcApp('wireless');
        window.PXLApp.canvasWorkspace.render();
        window.PXLApp.triggerScoreUpdate();
      }
    }
  };

  window.renderPcWirelessAppHtml = renderPcWirelessAppHtml;

})(typeof window !== 'undefined' ? window : this);
