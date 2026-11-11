/**
 * mikrotik_webfig.js - Authentic RouterOS v7 WebFig Web Interface Generator
 * Provides complete WebFig GUI for MikroTik hEX lite (RB750r2)
 * Accessible via Web Browser on Desktop/Laptop or directly via Device Modal
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

function renderMikroTikWebFigHtml(device) {
  const cfg = device.mikrotikConfig || {
    identity: device.hostname || 'MikroTik',
    services: {
      www: { enabled: true, port: 80 },
      ssh: { enabled: true, port: 22 },
      winbox: { enabled: true, port: 8291 }
    }
  };

  const sim = window.PXLNetworkSim;
  const devId = device.id;

  // Build Interfaces Rows
  const intfKeys = ['ether1', 'ether2', 'ether3', 'ether4', 'ether5'];
  let intfRows = '';
  intfKeys.forEach((k, idx) => {
    const intf = device.interfaces[k] || {};
    const isUp = sim ? sim.isLinkUp(device.id, k) : false;
    const linkBadge = isUp ? '<span style="color:#22c55e; font-weight:bold;">R (Running)</span>' : '<span style="color:#94a3b8;">no link</span>';
    const txRx = isUp ? '1.4 kbps / 2.8 kbps' : '0 bps / 0 bps';
    intfRows += `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 6px 10px; font-weight:600;">${idx}</td>
        <td style="padding: 6px 10px; font-weight:bold; color:#38bdf8;">${k}</td>
        <td style="padding: 6px 10px;">ether</td>
        <td style="padding: 6px 10px;">1500</td>
        <td style="padding: 6px 10px; font-family:monospace; font-size:11px;">${intf.mac || '48:8F:5A:01:02:03'}</td>
        <td style="padding: 6px 10px;">${linkBadge}</td>
        <td style="padding: 6px 10px; font-size:11px; color:#cbd5e1;">${txRx}</td>
      </tr>
    `;
  });

  // Build IP Addresses Rows
  let addrRows = '';
  let addrIdx = 0;
  for (const [k, intf] of Object.entries(device.interfaces)) {
    if (intf.ip && intf.mask) {
      const cidr = IPUtils ? IPUtils.maskToPrefix(intf.mask) : 24;
      addrRows += `
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 6px 10px;">${addrIdx++}</td>
          <td style="padding: 6px 10px; font-weight:bold; color:#22c55e;">${intf.ip}/${cidr}</td>
          <td style="padding: 6px 10px;">${intf.ip.substring(0, intf.ip.lastIndexOf('.'))}.0</td>
          <td style="padding: 6px 10px; color:#38bdf8;">${k}</td>
          <td style="padding: 6px 10px;"><button style="background:#ef4444; border:none; color:#fff; border-radius:3px; padding:2px 6px; font-size:10px; cursor:pointer;" onclick="
            const d = window.PXLNetworkSim.devices['${devId}'];
            if (d && d.interfaces['${k}']) {
              d.interfaces['${k}'].ip = '';
              d.interfaces['${k}'].mask = '';
              window.PXLApp.showToast('IP adres verwijderd van ${k}');
              window.PXLApp.triggerScoreUpdate();
              if (window.PXLApp.activeDevice && window.PXLApp.activeDevice.id === '${devId}') window.PXLApp.browseToUrl();
            }
          ">Verwijder</button></td>
        </tr>
      `;
    }
  }

  // Build Routes Rows
  let routeRows = '';
  let rIdx = 0;
  (device.staticRoutes || []).forEach(r => {
    routeRows += `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 6px 10px;">${rIdx++}</td>
        <td style="padding: 6px 10px; font-weight:bold; color:#38bdf8;">${r.network}/${IPUtils ? IPUtils.maskToPrefix(r.mask) : 24}</td>
        <td style="padding: 6px 10px; color:#22c55e;">${r.nextHop || r.interface || '-'}</td>
        <td style="padding: 6px 10px;"><span style="color:#22c55e;">AS (Active Static)</span></td>
      </tr>
    `;
  });

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; background: #1e293b; color: #f8fafc; min-height: 480px; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
      <!-- WebFig Header -->
      <div style="background: #0f172a; padding: 10px 15px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0284c7;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #0284c7; color: #fff; font-weight: 900; font-size: 13px; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px;">MikroTik</div>
          <div>
            <div style="font-size: 14px; font-weight: bold; color: #f8fafc;">RouterOS v7.12 &bull; WebFig</div>
            <div style="font-size: 11px; color: #94a3b8;">Identity: <strong style="color:#38bdf8;">${cfg.identity || device.hostname}</strong> &bull; Model: <strong>RB750r2 (hEX lite)</strong></div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="background: #10b981; color:#fff; font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: bold;">CONNECTED</span>
          <button style="background: #0284c7; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: bold;" onclick="
            alert('Safe Mode toggled on MikroTik Router');
          ">Safe Mode</button>
        </div>
      </div>

      <!-- Main Layout -->
      <div style="display: flex; flex: 1; min-height: 420px;">
        <!-- Left Navigation Bar -->
        <div style="width: 170px; background: #0f172a; border-right: 1px solid #334155; padding: 10px 0; font-size: 12px;">
          <div style="padding: 6px 15px; color: #38bdf8; font-weight: bold; background: rgba(2, 132, 199, 0.15); border-left: 3px solid #0284c7; cursor: pointer;" onclick="document.getElementById('wfSectionQuickSet').style.display='block'; document.getElementById('wfSectionInterfaces').style.display='none'; document.getElementById('wfSectionIp').style.display='none';">⚡ Quick Set</div>
          <div style="padding: 6px 15px; color: #cbd5e1; cursor: pointer;" onclick="document.getElementById('wfSectionQuickSet').style.display='none'; document.getElementById('wfSectionInterfaces').style.display='block'; document.getElementById('wfSectionIp').style.display='none';">🔌 Interfaces</div>
          <div style="padding: 6px 15px; color: #cbd5e1; cursor: pointer;" onclick="document.getElementById('wfSectionQuickSet').style.display='none'; document.getElementById('wfSectionInterfaces').style.display='none'; document.getElementById('wfSectionIp').style.display='block';">🌐 IP Services</div>
          <div style="margin: 15px 15px 5px; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold;">System Info</div>
          <div style="padding: 4px 15px; font-size: 11px; color: #94a3b8;">CPU: <strong>2%</strong></div>
          <div style="padding: 4px 15px; font-size: 11px; color: #94a3b8;">Uptime: <strong>4d 12:35</strong></div>
          <div style="padding: 4px 15px; font-size: 11px; color: #94a3b8;">Free RAM: <strong>51.2 MB</strong></div>
        </div>

        <!-- Right Content Body -->
        <div style="flex: 1; padding: 15px 20px; overflow-y: auto; max-height: 480px; background: #1e293b;">
          
          <!-- SECTION 1: QUICK SET -->
          <div id="wfSectionQuickSet">
            <h4 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 8px;">Quick Set &bull; Home AP / Basic Setup</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px;">
              <div>
                <label style="display: block; color: #94a3b8; margin-bottom: 4px; font-weight: bold;">Router Identity (Hostname):</label>
                <input type="text" id="wfIdentityInput" value="${cfg.identity || device.hostname}" style="width: 100%; padding: 6px 8px; background: #0f172a; border: 1px solid #475569; color: #fff; border-radius: 4px; box-sizing: border-box;">
              </div>
              <div>
                <label style="display: block; color: #94a3b8; margin-bottom: 4px; font-weight: bold;">LAN IP Adres (ether2):</label>
                <input type="text" id="wfLanIpInput" value="${device.interfaces['ether2'] ? device.interfaces['ether2'].ip : '192.168.88.1'}" style="width: 100%; padding: 6px 8px; background: #0f172a; border: 1px solid #475569; color: #fff; border-radius: 4px; box-sizing: border-box;">
              </div>
              <div>
                <label style="display: block; color: #94a3b8; margin-bottom: 4px; font-weight: bold;">Netmask:</label>
                <input type="text" id="wfNetmaskInput" value="${device.interfaces['ether2'] ? device.interfaces['ether2'].mask : '255.255.255.0'}" style="width: 100%; padding: 6px 8px; background: #0f172a; border: 1px solid #475569; color: #fff; border-radius: 4px; box-sizing: border-box;">
              </div>
              <div>
                <label style="display: block; color: #94a3b8; margin-bottom: 4px; font-weight: bold;">Gateway (Default Route):</label>
                <input type="text" id="wfGatewayInput" value="${(device.staticRoutes && device.staticRoutes[0]) ? device.staticRoutes[0].nextHop : ''}" placeholder="192.168.1.1" style="width: 100%; padding: 6px 8px; background: #0f172a; border: 1px solid #475569; color: #fff; border-radius: 4px; box-sizing: border-box;">
              </div>
            </div>

            <!-- Webfig HTTP Service Checkbox -->
            <div style="margin-top: 15px; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; font-size: 12px;">
              <label style="font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="wfWwwServiceChk" ${cfg.services && cfg.services.www && cfg.services.www.enabled !== false ? 'checked' : ''}>
                <span>WebFig (HTTP Webinterface Poort 80) Ingeschakeld</span>
              </label>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; margin-left: 24px;">Wanneer aangevinkt, kunnen aangesloten computers en laptops via een browser verbinden met het IP van deze MikroTik.</div>
            </div>

            <div style="margin-top: 15px; text-align: right;">
              <button class="pt-btn pt-btn-primary" style="padding: 6px 18px; font-weight: bold;" onclick="
                const idName = document.getElementById('wfIdentityInput').value.trim();
                const lanIp = document.getElementById('wfLanIpInput').value.trim();
                const mask = document.getElementById('wfNetmaskInput').value.trim();
                const gw = document.getElementById('wfGatewayInput').value.trim();
                const wwwOn = document.getElementById('wfWwwServiceChk').checked;

                const dev = window.PXLNetworkSim.devices['${devId}'];
                if (dev) {
                  if (idName) {
                    dev.hostname = idName;
                    if (dev.mikrotikConfig) dev.mikrotikConfig.identity = idName;
                  }
                  if (lanIp && dev.interfaces['ether2']) {
                    dev.interfaces['ether2'].ip = lanIp;
                    dev.interfaces['ether2'].mask = mask || '255.255.255.0';
                  }
                  if (gw) {
                    dev.staticRoutes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: gw }];
                  }
                  if (dev.mikrotikConfig && dev.mikrotikConfig.services) {
                    if (!dev.mikrotikConfig.services.www) dev.mikrotikConfig.services.www = { port: 80 };
                    dev.mikrotikConfig.services.www.enabled = wwwOn;
                  }
                  window.PXLApp.showToast('✅ MikroTik WebFig configuratie succesvol opgeslagen');
                  window.PXLApp.triggerScoreUpdate();
                }
              ">Apply Configuration</button>
            </div>
          </div>

          <!-- SECTION 2: INTERFACES -->
          <div id="wfSectionInterfaces" style="display: none;">
            <h4 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 8px;">Interface List (RouterBOARD hEX lite)</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 4px;">
              <thead>
                <tr style="background: #0284c7; color: #fff; text-align: left;">
                  <th style="padding: 6px 10px;">#</th>
                  <th style="padding: 6px 10px;">Name</th>
                  <th style="padding: 6px 10px;">Type</th>
                  <th style="padding: 6px 10px;">MTU</th>
                  <th style="padding: 6px 10px;">MAC Address</th>
                  <th style="padding: 6px 10px;">Link</th>
                  <th style="padding: 6px 10px;">Tx / Rx Rate</th>
                </tr>
              </thead>
              <tbody>
                ${intfRows}
              </tbody>
            </table>
          </div>

          <!-- SECTION 3: IP ADDRESSES & ROUTES -->
          <div id="wfSectionIp" style="display: none;">
            <h4 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 8px;">IP Address List</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 4px; margin-bottom: 15px;">
              <thead>
                <tr style="background: #0284c7; color: #fff; text-align: left;">
                  <th style="padding: 6px 10px;">#</th>
                  <th style="padding: 6px 10px;">Address</th>
                  <th style="padding: 6px 10px;">Network</th>
                  <th style="padding: 6px 10px;">Interface</th>
                  <th style="padding: 6px 10px;">Actie</th>
                </tr>
              </thead>
              <tbody>
                ${addrRows || '<tr><td colspan="5" style="padding:8px; text-align:center; color:#94a3b8;">Geen IP adressen geconfigureerd</td></tr>'}
              </tbody>
            </table>

            <!-- Add IP Form -->
            <div style="background: #0f172a; border: 1px dashed #475569; padding: 10px; border-radius: 4px; display: flex; gap: 10px; align-items: center; font-size: 12px; margin-bottom: 20px;">
              <span style="font-weight: bold; color: #38bdf8;">+ Nieuw IP:</span>
              <input type="text" id="wfNewIpAddr" placeholder="192.168.10.1/24" style="padding: 4px 8px; background: #1e293b; border: 1px solid #475569; color: #fff; border-radius: 3px; width: 140px;">
              <select id="wfNewIpIntf" style="padding: 4px 8px; background: #1e293b; border: 1px solid #475569; color: #fff; border-radius: 3px;">
                <option value="ether1">ether1 (WAN)</option>
                <option value="ether2">ether2 (LAN)</option>
                <option value="ether3">ether3</option>
                <option value="ether4">ether4</option>
                <option value="ether5">ether5</option>
              </select>
              <button class="pt-btn pt-btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="
                const val = document.getElementById('wfNewIpAddr').value.trim();
                const intfName = document.getElementById('wfNewIpIntf').value;
                if (val && intfName) {
                  let ip = val, cidr = '24';
                  if (val.includes('/')) {
                    [ip, cidr] = val.split('/');
                  }
                  const mask = IPUtils ? IPUtils.cidrToMask(parseInt(cidr,10) || 24) : '255.255.255.0';
                  const dev = window.PXLNetworkSim.devices['${devId}'];
                  if (dev && dev.interfaces[intfName]) {
                    dev.interfaces[intfName].ip = ip;
                    dev.interfaces[intfName].mask = mask;
                    window.PXLApp.showToast('✅ IP ' + ip + '/' + cidr + ' toegekend aan ' + intfName);
                    window.PXLApp.triggerScoreUpdate();
                    if (window.PXLApp.activeDevice && window.PXLApp.activeDevice.id === '${devId}') window.PXLApp.browseToUrl();
                  }
                }
              ">Toevoegen</button>
            </div>

            <h4 style="margin-top: 0; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 8px;">IP Routes (Routing Table)</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 4px;">
              <thead>
                <tr style="background: #0284c7; color: #fff; text-align: left;">
                  <th style="padding: 6px 10px;">#</th>
                  <th style="padding: 6px 10px;">Dst. Address</th>
                  <th style="padding: 6px 10px;">Gateway</th>
                  <th style="padding: 6px 10px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${routeRows || '<tr><td colspan="4" style="padding:8px; text-align:center; color:#94a3b8;">Geen static routes geconfigureerd</td></tr>'}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderMikroTikWebFigHtml = renderMikroTikWebFigHtml;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderMikroTikWebFigHtml };
}
