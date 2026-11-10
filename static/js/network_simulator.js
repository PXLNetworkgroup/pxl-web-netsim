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

  registerDevice(device) {
    this.devices[device.id] = device;
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

      // Check direct wired link
      const peer = this.getConnectedPeer(item.devId, item.portName);
      if (peer) {
        const peerDev = this.devices[peer.deviceId];
        if (peerDev && peerDev.powerOn) {
          const peerIntf = peerDev.interfaces[peer.portName];
          if (peerIntf && !peerIntf.shutdown) {
            if (peerDev.type === 'switch') {
              // Switch bridges all other active ports in the same VLAN
              for (const [pName, pIntf] of Object.entries(peerDev.interfaces)) {
                if (pName !== 'Vlan1' && pName !== peer.portName && !pIntf.shutdown) {
                  queue.push({ devId: peerDev.id, portName: pName });
                }
              }
              // Switch SVI Vlan1 IP is also present on this domain
              if (peerDev.interfaces['Vlan1'] && peerDev.interfaces['Vlan1'].ip && !peerDev.interfaces['Vlan1'].shutdown) {
                domain.push({
                  devId: peerDev.id,
                  portName: 'Vlan1',
                  ip: peerDev.interfaces['Vlan1'].ip,
                  mask: peerDev.interfaces['Vlan1'].mask,
                  mac: peerDev.interfaces['Vlan1'].mac
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
    const srcDev = this.devices[srcDevId];
    if (!srcDev || !srcDev.powerOn || !IPUtils.isValidIp(targetIp)) {
      return { success: false, hops, reason: 'Invalid source device or target IP' };
    }

    // Ping to self
    if (srcDev.ip === targetIp) return { success: true, hops: [targetIp], reason: 'Echo reply from self' };
    for (const intf of Object.values(srcDev.interfaces)) {
      if (intf.ip === targetIp && !intf.shutdown) return { success: true, hops: [targetIp], reason: 'Echo reply from self' };
    }

    // Check if destination device exists directly in local topology
    const dstInfo = this.findDeviceByIp(targetIp);
    const inetCloud = Object.values(this.devices).find(d => d.type === 'internet_cloud' && d.powerOn);

    if (!dstInfo && !inetCloud) {
      return { success: false, hops, reason: 'Destination host unreachable (no device has this IP)' };
    }

    // Step 1: Forward path (src -> dst or src -> internet_cloud)
    const forwardPath = this.routePacket(srcDevId, targetIp);
    if (!forwardPath.success) {
      return { success: false, hops: forwardPath.hops, reason: forwardPath.reason };
    }

    // If destination was Het Internet cloud simulator, echo reply is guaranteed!
    if (forwardPath.isInternet || !dstInfo) {
      hops.push(...forwardPath.hops);
      return { success: true, hops: forwardPath.hops, reason: 'Echo reply from Het Internet' };
    }

    // Step 2: Return path (dst -> src)
    const srcIp = (srcDev.type === 'pc' || srcDev.type === 'laptop' || srcDev.type === 'server')
      ? srcDev.ip
      : (forwardPath.ingressIp || Object.values(srcDev.interfaces).find(i => i.ip && !i.shutdown)?.ip);

    if (!srcIp) return { success: false, hops: forwardPath.hops, reason: 'Source has no valid IP' };

    const returnPath = this.routePacket(dstInfo.device.id, srcIp);
    if (!returnPath.success) {
      return { success: false, hops: forwardPath.hops, reason: 'Echo request reached destination, but reply route failed' };
    }

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
    const inetCloud = Object.values(this.devices).find(d => d.type === 'internet_cloud' && d.powerOn);
    if (inetCloud) {
      const routeToInet = this.routePacket(srcDevId, inetCloud.interfaces['WAN']?.ip || '8.8.8.8');
      if (routeToInet.success) {
        return { success: true, ip: '193.190.173.1', dnsServerIp: '8.8.8.8' };
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
    return { success: true, ip: rec.ip, dnsServerIp: dnsIp };
  }

  fetchHttp(srcDevId, target) {
    let cleanTarget = target.replace(/^https?:\/\//i, '').split('/')[0].trim();
    let targetIp = cleanTarget;

    if (!IPUtils.isValidIp(cleanTarget)) {
      const dnsRes = this.resolveDns(srcDevId, cleanTarget);
      if (!dnsRes.success) {
        return { success: false, reason: dnsRes.reason };
      }
      targetIp = dnsRes.ip;
    }

    const pingResult = this.executePing(srcDevId, targetIp);
    if (!pingResult.success) {
      return { success: false, reason: `Request Timeout: could not connect to ${targetIp}:80` };
    }

    // Check if packet was received by Het Internet Cloud Simulator
    const inetCloud = Object.values(this.devices).find(d => d.type === 'internet_cloud' && d.powerOn);
    if (inetCloud && (pingResult.reason === 'Echo reply from Het Internet' || pingResult.hops.includes('Het Internet') || targetIp === '193.190.173.1' || !this.findDeviceByIp(targetIp))) {
      // If live internet NAT bridge is active, forward out to real internet!
      if (this.liveInternetEnabled) {
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
    if (!dstInfo || !dstInfo.device.services || !dstInfo.device.services.http || !dstInfo.device.services.http.enabled) {
      return { success: false, reason: `Connection Refused: HTTP web service inactive on ${targetIp}` };
    }

    return {
      success: true,
      targetIp: targetIp,
      html: dstInfo.device.services.http.content
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
      if ((dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') && dev.ip === targetIp) {
        return { device: dev, portName: 'FastEthernet0' };
      }
      for (const [pName, intf] of Object.entries(dev.interfaces)) {
        if (intf.ip === targetIp && !intf.shutdown) {
          return { device: dev, portName: pName };
        }
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

    // Het Internet Cloud Simulator terminates and answers all external requests
    if (dev.type === 'internet_cloud') {
      hops.push('Het Internet');
      return { success: true, hops, ingressIp: '193.190.173.1', isInternet: true };
    }

    // Check if any port on this device connects directly to Het Internet cloud
    for (const [portName, intf] of Object.entries(dev.interfaces)) {
      if (intf.shutdown) continue;
      const peer = this.getConnectedPeer(dev.id, portName);
      if (peer) {
        const peerDev = this.devices[peer.deviceId];
        if (peerDev && peerDev.type === 'internet_cloud' && peerDev.powerOn) {
          hops.push(intf.ip || dev.hostname);
          return this.routePacket(peerDev.id, targetIp, visited, hops);
        }
      }
    }

    // Check all active interfaces on this device for local subnet match
    for (const [portName, intf] of Object.entries(dev.interfaces)) {
      const myIp = (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') ? dev.ip : intf.ip;
      const myMask = (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') ? dev.mask : intf.mask;

      if (!myIp || !myMask || intf.shutdown) continue;

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
    } else if (dev.type === 'switch') {
      nextHopIp = dev.defaultGateway;
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
}

// Global simulator singleton
if (typeof window !== 'undefined') {
  window.PXLNetworkSim = new NetworkSimulator();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NetworkSimulator };
}

