/**
 * network_simulator.js - Dynamic Network Graph Simulation & Routing Engine
 * Simulates Layer 2 switching, MAC learning, ARP, Layer 3 IP routing, and Wireless
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class NetworkSimulator {
  constructor() {
    this.devices = {};   // id -> CiscoDevice
    this.cables = [];    // array of Cable objects
    this.wirelessAssociations = {}; // laptopId -> apId
    this.liveInternetEnabled = false;
    this.packetCaptureLog = [];
    this.captureActive = true;
    this.fetchLiveInternetStatus();
  }

  async fetchLiveInternetStatus() {
    try {
      const res = await fetch('/api/settings/live-internet');
      if (res.ok) {
        const data = await res.json();
        this.liveInternetEnabled = data.live_internet_enabled === true;
      }
    } catch (e) {
      // Offline fallback
    }
  }

  setLiveInternet(enabled) {
    this.liveInternetEnabled = !!enabled;
    fetch('/api/settings/live-internet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: this.liveInternetEnabled })
    }).catch(() => {});
  }

  isInternetDevice(dev) {
    return !!(dev && (dev.type === 'internet_cloud' || dev.type === 'internet_simulated' || dev.type === 'internet_public'));
  }

  registerDevice(device) {
    this.devices[device.id] = device;
  }

  addDevice(device) {
    this.registerDevice(device);
  }

  removeDevice(deviceId) {
    // Remove connected cables
    this.cables = this.cables.filter(c => c.fromDevice !== deviceId && c.toDevice !== deviceId);
    delete this.devices[deviceId];
    delete this.wirelessAssociations[deviceId];
  }

  clear() {
    this.devices = {};
    this.cables = [];
    this.wirelessAssociations = {};
  }

  // --- CABLING & LAYER 1/2 TOPOLOGY ---

  addCable(cable) {
    // Check if either port is already cabled
    this.removeCableFromPort(cable.fromDevice, cable.fromPort);
    this.removeCableFromPort(cable.toDevice, cable.toPort);
    this.cables.push(cable);
  }

  removeCable(cableId) {
    this.cables = this.cables.filter(c => c.id !== cableId);
  }

  removeCableFromPort(devId, portName) {
    this.cables = this.cables.filter(c =>
      !( (c.fromDevice === devId && c.fromPort === portName) ||
         (c.toDevice === devId && c.toPort === portName) )
    );
  }

  getCableOnPort(devId, portName) {
    return this.cables.find(c =>
      (c.fromDevice === devId && c.fromPort === portName) ||
      (c.toDevice === devId && c.toPort === portName)
    );
  }

  getConnectedPeer(devId, portName) {
    const cable = this.getCableOnPort(devId, portName);
    if (!cable) return null;
    if (cable.fromDevice === devId && cable.fromPort === portName) {
      return { deviceId: cable.toDevice, portName: cable.toPort, cable: cable };
    } else {
      return { deviceId: cable.fromDevice, portName: cable.fromPort, cable: cable };
    }
  }

  getConsoleConnection(devId) {
    for (const cable of this.cables) {
      if (cable.type === 'console') {
        if (cable.fromDevice === devId) {
          const targetDev = this.devices[cable.toDevice];
          if (targetDev) return { localPort: cable.fromPort, targetDevice: targetDev, targetPort: cable.toPort, cable };
        } else if (cable.toDevice === devId) {
          const targetDev = this.devices[cable.fromDevice];
          if (targetDev) return { localPort: cable.toPort, targetDevice: targetDev, targetPort: cable.fromPort, cable };
        }
      }
    }
    return null;
  }

  /**
   * Evaluates if a physical link is active and operational (UP/UP)
   */
  isLinkUp(devId, portName) {
    const dev = this.devices[devId];
    if (!dev || !dev.powerOn) return false;

    // Wireless connection check
    if (portName === 'Wireless0') {
      const apId = this.wirelessAssociations[devId];
      if (apId && this.devices[apId] && this.devices[apId].powerOn) return true;
      return false;
    }

    const peer = this.getConnectedPeer(devId, portName);
    if (!peer) return false;

    const peerDev = this.devices[peer.deviceId];
    if (!peerDev || !peerDev.powerOn) return false;

    if (peer.cable && peer.cable.type === 'console') {
      return true;
    }

    const intf = dev.interfaces[portName];
    const peerIntf = peerDev.interfaces[peer.portName];

    if (!intf || !peerIntf) return false;
    if (intf.shutdown || peerIntf.shutdown) return false;

    return true;
  }

  // --- WIRELESS MANAGEMENT ---
  updateWirelessAssociations() {
    this.wirelessAssociations = {};
    const aps = Object.values(this.devices).filter(d => d.type === 'wireless_ap' && d.powerOn);
    const wirelessClients = Object.values(this.devices).filter(d => (d.type === 'laptop' || d.type === 'pc') && d.wireless && d.wireless.enabled && d.powerOn);

    for (const client of wirelessClients) {
      for (const ap of aps) {
        if (client.wireless.ssid && client.wireless.ssid === ap.wireless.ssid) {
          // Check passphrase if WPA2
          if (ap.wireless.authMode === 'WPA2-PSK') {
            if (client.wireless.passphrase === ap.wireless.passphrase) {
              this.wirelessAssociations[client.id] = ap.id;
              client.wireless.associatedAp = ap.id;
              break;
            }
          } else {
            this.wirelessAssociations[client.id] = ap.id;
            client.wireless.associatedAp = ap.id;
            break;
          }
        }
      }
      if (!this.wirelessAssociations[client.id]) {
        client.wireless.associatedAp = null;
      }
    }
  }

  // --- LAYER 2 BROADCAST DOMAIN DISCOVERY ---
  /**
   * Finds all device interfaces accessible in the same broadcast domain
   */
  getL2BroadcastDomain(startDevId, startPort) {
    const domain = []; // array of { devId, portName, ip, mask, mac }
    const visitedPorts = new Set();
    const queue = [{ devId: startDevId, portName: startPort }];

    while (queue.length > 0) {
      const item = queue.shift();
      const key = `${item.devId}:${item.portName}`;
      if (visitedPorts.has(key)) continue;
      visitedPorts.add(key);

      const dev = this.devices[item.devId];
      if (!dev || !dev.powerOn) continue;

      // Handle wireless client/AP traversal
      if (item.portName === 'Wireless0' && dev.type === 'wireless_ap') {
        for (const [clientId, apId] of Object.entries(this.wirelessAssociations)) {
          if (apId === dev.id) {
            queue.push({ devId: clientId, portName: 'Wireless0' });
          }
        }
      } else if (item.portName === 'Wireless0' && dev.wireless && dev.wireless.associatedAp) {
        queue.push({ devId: dev.wireless.associatedAp, portName: 'Wireless0' });
      }

      // Handle switch SVI (Vlan1 or any VlanX) traversal: fan out across all physical switch ports in this VLAN
      if ((dev.type === 'switch' || dev.type === 'hpe_switch') && (item.portName === 'Vlan1' || item.portName.startsWith('Vlan'))) {
        for (const [pName, pIntf] of Object.entries(dev.interfaces)) {
          if (!pName.startsWith('Vlan') && pName !== 'Console' && pName !== 'Aux' && pName !== 'RS 232' && pName !== 'USB0' && !pIntf.shutdown) {
            queue.push({ devId: dev.id, portName: pName });
          }
        }
        continue;
      }

      // Check direct wired link
      const peer = this.getConnectedPeer(item.devId, item.portName);
      if (peer) {
        const peerDev = this.devices[peer.deviceId];
        if (peerDev && peerDev.powerOn) {
          const peerIntf = peerDev.interfaces[peer.portName];
          if (peerIntf && !peerIntf.shutdown) {
            if (peerDev.type === 'switch' || peerDev.type === 'hpe_switch') {
              // Switch bridges all other active ports in the same VLAN
              for (const [pName, pIntf] of Object.entries(peerDev.interfaces)) {
                if (!pName.startsWith('Vlan') && pName !== 'Console' && pName !== 'Aux' && pName !== 'RS 232' && pName !== 'USB0' && pName !== peer.portName && !pIntf.shutdown) {
                  queue.push({ devId: peerDev.id, portName: pName });
                }
              }
              // Switch SVI Vlan1 IP is also present on this domain
              const sviIp = peerDev.interfaces['Vlan1']?.ip || peerDev.ip || (peerDev.hpeConfig && peerDev.hpeConfig.mgmtIp);
              const sviMask = peerDev.interfaces['Vlan1']?.mask || peerDev.mask || (peerDev.hpeConfig && peerDev.hpeConfig.mgmtMask) || '255.255.255.0';
              if (sviIp) {
                domain.push({
                  devId: peerDev.id,
                  portName: 'Vlan1',
                  ip: sviIp,
                  mask: sviMask,
                  mac: peerDev.interfaces['Vlan1']?.mac || '0019.5e.00.00.01'
                });
              }
            } else {
              // Non-switch end node or router interface
              const ip = (peerDev.type === 'pc' || peerDev.type === 'laptop' || peerDev.type === 'server') ? peerDev.ip : peerIntf.ip;
              const mask = (peerDev.type === 'pc' || peerDev.type === 'laptop' || peerDev.type === 'server') ? peerDev.mask : peerIntf.mask;
              domain.push({
                devId: peerDev.id,
                portName: peer.portName,
                ip: ip,
                mask: mask,
                mac: peerIntf.mac
              });
            }
          }
        }
      }
    }
    return domain;
  }

  // --- LAYER 3 PACKET FORWARDING & PING ---

  /**
   * Executes a simulated ICMP ping from srcDevId to targetIp
   * Performs dynamic ARP lookup, switch forwarding, and router hop traversal.
   */
  executePing(srcDevId, targetIp) {
    this.updateWirelessAssociations();
    const hops = [];
    const srcDev = (typeof srcDevId === 'object' && srcDevId !== null) ? srcDevId : this.devices[srcDevId];
    if (!srcDev || !srcDev.powerOn || !IPUtils.isValidIp(targetIp)) {
      return { success: false, hops, reason: 'Invalid source device or target IP' };
    }
    srcDevId = srcDev.id;

    // Ping to self
    if (srcDev.ip === targetIp) {
      this.recordIcmpExchange(srcDev, srcDev, srcDev.ip, targetIp, true, [targetIp]);
      return { success: true, hops: [targetIp], reason: 'Echo reply from self' };
    }
    for (const intf of Object.values(srcDev.interfaces)) {
      if (intf.ip === targetIp && !intf.shutdown) {
        this.recordIcmpExchange(srcDev, srcDev, intf.ip, targetIp, true, [targetIp]);
        return { success: true, hops: [targetIp], reason: 'Echo reply from self' };
      }
    }

    // Check if destination device exists directly in local topology
    const dstInfo = this.findDeviceByIp(targetIp);
    const inetCloud = Object.values(this.devices).find(d => this.isInternetDevice(d) && d.powerOn);

    if (!dstInfo && !inetCloud) {
      this.recordIcmpExchange(srcDev, null, srcDev.ip || '0.0.0.0', targetIp, false, []);
      return { success: false, hops, reason: 'Destination host unreachable (no device has this IP)' };
    }

    // Step 1: Forward path (src -> dst or src -> internet_cloud)
    const forwardPath = this.routePacket(srcDevId, targetIp);
    if (!forwardPath.success) {
      this.recordIcmpExchange(srcDev, dstInfo?.device, srcDev.ip || '0.0.0.0', targetIp, false, forwardPath.hops);
      return { success: false, hops: forwardPath.hops, reason: forwardPath.reason };
    }

    // If destination was Het Internet cloud simulator, echo reply is guaranteed!
    if (forwardPath.isInternet || !dstInfo) {
      hops.push(...forwardPath.hops);
      this.recordIcmpExchange(srcDev, inetCloud, srcDev.ip || '192.168.1.10', targetIp, true, forwardPath.hops);
      return { success: true, hops: forwardPath.hops, reason: 'Echo reply from Het Internet' };
    }

    // Step 2: Return path (dst -> src)
    let srcIp = (srcDev.type === 'pc' || srcDev.type === 'laptop' || srcDev.type === 'server')
      ? srcDev.ip
      : (forwardPath.ingressIp || srcDev.ip || srcDev.interfaces['Vlan1']?.ip || Object.values(srcDev.interfaces).find(i => i.ip && !i.shutdown)?.ip);

    if (!srcIp && (srcDev.type === 'switch' || srcDev.type === 'hpe_switch')) {
      srcIp = srcDev.interfaces['Vlan1']?.ip || srcDev.ip || (srcDev.hpeConfig && srcDev.hpeConfig.mgmtIp);
    }

    if (!srcIp) return { success: false, hops: forwardPath.hops, reason: 'Source has no valid IP' };

    const returnPath = this.routePacket(dstInfo.device.id, srcIp);
    if (!returnPath.success) {
      this.recordIcmpExchange(srcDev, dstInfo.device, srcIp, targetIp, false, forwardPath.hops);
      return { success: false, hops: forwardPath.hops, reason: 'Echo request reached destination, but reply route failed' };
    }

    // Successful ICMP ping! Record both ARP resolution and ICMP Echo packets
    this.recordArpExchange(srcDev, dstInfo.device, srcIp, targetIp);
    this.recordIcmpExchange(srcDev, dstInfo.device, srcIp, targetIp, true, forwardPath.hops);

    return { success: true, hops: forwardPath.hops, reason: 'Success' };
  }

  testPing(srcDevId, targetIp) {
    const res = this.executePing(srcDevId, targetIp);
    return res.success;
  }

  traceRoute(srcDevId, targetIp) {
    const res = this.executePing(srcDevId, targetIp);
    return res.hops;
  }

  // --- DNS & HTTP & FTP SERVICES SIMULATION ---
  resolveDns(srcDevId, domainName) {
    const cleanHost = domainName.replace(/^https?:\/\//i, '').split('/')[0].trim();
    const srcDev = this.devices[srcDevId];
    if (!srcDev) {
      return { success: false, reason: 'Invalid source device' };
    }

    // If Het Internet cloud is active in the network, it provides automatic public DNS resolution!
    const inetCloud = Object.values(this.devices).find(d => this.isInternetDevice(d) && d.powerOn);
    if (inetCloud) {
      const routeToInet = this.routePacket(srcDevId, inetCloud.interfaces['WAN']?.ip || '8.8.8.8');
      if (routeToInet.success) {
        return { success: true, ip: inetCloud.type === 'internet_public' ? '8.8.8.8' : '193.190.173.1', dnsServerIp: '8.8.8.8' };
      }
    }

    if (!srcDev.dns) {
      return { success: false, reason: 'DNS server IP not configured on host' };
    }
    const dnsIp = srcDev.dns;
    const pingResult = this.executePing(srcDevId, dnsIp);
    if (!pingResult.success) {
      return { success: false, reason: `DNS server ${dnsIp} unreachable (timeout)` };
    }
    const dstInfo = this.findDeviceByIp(dnsIp);
    if (!dstInfo || !dstInfo.device.services || !dstInfo.device.services.dns || !dstInfo.device.services.dns.enabled) {
      return { success: false, reason: `DNS service inactive or not running on ${dnsIp}` };
    }
    const rec = dstInfo.device.services.dns.records.find(r => r.name.toLowerCase() === cleanHost.toLowerCase());
    if (!rec) {
      return { success: false, reason: `Host Name Unresolved: '${cleanHost}' not found in DNS zone` };
    }
    this.recordDnsExchange(srcDev, dstInfo.device, cleanHost, rec.ip);
    return { success: true, ip: rec.ip, dnsServerIp: dnsIp };
  }

  fetchHttp(srcDevId, target) {
    let cleanTarget = target.replace(/^https?:\/\//i, '').trim();
    let slashIdx = cleanTarget.indexOf('/');
    let hostPart = slashIdx !== -1 ? cleanTarget.substring(0, slashIdx).trim() : cleanTarget;
    let pathPart = slashIdx !== -1 ? cleanTarget.substring(slashIdx) : '/';
    if (!pathPart) pathPart = '/';

    let targetIp = hostPart;

    if (!IPUtils.isValidIp(hostPart)) {
      const dnsRes = this.resolveDns(srcDevId, hostPart);
      if (!dnsRes.success) {
        return { success: false, reason: dnsRes.reason };
      }
      targetIp = dnsRes.ip;
    }

    const pingResult = this.executePing(srcDevId, targetIp);
    if (!pingResult.success) {
      return { success: false, reason: `Request Timeout: could not connect to ${targetIp}:80` };
    }

    // Check if packet was received by Internet Cloud Gateway (Simulated or Public NAT)
    const inetCloud = Object.values(this.devices).find(d => this.isInternetDevice(d) && d.powerOn);
    if (inetCloud && (pingResult.reason === 'Echo reply from Het Internet' || pingResult.hops.some(h => String(h).includes('Internet')) || targetIp === '193.190.173.1' || !this.findDeviceByIp(targetIp))) {
      const isLive = (inetCloud.type === 'internet_public' || (inetCloud.type === 'internet_cloud' && this.liveInternetEnabled));
      if (isLive) {
        return {
          success: true,
          targetIp: targetIp,
          isLiveProxy: true,
          liveUrl: target.startsWith('http') ? target : `http://${target}`
        };
      }

      return {
        success: true,
        targetIp: targetIp,
        html: this.getInternetLandingHtml(target)
      };
    }

    const dstInfo = this.findDeviceByIp(targetIp);
    if (!dstInfo) {
      return { success: false, reason: `Destination host unreachable: ${targetIp}` };
    }

    const dstDev = dstInfo.device;

    // 1. MikroTik RouterOS WebFig (HTTP Port 80)
    if (dstDev.type === 'mikrotik') {
      const isWwwOn = dstDev.mikrotikConfig?.services?.www?.enabled !== false;
      if (!isWwwOn) {
        return { success: false, reason: `Connection Refused: WebFig (HTTP port 80) is uitgeschakeld op ${dstDev.hostname}` };
      }
      if (typeof renderMikroTikWebFigHtml === 'function') {
        return { success: true, targetIp, html: renderMikroTikWebFigHtml(dstDev) };
      }
    }

    // 2. HPE Aruba Switch Web Management (HTTP Port 80)
    if (dstDev.type === 'hpe_switch' || (dstDev.hpeConfig && dstDev.hpeConfig.webManagement)) {
      const isWebOn = dstDev.hpeConfig?.webManagement?.enabled !== false;
      if (!isWebOn) {
        return { success: false, reason: `Connection Refused: HPE Web Management is uitgeschakeld op ${dstDev.hostname}` };
      }
      if (typeof renderHpeWebInterfaceHtml === 'function') {
        return { success: true, targetIp, html: renderHpeWebInterfaceHtml(dstDev) };
      }
    }

    if (!dstDev.services || !dstDev.services.http || !dstDev.services.http.enabled) {
      return { success: false, reason: `Connection Refused: HTTP web service inactive on ${targetIp}` };
    }

    const srvHttp = dstInfo.device.services.http;
    let requestedFileName = pathPart.replace(/^\/+/, '');
    if (!requestedFileName || requestedFileName === 'index.html') {
      const respHtml = srvHttp.content || (srvHttp.files && srvHttp.files['index.html']) || '<h1>PXL Web Server</h1>';
      this.recordHttpExchange(this.devices[srcDevId], dstDev, (this.devices[srcDevId]?.ip || '192.168.1.10'), targetIp, 'GET', pathPart, 200, respHtml);
      return {
        success: true,
        targetIp: targetIp,
        html: respHtml
      };
    }

    if (srvHttp.files && srvHttp.files[requestedFileName]) {
      const fileData = srvHttp.files[requestedFileName];
      if (requestedFileName.endsWith('.json')) {
        return {
          success: true,
          targetIp: targetIp,
          html: `<pre style="font-family: monospace; background: #1e293b; color: #38bdf8; padding: 15px; border-radius: 6px;">${fileData}</pre>`
        };
      }
      if (requestedFileName.endsWith('.css') || requestedFileName.endsWith('.txt')) {
        return {
          success: true,
          targetIp: targetIp,
          html: `<pre style="font-family: monospace; padding: 15px; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px;">${fileData}</pre>`
        };
      }
      return {
        success: true,
        targetIp: targetIp,
        html: fileData
      };
    }

    return {
      success: false,
      reason: `HTTP 404 Not Found: Bestand '${requestedFileName}' niet gevonden op ${targetIp}`
    };
  }

  getInternetLandingHtml(target) {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b132b; color: #f8fafc; min-height: 420px; padding: 25px; border-radius: 8px; text-align: center; box-sizing: border-box;">
        <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 25px; max-width: 580px; margin: 0 auto; box-shadow: 0 15px 35px rgba(0,0,0,0.6);">
          <div style="margin-bottom: 15px;">
            <img src="img/pxl_logo.png" alt="Hogeschool PXL" style="height: 60px; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));">
          </div>
          <div style="display: inline-block; background: #0284c7; color: #ffffff; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 12px;">
            🌐 PXL NETSIM • GLOBAL INTERNET GATEWAY
          </div>
          <h1 style="color: #38bdf8; font-size: 26px; margin: 0 0 10px 0; font-weight: 800;">Welkom op het Internet</h1>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
            Gefeliciteerd! Jouw netwerkpakketten hebben met succes de lokale netwerkinfrastructuur en de default gateway doorlopen en hebben het wereldwijde Internet bereikt via de virtuele <strong>Het Internet</strong> Cloud.
          </p>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; text-align: left;">
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">OPGEVRAAGD ADRES</div>
              <div style="font-size: 12px; font-weight: bold; color: #38bdf8; word-break: break-all;">${target}</div>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">WAN LATENCY</div>
              <div style="font-size: 12px; font-weight: bold; color: #10b981;">12 ms (Optimaal)</div>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">STATUS</div>
              <div style="font-size: 12px; font-weight: bold; color: #10b981;">● Verbonden</div>
            </div>
          </div>
          <div style="font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
            Hogeschool PXL • Departement Toegepaste Informatica • System & Network Engineering (SNE)
          </div>
        </div>
      </div>
    `;
  }

  findDeviceByIp(targetIp) {
    for (const dev of Object.values(this.devices)) {
      if (!dev.powerOn) continue;
      if (dev.ip === targetIp) {
        return { device: dev, portName: (dev.type === 'switch' || dev.type === 'hpe_switch') ? 'Vlan1' : 'FastEthernet0' };
      }
      for (const [pName, intf] of Object.entries(dev.interfaces)) {
        if (intf.ip === targetIp) {
          if (pName === 'Vlan1' && (dev.type === 'switch' || dev.type === 'hpe_switch')) {
            return { device: dev, portName: pName };
          }
          if (!intf.shutdown) {
            return { device: dev, portName: pName };
          }
        }
      }
      if (dev.hpeConfig && dev.hpeConfig.mgmtIp === targetIp) {
        return { device: dev, portName: 'Vlan1' };
      }
    }
    return null;
  }

  /**
   * Simulates packet routing from current device to destination IP
   */
  routePacket(currentDevId, targetIp, visited = new Set(), hops = []) {
    if (visited.has(currentDevId) || visited.size > 20) {
      return { success: false, hops, reason: 'Routing loop detected (TTL expired)' };
    }
    visited.add(currentDevId);

    const dev = this.devices[currentDevId];
    if (!dev || !dev.powerOn) {
      return { success: false, hops, reason: `Device ${currentDevId} is down` };
    }

    // Internet Cloud Gateway terminates and answers all external requests
    if (this.isInternetDevice(dev)) {
      hops.push(dev.hostname || 'Het Internet');
      return { success: true, hops, ingressIp: '193.190.173.1', isInternet: true };
    }

    // Check if any port on this device connects directly to Internet cloud gateway
    for (const [portName, intf] of Object.entries(dev.interfaces)) {
      if (intf.shutdown) continue;
      const peer = this.getConnectedPeer(dev.id, portName);
      if (peer) {
        const peerDev = this.devices[peer.deviceId];
        if (peerDev && this.isInternetDevice(peerDev) && peerDev.powerOn) {
          hops.push(intf.ip || dev.hostname);
          return this.routePacket(peerDev.id, targetIp, visited, hops);
        }
      }
    }

    // Check all active interfaces on this device for local subnet match
    for (const [portName, intf] of Object.entries(dev.interfaces)) {
      let myIp = (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') ? dev.ip : intf.ip;
      let myMask = (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') ? dev.mask : intf.mask;

      if ((dev.type === 'switch' || dev.type === 'hpe_switch') && portName === 'Vlan1') {
        if (!myIp) myIp = dev.ip || (dev.hpeConfig && dev.hpeConfig.mgmtIp);
        if (!myMask) myMask = dev.mask || (dev.hpeConfig && dev.hpeConfig.mgmtMask) || '255.255.255.0';
      }

      if (!myIp || !myMask) continue;
      if (intf.shutdown && portName !== 'Vlan1') continue;

      // Are target and this interface in the same subnet?
      if (IPUtils.isSameSubnet(myIp, targetIp, myMask)) {
        // Direct delivery on local subnet
        const domain = this.getL2BroadcastDomain(dev.id, portName);
        const match = domain.find(d => d.ip === targetIp);
        if (match) {
          hops.push(targetIp);
          return { success: true, hops, ingressIp: myIp };
        }
      }
    }

    // Not on local subnet -> must forward to next hop
    let nextHopIp = null;

    if (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') {
      nextHopIp = dev.gateway;
    } else if (dev.type === 'switch' || dev.type === 'hpe_switch') {
      nextHopIp = dev.defaultGateway || (dev.hpeConfig && dev.hpeConfig.defaultGateway);
    } else if (dev.type === 'router' || dev.type === 'mikrotik' || dev.type === 'openwrt') {
      // Longest prefix match in static routes
      let bestMatch = null;
      let bestPrefix = -1;

      for (const r of dev.staticRoutes) {
        const prefix = IPUtils.maskToPrefix(r.mask);
        if (r.network === '0.0.0.0' && r.mask === '0.0.0.0') {
          if (bestPrefix < 0) {
            bestMatch = r;
            bestPrefix = 0;
          }
        } else if (IPUtils.isSameSubnet(targetIp, r.network, r.mask)) {
          if (prefix > bestPrefix) {
            bestMatch = r;
            bestPrefix = prefix;
          }
        }
      }

      if (bestMatch) {
        nextHopIp = bestMatch.nextHop;
        if (!nextHopIp && bestMatch.interface) {
          // Point-to-point interface next-hop
          const peer = this.getConnectedPeer(dev.id, bestMatch.interface);
          if (peer) {
            hops.push(dev.interfaces[bestMatch.interface]?.ip || dev.hostname);
            return this.routePacket(peer.deviceId, targetIp, visited, hops);
          }
        }
      }
    }

    if (!nextHopIp || !IPUtils.isValidIp(nextHopIp)) {
      return { success: false, hops, reason: `No route to host from ${dev.hostname}` };
    }

    hops.push(nextHopIp);

    // Find who owns the next-hop IP
    const nextHopDev = this.findDeviceByIp(nextHopIp);
    if (!nextHopDev) {
      return { success: false, hops, reason: `Next-hop ${nextHopIp} unreachable (ARP failed)` };
    }

    return this.routePacket(nextHopDev.device.id, targetIp, visited, hops);
  }

  exportTopology() {
    return {
      devices: Object.values(this.devices).map(d => ({
        id: d.id,
        type: d.type,
        model: d.model,
        hostname: d.hostname,
        displayName: d.displayName,
        x: d.x,
        y: d.y,
        powerOn: d.powerOn,
        config: d.snapshotConfig(),
        savedStartupConfig: d.savedStartupConfig,
        terminalBuffer: d.terminalBuffer
      })),
      cables: this.cables
    };
  }

  importTopology(data) {
    if (!data) return;
    this.clear();
    if (data.devices) {
      data.devices.forEach(d => {
        const dev = new CiscoDevice(d.id, d.type, d.hostname, {
          model: d.model,
          x: d.x,
          y: d.y,
          powerOn: d.powerOn !== false
        });
        if (d.config) {
          dev.restoreConfig(d.config);
        }
        if (d.savedStartupConfig) {
          dev.savedStartupConfig = d.savedStartupConfig;
        }
        if (d.terminalBuffer) {
          dev.terminalBuffer = d.terminalBuffer;
        }
        this.registerDevice(dev);
      });
    }
    if (data.cables) {
      data.cables.forEach(c => {
        this.addCable(c);
      });
    }
  }

  // --- PACKET CAPTURE & PROTOCOL ANALYSIS (WIRESHARK & PACKET TRACER OSI ENGINE) ---

  logPacket(packet) {
    if (!this.captureActive) return;
    if (!this.packetCaptureLog) this.packetCaptureLog = [];
    packet.id = this.packetCaptureLog.length + 1;
    packet.timestamp = packet.timestamp !== undefined ? packet.timestamp : (this.packetCaptureLog.length * 0.00142);
    if (!packet.timeFormatted) {
      const d = new Date();
      packet.timeFormatted = `${d.toTimeString().split(' ')[0]}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    }
    this.packetCaptureLog.push(packet);
    if (this.packetCaptureLog.length > 1000) {
      this.packetCaptureLog.shift();
    }

    // Register packet event with Simulation Engine (Realtime vs Simulation Mode)
    if (typeof window !== 'undefined' && window.PXLApp?.simulationEngine) {
      window.PXLApp.simulationEngine.addPacketEvent(packet);
    }

    const isSimulationMode = Boolean(typeof window !== 'undefined' && window.PXLApp?.simulationEngine?.mode === 'simulation');

    // In Realtime mode, trigger visual packet animation on canvas workspace immediately
    if (!isSimulationMode && typeof window !== 'undefined' && window.PXLApp?.canvasWorkspace && packet.srcDevId) {
      const cw = window.PXLApp.canvasWorkspace;
      if (packet.dstDevId === 'broadcast') {
        for (const cable of this.cables) {
          if (cable.fromDevice === packet.srcDevId) {
            cw.enqueueFlyingPacket(packet.srcDevId, cable.toDevice, packet.protocol, packet.protocol, packet);
          } else if (cable.toDevice === packet.srcDevId) {
            cw.enqueueFlyingPacket(packet.srcDevId, cable.fromDevice, packet.protocol, packet.protocol, packet);
          }
        }
      } else if (packet.dstDevId && packet.dstDevId !== packet.srcDevId && this.devices[packet.dstDevId]) {
        cw.enqueueFlyingPacket(packet.srcDevId, packet.dstDevId, packet.protocol, packet.protocol, packet);
      }
    }

    if (typeof window !== 'undefined' && window.PXLWireshark && typeof window.PXLWireshark.render === 'function') {
      const tb = document.getElementById('wsPacketTableBody');
      if (tb) {
        window.PXLWireshark.render();
      }
    }
  }

  clearPacketLog() {
    this.packetCaptureLog = [];
  }

  _getDevMac(dev) {
    if (!dev) return '00:19:5e:3b:00:01';
    const raw = dev.interfaces?.['FastEthernet0']?.mac || dev.interfaces?.['Vlan1']?.mac || Object.values(dev.interfaces || {}).find(i => i.mac)?.mac || '0050.7966.6801';
    const clean = raw.replace(/[^0-9a-fA-F]/g, '');
    const parts = [];
    for (let i = 0; i < 12 && i < clean.length; i += 2) {
      parts.push(clean.substr(i, 2));
    }
    while (parts.length < 6) parts.push('00');
    return parts.join(':').toLowerCase();
  }

  recordArpExchange(srcDev, dstDev, srcIp, dstIp) {
    const srcMac = this._getDevMac(srcDev);
    const dstMac = this._getDevMac(dstDev);
    const srcName = srcDev ? (srcDev.hostname || srcDev.id) : 'Host';
    const dstName = dstDev ? (dstDev.hostname || dstDev.id) : 'Host';

    // 1. ARP Request (Broadcast)
    this.logPacket({
      srcDevId: srcDev?.id,
      srcDevName: srcName,
      dstDevId: 'broadcast',
      dstDevName: 'Broadcast',
      ingressPort: 'FastEthernet0',
      egressPort: 'FastEthernet0',
      protocol: 'ARP',
      length: 60,
      srcIp: srcIp,
      dstIp: dstIp,
      info: `Who has ${dstIp}? Tell ${srcIp}`,
      summary: `ARP Request for ${dstIp}`,
      l2: {
        type: 'Ethernet II',
        srcMac: srcMac,
        dstMac: 'ff:ff:ff:ff:ff:ff',
        etherType: '0x0806',
        fcs: '0x4a3b1c2d'
      },
      l3: {
        arp: {
          hwType: 1,
          protoType: '0x0800',
          hwSize: 6,
          protoSize: 4,
          opcode: 1, // Request
          senderMac: srcMac,
          senderIp: srcIp,
          targetMac: '00:00:00:00:00:00',
          targetIp: dstIp
        }
      }
    });

    // 2. ARP Reply (Unicast) if destination known
    if (dstDev) {
      this.logPacket({
        srcDevId: dstDev.id,
        srcDevName: dstName,
        dstDevId: srcDev?.id,
        dstDevName: srcName,
        ingressPort: 'FastEthernet0',
        egressPort: 'FastEthernet0',
        protocol: 'ARP',
        length: 60,
        srcIp: dstIp,
        dstIp: srcIp,
        info: `${dstIp} is at ${dstMac}`,
        summary: `ARP Reply from ${dstName}`,
        l2: {
          type: 'Ethernet II',
          srcMac: dstMac,
          dstMac: srcMac,
          etherType: '0x0806',
          fcs: '0x7e2a9b1c'
        },
        l3: {
          arp: {
            hwType: 1,
            protoType: '0x0800',
            hwSize: 6,
            protoSize: 4,
            opcode: 2, // Reply
            senderMac: dstMac,
            senderIp: dstIp,
            targetMac: srcMac,
            targetIp: srcIp
          }
        }
      });
    }
  }

  recordIcmpExchange(srcDev, dstDev, srcIp, dstIp, success, hops = []) {
    const srcMac = this._getDevMac(srcDev);
    const dstMac = this._getDevMac(dstDev);
    const srcName = srcDev ? (srcDev.hostname || srcDev.id) : 'Host';
    const dstName = dstDev ? (dstDev.hostname || dstDev.id) : 'Destination';
    const ttlReply = hops.length > 1 ? Math.max(1, 128 - hops.length + 1) : 128;

    for (let seq = 1; seq <= 4; seq++) {
      // 1. Echo Request
      this.logPacket({
        srcDevId: srcDev?.id,
        srcDevName: srcName,
        dstDevId: dstDev?.id,
        dstDevName: dstName,
        ingressPort: 'FastEthernet0',
        egressPort: 'FastEthernet0',
        protocol: 'ICMP',
        length: 74,
        srcIp: srcIp,
        dstIp: dstIp,
        info: `Echo (ping) request  id=0x0001, seq=${seq}/256, ttl=128`,
        summary: `ICMP Echo Request (seq=${seq})`,
        l2: {
          type: 'Ethernet II',
          srcMac: srcMac,
          dstMac: dstMac,
          etherType: '0x0800',
          fcs: '0x4a3b1c2d'
        },
        l3: {
          version: 4,
          ttl: 128,
          protocol: 'ICMP',
          srcIp: srcIp,
          dstIp: dstIp
        },
        l4: {
          type: 8, // Echo Request
          code: 0,
          id: 1,
          seq: seq
        }
      });

      // 2. Echo Reply or Destination Unreachable
      if (success) {
        this.logPacket({
          srcDevId: dstDev?.id,
          srcDevName: dstName,
          dstDevId: srcDev?.id,
          dstDevName: srcName,
          ingressPort: 'FastEthernet0',
          egressPort: 'FastEthernet0',
          protocol: 'ICMP',
          length: 74,
          srcIp: dstIp,
          dstIp: srcIp,
          info: `Echo (ping) reply    id=0x0001, seq=${seq}/256, ttl=${ttlReply}`,
          summary: `ICMP Echo Reply (seq=${seq})`,
          l2: {
            type: 'Ethernet II',
            srcMac: dstMac,
            dstMac: srcMac,
            etherType: '0x0800',
            fcs: '0x8b21c43d'
          },
          l3: {
            version: 4,
            ttl: ttlReply,
            protocol: 'ICMP',
            srcIp: dstIp,
            dstIp: srcIp
          },
          l4: {
            type: 0, // Echo Reply
            code: 0,
            id: 1,
            seq: seq
          }
        });
      } else {
        this.logPacket({
          srcDevId: dstDev?.id || 'gateway',
          srcDevName: dstName || 'Router',
          dstDevId: srcDev?.id,
          dstDevName: srcName,
          ingressPort: 'FastEthernet0',
          egressPort: 'FastEthernet0',
          protocol: 'ICMP',
          length: 74,
          srcIp: dstIp || '0.0.0.0',
          dstIp: srcIp,
          info: `Destination host unreachable (Request timed out)`,
          summary: `ICMP Destination Unreachable`,
          l2: {
            type: 'Ethernet II',
            srcMac: dstMac,
            dstMac: srcMac,
            etherType: '0x0800',
            fcs: '0xffffffff'
          },
          l3: {
            version: 4,
            ttl: 64,
            protocol: 'ICMP',
            srcIp: dstIp,
            dstIp: srcIp
          },
          l4: {
            type: 3, // Destination Unreachable
            code: 1,
            id: 1,
            seq: seq
          }
        });
      }
    }
  }

  recordTcpHandshake(srcDev, dstDev, srcIp, dstIp, dstPort = 80, appName = 'HTTP') {
    const srcMac = this._getDevMac(srcDev);
    const dstMac = this._getDevMac(dstDev);
    const srcName = srcDev ? (srcDev.hostname || srcDev.id) : 'Client';
    const dstName = dstDev ? (dstDev.hostname || dstDev.id) : 'Server';
    const srcPort = 49152;

    // SYN
    this.logPacket({
      srcDevId: srcDev?.id, srcDevName: srcName, dstDevId: dstDev?.id, dstDevName: dstName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'TCP', length: 66, srcIp, dstIp,
      info: `${srcPort} → ${dstPort} [SYN] Seq=0 Win=65535 Len=0 MSS=1460`,
      l2: { type: 'Ethernet II', srcMac, dstMac, etherType: '0x0800', fcs: '0x1a2b3c4d' },
      l3: { version: 4, ttl: 128, protocol: 'TCP', srcIp, dstIp },
      l4: { srcPort, dstPort, seq: 0, ack: 0, flags: { syn: 1 } }
    });

    // SYN-ACK
    this.logPacket({
      srcDevId: dstDev?.id, srcDevName: dstName, dstDevId: srcDev?.id, dstDevName: srcName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'TCP', length: 66, srcIp: dstIp, dstIp: srcIp,
      info: `${dstPort} → ${srcPort} [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=1460`,
      l2: { type: 'Ethernet II', srcMac: dstMac, dstMac: srcMac, etherType: '0x0800', fcs: '0x5e6f7a8b' },
      l3: { version: 4, ttl: 128, protocol: 'TCP', srcIp: dstIp, dstIp: srcIp },
      l4: { srcPort: dstPort, dstPort: srcPort, seq: 0, ack: 1, flags: { syn: 1, ack: 1 } }
    });

    // ACK
    this.logPacket({
      srcDevId: srcDev?.id, srcDevName: srcName, dstDevId: dstDev?.id, dstDevName: dstName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'TCP', length: 54, srcIp, dstIp,
      info: `${srcPort} → ${dstPort} [ACK] Seq=1 Ack=1 Win=65535 Len=0`,
      l2: { type: 'Ethernet II', srcMac, dstMac, etherType: '0x0800', fcs: '0x9c0d1e2f' },
      l3: { version: 4, ttl: 128, protocol: 'TCP', srcIp, dstIp },
      l4: { srcPort, dstPort, seq: 1, ack: 1, flags: { ack: 1 } }
    });
  }

  recordHttpExchange(srcDev, dstDev, srcIp, dstIp, method = 'GET', path = '/index.html', status = 200, htmlBody = '') {
    this.recordTcpHandshake(srcDev, dstDev, srcIp, dstIp, 80, 'HTTP');
    const srcMac = this._getDevMac(srcDev);
    const dstMac = this._getDevMac(dstDev);
    const srcName = srcDev ? (srcDev.hostname || srcDev.id) : 'Client';
    const dstName = dstDev ? (dstDev.hostname || dstDev.id) : 'Server';
    const srcPort = 49152;

    // HTTP Request
    const reqPayload = `${method} ${path} HTTP/1.1\r\nHost: ${dstIp}\r\nUser-Agent: PXL-NetSim/2026\r\nAccept: text/html\r\n\r\n`;
    this.logPacket({
      srcDevId: srcDev?.id, srcDevName: srcName, dstDevId: dstDev?.id, dstDevName: dstName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'HTTP', length: 54 + reqPayload.length, srcIp, dstIp,
      info: `${method} ${path} HTTP/1.1`,
      l2: { type: 'Ethernet II', srcMac, dstMac, etherType: '0x0800', fcs: '0x22334455' },
      l3: { version: 4, ttl: 128, protocol: 'TCP', srcIp, dstIp },
      l4: { srcPort, dstPort: 80, seq: 1, ack: 1, flags: { psh: 1, ack: 1 } },
      l7: { payload: reqPayload }
    });

    // HTTP Response
    const respHeader = `HTTP/1.1 ${status} OK\r\nServer: PXL-NetSim-Web/2.1\r\nContent-Type: text/html\r\nContent-Length: ${htmlBody.length || 320}\r\n\r\n`;
    const respPayload = respHeader + (htmlBody.slice(0, 300) || '<h1>PXL Web NetSim</h1>');
    this.logPacket({
      srcDevId: dstDev?.id, srcDevName: dstName, dstDevId: srcDev?.id, dstDevName: srcName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'HTTP', length: 54 + respPayload.length, srcIp: dstIp, dstIp: srcIp,
      info: `HTTP/1.1 200 OK  (text/html)`,
      l2: { type: 'Ethernet II', srcMac: dstMac, dstMac: srcMac, etherType: '0x0800', fcs: '0x66778899' },
      l3: { version: 4, ttl: 128, protocol: 'TCP', srcIp: dstIp, dstIp: srcIp },
      l4: { srcPort: 80, dstPort: srcPort, seq: 1, ack: 1 + reqPayload.length, flags: { psh: 1, ack: 1 } },
      l7: { payload: respPayload }
    });
  }

  recordDnsExchange(srcDev, dnsDev, domainName, resolvedIp) {
    const srcMac = this._getDevMac(srcDev);
    const dstMac = this._getDevMac(dnsDev);
    const srcName = srcDev ? (srcDev.hostname || srcDev.id) : 'Client';
    const dstName = dnsDev ? (dnsDev.hostname || dnsDev.id) : 'DNS-Server';
    const srcIp = srcDev?.ip || '192.168.1.10';
    const dnsIp = dnsDev?.ip || srcDev?.dns || '8.8.8.8';

    // DNS Query
    this.logPacket({
      srcDevId: srcDev?.id, srcDevName: srcName, dstDevId: dnsDev?.id, dstDevName: dstName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'DNS', length: 73, srcIp, dstIp: dnsIp,
      info: `Standard query 0x1a2b A ${domainName}`,
      l2: { type: 'Ethernet II', srcMac, dstMac, etherType: '0x0800', fcs: '0xda12bc34' },
      l3: { version: 4, ttl: 128, protocol: 'UDP', srcIp, dstIp: dnsIp },
      l4: { srcPort: 53211, dstPort: 53 }
    });

    // DNS Response
    this.logPacket({
      srcDevId: dnsDev?.id, srcDevName: dstName, dstDevId: srcDev?.id, dstDevName: srcName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'DNS', length: 89, srcIp: dnsIp, dstIp: srcIp,
      info: `Standard query response 0x1a2b A ${domainName} A ${resolvedIp}`,
      l2: { type: 'Ethernet II', srcMac: dstMac, dstMac: srcMac, etherType: '0x0800', fcs: '0xef45cd67' },
      l3: { version: 4, ttl: 128, protocol: 'UDP', srcIp: dnsIp, dstIp: srcIp },
      l4: { srcPort: 53, dstPort: 53211 }
    });
  }

  recordDhcpExchange(srcDev, serverDev, assignedIp = '192.168.1.50') {
    const srcMac = this._getDevMac(srcDev);
    const srvMac = this._getDevMac(serverDev);
    const srcName = srcDev ? (srcDev.hostname || srcDev.id) : 'Client';
    const srvName = serverDev ? (serverDev.hostname || serverDev.id) : 'DHCP-Server';
    const srvIp = serverDev?.ip || '192.168.1.1';

    // Discover
    this.logPacket({
      srcDevId: srcDev?.id, srcDevName: srcName, dstDevId: 'broadcast', dstDevName: 'Broadcast',
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'DHCP', length: 342, srcIp: '0.0.0.0', dstIp: '255.255.255.255',
      info: `DHCP Discover - Transaction ID 0x39a2c1f4`,
      l2: { type: 'Ethernet II', srcMac, dstMac: 'ff:ff:ff:ff:ff:ff', etherType: '0x0800', fcs: '0x33441122' },
      l3: { version: 4, ttl: 128, protocol: 'UDP', srcIp: '0.0.0.0', dstIp: '255.255.255.255' },
      l4: { srcPort: 68, dstPort: 67 }
    });

    // Offer
    this.logPacket({
      srcDevId: serverDev?.id, srcDevName: srvName, dstDevId: srcDev?.id, dstDevName: srcName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'DHCP', length: 342, srcIp: srvIp, dstIp: assignedIp,
      info: `DHCP Offer    - ${assignedIp} offered to ${srcMac}`,
      l2: { type: 'Ethernet II', srcMac: srvMac, dstMac, etherType: '0x0800', fcs: '0x77882233' },
      l3: { version: 4, ttl: 128, protocol: 'UDP', srcIp: srvIp, dstIp: assignedIp },
      l4: { srcPort: 67, dstPort: 68 }
    });

    // Request
    this.logPacket({
      srcDevId: srcDev?.id, srcDevName: srcName, dstDevId: 'broadcast', dstDevName: 'Broadcast',
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'DHCP', length: 342, srcIp: '0.0.0.0', dstIp: '255.255.255.255',
      info: `DHCP Request  - Requesting ${assignedIp} from ${srvIp}`,
      l2: { type: 'Ethernet II', srcMac, dstMac: 'ff:ff:ff:ff:ff:ff', etherType: '0x0800', fcs: '0x99aa3344' },
      l3: { version: 4, ttl: 128, protocol: 'UDP', srcIp: '0.0.0.0', dstIp: '255.255.255.255' },
      l4: { srcPort: 68, dstPort: 67 }
    });

    // ACK
    this.logPacket({
      srcDevId: serverDev?.id, srcDevName: srvName, dstDevId: srcDev?.id, dstDevName: srcName,
      ingressPort: 'FastEthernet0', egressPort: 'FastEthernet0',
      protocol: 'DHCP', length: 342, srcIp: srvIp, dstIp: assignedIp,
      info: `DHCP ACK      - ${assignedIp} assigned to ${srcMac}`,
      l2: { type: 'Ethernet II', srcMac: srvMac, dstMac, etherType: '0x0800', fcs: '0xbbcc4455' },
      l3: { version: 4, ttl: 128, protocol: 'UDP', srcIp: srvIp, dstIp: assignedIp },
      l4: { srcPort: 67, dstPort: 68 }
    });
  }
}

// Global simulator singleton
if (typeof window !== 'undefined') {
  window.PXLNetworkSim = new NetworkSimulator();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NetworkSimulator };
}

