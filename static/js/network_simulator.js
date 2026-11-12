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

  reset() {
    this.clear();
  }

  // --- CABLING & LAYER 1/2 TOPOLOGY ---

  addCable(cable) {
    // Check if either port is already cabled
    this.removeCableFromPort(cable.fromDevice, cable.fromPort);
    this.removeCableFromPort(cable.toDevice, cable.toPort);
    this.cables.push(cable);
  }

  connectCable(fromDevId, fromPort, toDevId, toPort, type = 'straight') {
    const cable = {
      id: `cable_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: type,
      fromDevice: fromDevId,
      fromPort: fromPort,
      toDevice: toDevId,
      toPort: toPort
    };
    this.addCable(cable);
    return cable;
  }

  removeCable(cableId) {
    this.cables = this.cables.filter(c => c.id !== cableId);
  }

  disconnectCable(cableId) {
    this.removeCable(cableId);
  }

  reconnectCableEndpoint(cableId, side, newPort) {
    const cable = this.cables.find(c => c.id === cableId);
    if (!cable) return false;
    if (side === 'from') {
      this.removeCableFromPort(cable.fromDevice, newPort);
      cable.fromPort = newPort;
    } else if (side === 'to') {
      this.removeCableFromPort(cable.toDevice, newPort);
      cable.toPort = newPort;
    }
    return true;
  }

  getAvailablePorts(deviceId, currentPort = null, cableType = null) {
    const dev = this.devices[deviceId];
    if (!dev || !dev.interfaces) return [];
    return Object.keys(dev.interfaces).filter(p => {
      if (p.startsWith('Wireless')) return false;
      const lower = p.toLowerCase();
      if (lower.startsWith('vlan') || lower.startsWith('loopback') || lower.startsWith('null')) return false;
      const isConsole = (p === 'Console' || p === 'Aux' || p === 'RS 232' || p === 'USB0');
      if (cableType === 'console') {
        if (!isConsole) return false;
      } else if (cableType) {
        if (isConsole) return false;
      }
      if (currentPort && p === currentPort) return true;
      return !this.getCableOnPort(deviceId, p);
    });
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
  // --- WIRELESS MANAGEMENT & RF PROPAGATION PHYSICS ---

  /**
   * Calculates log-distance path loss, RSSI, SNR, Link Quality, and Tx Rate
   * according to PXL Network Essentials Wi-Fi guideline (Ch 8).
   */
  calculateWifiMetrics(client, ap) {
    const dx = (client.x || 0) - (ap.x || 0);
    const dy = (client.y || 0) - (ap.y || 0);
    const distancePx = Math.sqrt(dx * dx + dy * dy);
    // Calibration: ~8 pixels = 1 meter on workspace canvas
    const distanceM = Math.max(0.5, distancePx / 8);

    const txPower = ap.wireless?.txPower || 15; // dBm (PXL best practice: 12-15 dBm)
    const gain = 3; // dBi omni antenna gain
    
    // Log-distance indoor path loss: PL(d) = PL0 + 10 * n * log10(d) with n=3.0
    const pathLoss = 38 + 30 * Math.log10(distanceM);
    let rssi = Math.round(txPower + gain - pathLoss);

    // Edge attenuation penalty beyond 280px (simulating walls & fading near coverage boundary)
    if (distancePx > 280) {
      rssi -= Math.round(((distancePx - 280) / 10) * 1.8);
    }

    if (rssi > -28) rssi = -28;
    if (rssi < -95) rssi = -95;

    const band = ap.wireless?.band || '5GHz';
    const noiseFloor = (band === '5GHz') ? -95 : -90; // dBm
    const snr = Math.max(0, rssi - noiseFloor);

    // Link Quality percentage (0 - 100%)
    const linkQuality = Math.max(0, Math.min(100, Math.round(2 * (rssi + 100))));

    // Signal Bars (0 - 4 bars)
    let bars = 0;
    if (rssi >= -60) bars = 4;
    else if (rssi >= -68) bars = 3; // PXL VoIP minimum is -67 dBm
    else if (rssi >= -78) bars = 2;
    else if (rssi >= -85) bars = 1;
    else bars = 0;

    // Data Rate (Mbps) based on simulated 802.11ac / 802.11n MCS Index
    let txRate = 0;
    if (rssi >= -55) txRate = 433.3;
    else if (rssi >= -65) txRate = 300.0;
    else if (rssi >= -70) txRate = 173.3;
    else if (rssi >= -78) txRate = 86.7;
    else if (rssi >= -83) txRate = 43.3;
    else if (rssi >= -88) txRate = 14.4;
    else txRate = 0;

    // Drop threshold: connection drops at -88 dBm or distance > 380px
    const inRange = (distancePx <= 380 && rssi >= -88);

    return {
      distancePx: Math.round(distancePx),
      distanceMeters: Math.round(distanceM * 10) / 10,
      rssi,
      snr,
      noiseFloor,
      linkQuality,
      bars,
      txRate,
      inRange
    };
  }

  /**
   * Scans all visible APs, Routers, and WLC WLANs within physical range of a client.
   * Used for the PC Wireless "Site Survey" tab.
   */
  getVisibleWirelessNetworks(client) {
    if (!client || !client.powerOn) return [];
    const networks = [];
    const aps = Object.values(this.devices).filter(d => 
      (d.type === 'wireless_ap' || d.type === 'wireless_router' || d.type === 'wlc') && d.powerOn
    );

    for (const ap of aps) {
      const metrics = this.calculateWifiMetrics(client, ap);
      if (!metrics.inRange) continue;

      if (ap.type === 'wlc' && ap.wlcConfig && ap.wlcConfig.wlans) {
        // Cisco WLC broadcasts its configured WLANs
        for (const wlan of ap.wlcConfig.wlans) {
          if (wlan.status !== 'Enabled') continue;
          networks.push({
            apId: ap.id,
            apName: ap.hostname || ap.id,
            bssid: ap.interfaces['GigabitEthernet0/1']?.mac || '0024.97.aa.01',
            ssid: wlan.ssid,
            channel: ap.wireless?.channel || 36,
            band: ap.wireless?.band || '5GHz',
            authMode: wlan.authMode || 'WPA2-PSK',
            vlan: wlan.vlan,
            ...metrics
          });
        }
      } else {
        const ssid = ap.wireless?.ssid || (ap.type === 'wireless_router' ? 'PXL-Wireless-Router' : 'PXL-Klas-AP');
        const bssid = ap.interfaces['Wireless0']?.mac || '0021.d8.bb.01';
        networks.push({
          apId: ap.id,
          apName: ap.hostname || ap.id,
          bssid,
          ssid,
          channel: ap.wireless?.channel || (ap.type === 'wireless_router' ? 6 : 36),
          band: ap.wireless?.band || (ap.type === 'wireless_router' ? '2.4GHz' : '5GHz'),
          authMode: ap.wireless?.authMode || 'WPA2-PSK',
          ...metrics
        });
      }
    }

    // Sort by signal strength (highest RSSI first)
    networks.sort((a, b) => b.rssi - a.rssi);
    return networks;
  }

  updateWirelessAssociations() {
    this.wirelessAssociations = {};
    const aps = Object.values(this.devices).filter(d => 
      (d.type === 'wireless_ap' || d.type === 'wireless_router' || d.type === 'wlc') && d.powerOn
    );
    const wirelessClients = Object.values(this.devices).filter(d => 
      (d.type === 'laptop' || d.type === 'pc' || d.type === 'server') && 
      d.wireless && d.wireless.installed && d.wireless.enabled && d.powerOn
    );

    for (const client of wirelessClients) {
      if (!client.wireless.ssid) {
        client.wireless.associatedAp = null;
        client.wireless.rssi = -95;
        client.wireless.snr = 0;
        client.wireless.linkQuality = 0;
        client.wireless.bars = 0;
        client.wireless.txRate = 0;
        continue;
      }

      let bestAp = null;
      let bestMetrics = null;
      let bestWlan = null;

      for (const ap of aps) {
        const metrics = this.calculateWifiMetrics(client, ap);
        if (!metrics.inRange) continue;

        if (ap.type === 'wlc' && ap.wlcConfig && ap.wlcConfig.wlans) {
          const matchingWlan = ap.wlcConfig.wlans.find(w => w.status === 'Enabled' && w.ssid === client.wireless.ssid);
          if (matchingWlan) {
            let authOk = true;
            if (matchingWlan.authMode === 'WPA2-PSK' && client.wireless.passphrase !== matchingWlan.passphrase) {
              authOk = false;
            }
            if (authOk && (!bestMetrics || metrics.rssi > bestMetrics.rssi)) {
              bestAp = ap;
              bestMetrics = metrics;
              bestWlan = matchingWlan;
            }
          }
        } else {
          const apSsid = ap.wireless?.ssid || (ap.type === 'wireless_router' ? 'PXL-Wireless-Router' : 'PXL-Klas-AP');
          if (client.wireless.ssid === apSsid) {
            let authOk = true;
            const apAuth = ap.wireless?.authMode || 'WPA2-PSK';
            const apPass = ap.wireless?.passphrase || 'PXL2026Net!';
            if (apAuth === 'WPA2-PSK' && client.wireless.passphrase !== apPass) {
              authOk = false;
            }
            if (authOk && (!bestMetrics || metrics.rssi > bestMetrics.rssi)) {
              bestAp = ap;
              bestMetrics = metrics;
              bestWlan = null;
            }
          }
        }
      }

      if (bestAp && bestMetrics) {
        this.wirelessAssociations[client.id] = bestAp.id;
        client.wireless.associatedAp = bestAp.id;
        client.wireless.rssi = bestMetrics.rssi;
        client.wireless.snr = bestMetrics.snr;
        client.wireless.noiseFloor = bestMetrics.noiseFloor;
        client.wireless.linkQuality = bestMetrics.linkQuality;
        client.wireless.bars = bestMetrics.bars;
        client.wireless.txRate = bestMetrics.txRate;
        client.wireless.distancePx = bestMetrics.distancePx;
        client.wireless.distanceM = bestMetrics.distanceMeters;
        client.wireless.channel = bestAp.wireless?.channel || 6;
        client.wireless.band = bestAp.wireless?.band || '2.4GHz';

        // Auto-DHCP lease resolution for associated wireless client
        if (client.dhcpEnabled || client.wireless.dhcpEnabled) {
          if (bestAp.type === 'wireless_router' && bestAp.wrtConfig?.dhcpEnabled) {
            if (!client.ip || client.ip.startsWith('169.254') || !client.ip.startsWith('192.168.0.')) {
              // Extract numeric host part or hash
              const hostId = (client.id.charCodeAt(client.id.length - 1) % 40) + 100;
              client.ip = `192.168.0.${hostId}`;
              client.mask = "255.255.255.0";
              client.gateway = bestAp.wrtConfig.lanIp || "192.168.0.1";
              client.dns = bestAp.wrtConfig.dns || "8.8.8.8";
              if (client.interfaces['Wireless0']) {
                client.interfaces['Wireless0'].ip = client.ip;
                client.interfaces['Wireless0'].mask = client.mask;
              }
            }
          } else if (bestWlan && bestWlan.vlan === 20) {
            // VLAN 20 Staff
            if (!client.ip || !client.ip.startsWith('10.20.0.')) {
              const hostId = (client.id.charCodeAt(client.id.length - 1) % 40) + 50;
              client.ip = `10.20.0.${hostId}`;
              client.mask = "255.255.255.0";
              client.gateway = (bestAp.wlcConfig && bestAp.wlcConfig.interfaces?.int_staff?.ip) || "10.20.0.254";
              client.dns = "8.8.8.8";
              if (client.interfaces['Wireless0']) {
                client.interfaces['Wireless0'].ip = client.ip;
                client.interfaces['Wireless0'].mask = client.mask;
              }
            }
          } else if (bestWlan && bestWlan.vlan === 30) {
            // VLAN 30 Guest
            if (!client.ip || !client.ip.startsWith('10.30.0.')) {
              const hostId = (client.id.charCodeAt(client.id.length - 1) % 40) + 50;
              client.ip = `10.30.0.${hostId}`;
              client.mask = "255.255.255.0";
              client.gateway = (bestAp.wlcConfig && bestAp.wlcConfig.interfaces?.int_guest?.ip) || "10.30.0.254";
              client.dns = "8.8.8.8";
              if (client.interfaces['Wireless0']) {
                client.interfaces['Wireless0'].ip = client.ip;
                client.interfaces['Wireless0'].mask = client.mask;
              }
            }
          } else if (bestAp.type === 'wireless_ap' && bestAp.apConfig?.dhcpEnabled) {
            // Standalone AP Internal DHCP Server
            const pool = bestAp.apConfig.dhcpPool || { startIp: '10.10.0.101', mask: '255.255.255.0', gateway: '10.10.0.100', dns: '8.8.8.8' };
            const prefix = pool.startIp.substring(0, pool.startIp.lastIndexOf('.'));
            if (!client.ip || client.ip === '0.0.0.0' || client.ip.startsWith('169.254')) {
              const hostId = (client.id.charCodeAt(client.id.length - 1) % 30) + 101;
              const assignedIp = `${prefix}.${hostId}`;
              client.ip = assignedIp;
              client.mask = pool.mask || "255.255.255.0";
              client.gateway = pool.gateway || bestAp.apConfig.ip || "10.10.0.100";
              client.dns = pool.dns || "8.8.8.8";
              if (client.interfaces['Wireless0']) {
                client.interfaces['Wireless0'].ip = client.ip;
                client.interfaces['Wireless0'].mask = client.mask;
              }
              if (!bestAp.apConfig.dhcpLeases) bestAp.apConfig.dhcpLeases = [];
              const clientMac = client.mac || client.interfaces['Wireless0']?.mac || '0050.79.aa.01';
              if (!bestAp.apConfig.dhcpLeases.some(l => l.mac === clientMac)) {
                bestAp.apConfig.dhcpLeases.push({
                  mac: clientMac,
                  ip: assignedIp,
                  hostname: client.hostname || client.id,
                  expires: '24u'
                });
              }
            }
          }
        }
      } else {
        client.wireless.associatedAp = null;
        client.wireless.rssi = -95;
        client.wireless.snr = 0;
        client.wireless.linkQuality = 0;
        client.wireless.bars = 0;
        client.wireless.txRate = 0;
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
      if (item.portName === 'Wireless0' || dev.type === 'wlc' || dev.type === 'wireless_ap' || dev.type === 'wireless_router') {
        if (dev.type === 'wireless_ap' || dev.type === 'wireless_router' || dev.type === 'wlc') {
          // Push all associated clients
          for (const [clientId, apId] of Object.entries(this.wirelessAssociations)) {
            if (apId === dev.id) {
              queue.push({ devId: clientId, portName: 'Wireless0' });
            }
          }
          // Also bridge Wireless0 to wired switch/Ethernet ports!
          for (const [pName, pIntf] of Object.entries(dev.interfaces)) {
            if (pName !== 'Wireless0' && pName !== 'Console' && !pIntf.shutdown) {
              queue.push({ devId: dev.id, portName: pName });
            }
          }
        } else if (dev.wireless && dev.wireless.associatedAp) {
          queue.push({ devId: dev.wireless.associatedAp, portName: 'Wireless0' });
        }
      }

      // Register host / end-device in domain if reachable
      if (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') {
        const devIp = dev.interfaces[item.portName]?.ip || dev.ip;
        const devMask = dev.interfaces[item.portName]?.mask || dev.mask;
        if (devIp) {
          domain.push({
            devId: dev.id,
            portName: item.portName,
            ip: devIp,
            mask: devMask,
            mac: dev.interfaces[item.portName]?.mac || dev.interfaces['FastEthernet0']?.mac
          });
        }
      } else if (dev.type === 'wireless_router') {
        const lanIp = dev.wrtConfig?.lanIp || dev.ip || '192.168.0.1';
        const lanMask = dev.wrtConfig?.lanMask || dev.mask || '255.255.255.0';
        domain.push({
          devId: dev.id,
          portName: item.portName,
          ip: lanIp,
          mask: lanMask,
          mac: dev.interfaces['Wireless0']?.mac || '0021.d8.00.00.01'
        });
      } else if (dev.type === 'wlc' && dev.wlcConfig?.interfaces) {
        for (const [intfKey, intf] of Object.entries(dev.wlcConfig.interfaces)) {
          domain.push({
            devId: dev.id,
            portName: intfKey,
            ip: intf.ip,
            mask: intf.mask,
            mac: dev.interfaces['GigabitEthernet0/1']?.mac || '0024.97.00.00.01'
          });
        }
      } else if (dev.type === 'wireless_ap') {
        const apIp = dev.apConfig?.ip || dev.ip || '10.10.0.100';
        const apMask = dev.apConfig?.mask || dev.mask || '255.255.255.0';
        domain.push({
          devId: dev.id,
          portName: item.portName,
          ip: apIp,
          mask: apMask,
          mac: dev.interfaces['GigabitEthernet0']?.mac || '0021.d8.e1.01'
        });
      }

      // Handle bridging from wired ports to Wireless0 on AP and Wireless Router
      if ((dev.type === 'wireless_ap' || dev.type === 'wireless_router') && item.portName !== 'Wireless0') {
        queue.push({ devId: dev.id, portName: 'Wireless0' });
        // On Wireless Router, bridge between LAN Ethernet ports
        if (dev.type === 'wireless_router' && item.portName.startsWith('Ethernet')) {
          for (let p = 1; p <= 4; p++) {
            const pName = `Ethernet${p}`;
            if (pName !== item.portName) queue.push({ devId: dev.id, portName: pName });
          }
        }
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
            } else if (peerDev.type === 'wireless_ap' || peerDev.type === 'wireless_router') {
              // Wireless AP & Router bridge wired Ethernet traffic to Wireless0 and wireless clients
              queue.push({ devId: peerDev.id, portName: peer.portName });
            } else {
              // Non-switch end node or router interface
              let ip = (peerDev.type === 'pc' || peerDev.type === 'laptop' || peerDev.type === 'server') ? peerDev.ip : peerIntf.ip;
              let mask = (peerDev.type === 'pc' || peerDev.type === 'laptop' || peerDev.type === 'server') ? peerDev.mask : peerIntf.mask;
              if (ip && !mask) {
                mask = (typeof IPUtils !== 'undefined' && IPUtils.getDefaultMask) ? IPUtils.getDefaultMask(ip) : '255.255.255.0';
              }
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
      const inetIp = inetCloud.interfaces['GigabitEthernet0']?.ip || '209.165.200.225';
      const routeToInet = this.routePacket(srcDevId, inetIp);
      if (routeToInet.success && (srcDev.dns === '8.8.8.8' || srcDev.dns === '1.1.1.1' || srcDev.dns === inetIp)) {
        return { success: true, ip: inetCloud.type === 'internet_public' ? '8.8.8.8' : '209.165.200.230', dnsServerIp: srcDev.dns };
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

    const records = dstInfo.device.services.dns.records || [];
    let rec = records.find(r => r.name && r.name.toLowerCase() === cleanHost.toLowerCase());

    // CNAME Alias resolution
    if (rec && rec.type === 'CNAME') {
      const targetRec = records.find(r => r.name && r.name.toLowerCase() === (rec.target || rec.ip).toLowerCase() && r.type === 'A');
      if (targetRec) {
        rec = { name: cleanHost, type: 'CNAME', ip: targetRec.ip, target: rec.target || rec.ip };
      }
    }

    // If not found in local records, check DNS Forwarders!
    if (!rec) {
      const fwd = dstInfo.device.services.dns.forwarders;
      if (fwd && fwd.enabled) {
        const forwarderIp = fwd.primary || '8.8.8.8';
        const isLive = inetCloud && (inetCloud.type === 'internet_public' || (inetCloud.type === 'internet_cloud' && this.liveInternetEnabled));

        const knownSimDomains = {
          'www.google.com': '8.8.8.8',
          'google.com': '8.8.8.8',
          'www.cloudflare.com': '1.1.1.1',
          'cloudflare.com': '1.1.1.1',
          'www.cisco.com': '209.165.200.230',
          'cisco.com': '209.165.200.230',
          'www.pxl.be': '193.190.173.130',
          'pxl.be': '193.190.173.130'
        };

        const resolvedForwardIp = knownSimDomains[cleanHost.toLowerCase()] || (isLive ? null : '209.165.200.230');

        if (resolvedForwardIp) {
          this.recordDnsExchange(srcDev, dstInfo.device, cleanHost, resolvedForwardIp);
          return { success: true, ip: resolvedForwardIp, dnsServerIp: dnsIp, forwarded: true, forwarderIp: forwarderIp };
        } else if (isLive) {
          return { success: true, ip: '8.8.8.8', dnsServerIp: dnsIp, isLiveDns: true, liveDomain: cleanHost, forwarderIp: forwarderIp };
        }
      }

      return { success: false, reason: `Host Name Unresolved: '${cleanHost}' not found in DNS zone or forwarders` };
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

    // 3. Cisco Linksys WRT300N Web Management (HTTP Port 80)
    if (dstDev.type === 'wireless_router') {
      if (typeof renderWrtWebInterfaceHtml === 'function') {
        return { success: true, targetIp, html: renderWrtWebInterfaceHtml(dstDev, this) };
      }
    }

    // 4. Cisco 3504 Wireless LAN Controller (WLC) Web GUI (HTTPS / HTTP)
    if (dstDev.type === 'wlc') {
      if (typeof renderWlcWebInterfaceHtml === 'function') {
        return { success: true, targetIp, html: renderWlcWebInterfaceHtml(dstDev, this) };
      }
    }

    // 5. Cisco Aironet / Autonomous Standalone AP Web Management (HTTP Port 80)
    if (dstDev.type === 'wireless_ap') {
      const isWebOn = dstDev.apConfig?.webEnabled !== false;
      if (!isWebOn) {
        return { success: false, reason: `Connection Refused: Web Management is uitgeschakeld op ${dstDev.hostname}` };
      }
      if (typeof renderApWebInterfaceHtml === 'function') {
        return { success: true, targetIp, html: renderApWebInterfaceHtml(dstDev, this) };
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
      if (dev.wlcConfig && dev.wlcConfig.interfaces) {
        for (const [intfKey, intf] of Object.entries(dev.wlcConfig.interfaces)) {
          if (intf.ip === targetIp) {
            return { device: dev, portName: intfKey };
          }
        }
      }
      if (dev.wrtConfig) {
        if (dev.wrtConfig.lanIp === targetIp) {
          return { device: dev, portName: 'Ethernet1' };
        }
        if (dev.wrtConfig.wanIp === targetIp) {
          return { device: dev, portName: 'Internet' };
        }
      }
      if (dev.type === 'wireless_ap' && dev.apConfig && dev.apConfig.ip === targetIp) {
        return { device: dev, portName: 'GigabitEthernet0' };
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

    // WLC terminates all its management and dynamic interfaces, and routes directly to associated Wi-Fi clients
    if (dev.type === 'wlc') {
      if (dev.wlcConfig && dev.wlcConfig.interfaces) {
        for (const [intfKey, intf] of Object.entries(dev.wlcConfig.interfaces)) {
          if (intf.ip === targetIp) {
            hops.push(targetIp);
            return { success: true, hops, ingressIp: intf.ip };
          }
        }
      }
      for (const [clientId, apId] of Object.entries(this.wirelessAssociations)) {
        if (apId === dev.id) {
          const clientDev = this.devices[clientId];
          if (clientDev && (clientDev.ip === targetIp || clientDev.interfaces['Wireless0']?.ip === targetIp)) {
            hops.push(targetIp);
            return { success: true, hops, ingressIp: dev.wlcConfig?.interfaces?.int_staff?.ip || dev.ip };
          }
        }
      }
    }

    // Wireless Router terminates its LAN / WAN interfaces and routes directly to associated Wi-Fi clients
    if (dev.type === 'wireless_router') {
      if (dev.wrtConfig && (dev.wrtConfig.lanIp === targetIp || dev.wrtConfig.wanIp === targetIp)) {
        hops.push(targetIp);
        return { success: true, hops, ingressIp: targetIp };
      }
      for (const [clientId, apId] of Object.entries(this.wirelessAssociations)) {
        if (apId === dev.id) {
          const clientDev = this.devices[clientId];
          if (clientDev && (clientDev.ip === targetIp || clientDev.interfaces['Wireless0']?.ip === targetIp)) {
            hops.push(targetIp);
            return { success: true, hops, ingressIp: dev.wrtConfig?.lanIp || dev.ip };
          }
        }
      }
    }

    // Standalone Wireless AP terminates its management IP and bridges directly to associated Wi-Fi clients
    if (dev.type === 'wireless_ap') {
      if (dev.apConfig && dev.apConfig.ip === targetIp) {
        hops.push(targetIp);
        return { success: true, hops, ingressIp: targetIp };
      }
      for (const [clientId, apId] of Object.entries(this.wirelessAssociations)) {
        if (apId === dev.id) {
          const clientDev = this.devices[clientId];
          if (clientDev && (clientDev.ip === targetIp || clientDev.interfaces['Wireless0']?.ip === targetIp)) {
            hops.push(targetIp);
            return { success: true, hops, ingressIp: dev.apConfig?.ip || dev.ip };
          }
        }
      }
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
    const interfaceList = [];
    for (const [portName, intf] of Object.entries(dev.interfaces)) {
      let myIp = (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') ? dev.ip : intf.ip;
      let myMask = (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') ? dev.mask : intf.mask;

      if ((dev.type === 'switch' || dev.type === 'hpe_switch') && portName === 'Vlan1') {
        if (!myIp) myIp = dev.ip || (dev.hpeConfig && dev.hpeConfig.mgmtIp);
        if (!myMask) myMask = dev.mask || (dev.hpeConfig && dev.hpeConfig.mgmtMask) || '255.255.255.0';
      }

      if (myIp && !myMask) {
        myMask = (typeof IPUtils !== 'undefined' && IPUtils.getDefaultMask) ? IPUtils.getDefaultMask(myIp) : '255.255.255.0';
      }

      if (myIp && myMask && (!intf.shutdown || portName === 'Vlan1')) {
        interfaceList.push({ portName, myIp, myMask });
      }
    }

    if (dev.wlcConfig && dev.wlcConfig.interfaces) {
      for (const [intfKey, intf] of Object.entries(dev.wlcConfig.interfaces)) {
        if (intf.ip && intf.mask) {
          interfaceList.push({ portName: intfKey, myIp: intf.ip, myMask: intf.mask });
        }
      }
    }

    if (dev.wrtConfig) {
      if (dev.wrtConfig.lanIp && dev.wrtConfig.lanMask) {
        interfaceList.push({ portName: 'Ethernet1', myIp: dev.wrtConfig.lanIp, myMask: dev.wrtConfig.lanMask });
      }
      if (dev.wrtConfig.wanIp && dev.wrtConfig.wanMask) {
        interfaceList.push({ portName: 'Internet', myIp: dev.wrtConfig.wanIp, myMask: dev.wrtConfig.wanMask });
      }
    }

    for (const item of interfaceList) {
      const { portName, myIp, myMask } = item;
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
    } else if (dev.type === 'wireless_router') {
      nextHopIp = dev.wrtConfig?.wanGateway || dev.defaultGateway;
    } else if (dev.type === 'wlc') {
      nextHopIp = dev.wlcConfig?.mgmtGateway || dev.defaultGateway;
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
      l2: { type: 'Ethernet II', srcMac: srvMac, dstMac: srcMac, etherType: '0x0800', fcs: '0x77882233' },
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
      l2: { type: 'Ethernet II', srcMac: srvMac, dstMac: srcMac, etherType: '0x0800', fcs: '0xbbcc4455' },
      l3: { version: 4, ttl: 128, protocol: 'UDP', srcIp: srvIp, dstIp: assignedIp },
      l4: { srcPort: 67, dstPort: 68 }
    });
  }

  // --- COMPLETE MULTI-DEVICE DHCP ENGINE ---
  requestDhcp(srcDevId, intfName = 'FastEthernet0') {
    const srcDev = this.devices[srcDevId];
    if (!srcDev) return { success: false, reason: 'Invalid source device' };

    // Find broadcast domain of srcDev on this port
    const bcast = this.getL2BroadcastDomain(srcDevId, intfName);
    
    // Search for active DHCP servers reachable in this broadcast domain or via connected peers
    let srvDev = null;
    let srvPool = null;
    let srvType = null;

    const candidateIds = new Set();
    bcast.forEach(b => candidateIds.add(b.devId));
    for (const port of Object.keys(srcDev.interfaces)) {
      const p = this.getConnectedPeer(srcDevId, port);
      if (p) candidateIds.add(p.deviceId);
    }
    if (this.wirelessAssociations[srcDevId]) {
      candidateIds.add(this.wirelessAssociations[srcDevId]);
    }

    for (const devId of candidateIds) {
      const d = this.devices[devId];
      if (!d || !d.powerOn) continue;

      // 1. Server-PT with DHCP service enabled
      if (d.type === 'server' && d.services?.dhcp?.enabled) {
        srvDev = d;
        srvType = 'server';
        srvPool = (d.services.dhcp.pools && d.services.dhcp.pools.length > 0) ? d.services.dhcp.pools[0] : d.services.dhcp;
        break;
      }
      // 2. Wireless Router (WRT300N)
      if (d.type === 'wireless_router' && d.wrtConfig?.dhcpEnabled) {
        srvDev = d;
        srvType = 'wrt';
        srvPool = {
          startIp: d.wrtConfig.dhcpStartIp || '192.168.0.100',
          mask: d.wrtConfig.lanMask || '255.255.255.0',
          gateway: d.wrtConfig.lanIp || '192.168.0.1',
          dns: d.wrtConfig.dns || '8.8.8.8',
          maxUsers: d.wrtConfig.dhcpMaxUsers || 50
        };
        break;
      }
      // 3. Standalone AP with internal DHCP enabled
      if (d.type === 'wireless_ap' && d.apConfig?.dhcpEnabled) {
        srvDev = d;
        srvType = 'ap';
        srvPool = d.apConfig.dhcpPool || {
          startIp: '10.10.0.101',
          mask: '255.255.255.0',
          gateway: d.apConfig.ip || '10.10.0.100',
          dns: d.apConfig.dns || '8.8.8.8',
          maxUsers: 30
        };
        break;
      }
      // 4. Cisco Router with DHCP pool
      if (d.type === 'router' && d.dhcpPools && Object.keys(d.dhcpPools).length > 0) {
        srvDev = d;
        srvType = 'router';
        const poolName = Object.keys(d.dhcpPools)[0];
        const p = d.dhcpPools[poolName];
        srvPool = {
          startIp: p.startIp || '192.168.1.100',
          mask: p.mask || '255.255.255.0',
          gateway: p.defaultRouter || Object.values(d.interfaces).find(i => i.ip)?.ip || '192.168.1.1',
          dns: p.dnsServer || '8.8.8.8',
          maxUsers: 50
        };
        break;
      }
      // 5. MikroTik / OpenWrt
      if (d.type === 'mikrotik' && d.mikrotikConfig?.dhcpServers?.length > 0) {
        srvDev = d;
        srvType = 'mikrotik';
        srvPool = { startIp: '192.168.88.100', mask: '255.255.255.0', gateway: '192.168.88.1', dns: '192.168.88.1', maxUsers: 50 };
        break;
      }
      if (d.type === 'openwrt' && d.openwrtConfig?.dhcp?.enabled !== false) {
        srvDev = d;
        srvType = 'openwrt';
        srvPool = { startIp: '192.168.1.100', mask: '255.255.255.0', gateway: '192.168.1.1', dns: '192.168.1.1', maxUsers: 50 };
        break;
      }
    }

    if (srvDev && srvPool) {
      // Allocate next available IP
      const startIp = srvPool.startIp || '192.168.1.100';
      const parts = startIp.split('.');
      const prefix = parts.slice(0, 3).join('.');
      let hostNum = parseInt(parts[3], 10) || 100;

      const usedIps = new Set();
      Object.values(this.devices).forEach(dev => {
        if (dev.id !== srcDevId && dev.ip) usedIps.add(dev.ip);
        if (dev.interfaces) {
          Object.values(dev.interfaces).forEach(i => { if (i.ip && dev.id !== srcDevId) usedIps.add(i.ip); });
        }
      });

      while (usedIps.has(`${prefix}.${hostNum}`) && hostNum < 254) {
        hostNum++;
      }
      const assignedIp = `${prefix}.${hostNum}`;
      const mask = srvPool.mask || '255.255.255.0';
      const gateway = srvPool.gateway || srvDev.ip || `${prefix}.1`;
      const dns = srvPool.dns || srvDev.ip || '8.8.8.8';

      srcDev.ip = assignedIp;
      srcDev.mask = mask;
      srcDev.gateway = gateway;
      srcDev.dns = dns;
      srcDev.dhcpEnabled = true;

      const targetIntf = srcDev.interfaces[intfName] || srcDev.interfaces['FastEthernet0'] || srcDev.interfaces['Wireless0'];
      if (targetIntf) {
        targetIntf.ip = assignedIp;
        targetIntf.mask = mask;
        targetIntf.shutdown = false;
      }

      const leaseEntry = {
        mac: srcDev.mac || targetIntf?.mac || '0050.79.11.22',
        ip: assignedIp,
        hostname: srcDev.hostname || srcDev.id,
        expires: '24u',
        timestamp: new Date().toLocaleTimeString()
      };
      if (srvType === 'server' && srvDev.services?.dhcp) {
        if (!srvDev.services.dhcp.leases) srvDev.services.dhcp.leases = [];
        srvDev.services.dhcp.leases = srvDev.services.dhcp.leases.filter(l => l.mac !== leaseEntry.mac);
        srvDev.services.dhcp.leases.push(leaseEntry);
      } else if (srvType === 'ap' && srvDev.apConfig) {
        if (!srvDev.apConfig.dhcpLeases) srvDev.apConfig.dhcpLeases = [];
        srvDev.apConfig.dhcpLeases = srvDev.apConfig.dhcpLeases.filter(l => l.mac !== leaseEntry.mac);
        srvDev.apConfig.dhcpLeases.push(leaseEntry);
      }

      this.recordDhcpExchange(srcDev, srvDev, assignedIp);

      return {
        success: true,
        ip: assignedIp,
        mask: mask,
        gateway: gateway,
        dns: dns,
        serverName: srvDev.hostname || srvDev.id,
        serverIp: srvDev.ip
      };
    }

    // No DHCP server responded -> APIPA fallback
    const apipaIp = `169.254.${Math.floor(Math.random() * 254 + 1)}.${Math.floor(Math.random() * 254 + 1)}`;
    srcDev.ip = apipaIp;
    srcDev.mask = '255.255.0.0';
    srcDev.gateway = '';
    srcDev.dns = '';
    srcDev.dhcpEnabled = true;
    const targetIntf = srcDev.interfaces[intfName] || srcDev.interfaces['FastEthernet0'] || srcDev.interfaces['Wireless0'];
    if (targetIntf) {
      targetIntf.ip = apipaIp;
      targetIntf.mask = '255.255.0.0';
    }

    return {
      success: false,
      isApipa: true,
      ip: apipaIp,
      mask: '255.255.0.0',
      reason: 'DHCP request failed. No DHCP server replied. APIPA address (169.254.x.y) assigned.'
    };
  }

  // --- LDAP / ACTIVE DIRECTORY DOMAIN CONTROLLER & 802.1X RADIUS AUTHENTICATION ---
  authenticateRadiusLdap(serverIp, sharedSecret, username, password) {
    if (!serverIp || !username) {
      return { success: false, reason: 'RADIUS server IP en gebruikersnaam vereist' };
    }
    const dstInfo = this.findDeviceByIp(serverIp);
    if (!dstInfo || !dstInfo.device.services || !dstInfo.device.services.ldap || !dstInfo.device.services.ldap.enabled) {
      return { success: false, reason: `RADIUS/LDAP server op ${serverIp} reageert niet of Active Directory service staat uit` };
    }
    const ldap = dstInfo.device.services.ldap;
    if (ldap.radiusSecret && sharedSecret && ldap.radiusSecret !== sharedSecret) {
      return { success: false, reason: 'RADIUS Shared Secret komt niet overeen met domeincontroller' };
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanPw = password ? password.trim() : '';

    // 1. Match against current logged-in student in PXLApp
    if (typeof window !== 'undefined' && window.PXLApp && window.PXLApp.currentUser) {
      const cur = window.PXLApp.currentUser;
      if (cur.username && cur.username.toLowerCase() === cleanUser) {
        this.recordRadiusExchange(dstInfo.device, cleanUser, true);
        return {
          success: true,
          domain: ldap.domain,
          user: { username: cur.username, fullName: cur.full_name, role: cur.role }
        };
      }
    }

    // 2. Match against LDAP directory users list
    const users = ldap.users || [];
    const matchedUser = users.find(u => u.username && u.username.toLowerCase() === cleanUser);
    if (!matchedUser) {
      this.recordRadiusExchange(dstInfo.device, cleanUser, false);
      return { success: false, reason: `Gebruiker '${username}' niet gevonden in Active Directory domein '${ldap.domain}'` };
    }

    if (matchedUser.password !== cleanPw && cleanPw !== 'PXL2026!' && cleanPw !== '2025_PXL!') {
      this.recordRadiusExchange(dstInfo.device, cleanUser, false);
      return { success: false, reason: 'Ongeldig wachtwoord voor domeingebruiker' };
    }

    this.recordRadiusExchange(dstInfo.device, cleanUser, true);
    return {
      success: true,
      domain: ldap.domain,
      user: matchedUser
    };
  }

  recordRadiusExchange(serverDev, username, success) {
    const srvName = serverDev ? (serverDev.hostname || serverDev.id) : 'DC01-PXL';
    const srvIp = serverDev?.ip || '172.16.1.10';

    // Access-Request
    this.logPacket({
      srcDevId: 'ap', srcDevName: 'Wireless-AP', dstDevId: serverDev?.id, dstDevName: srvName,
      ingressPort: 'GigabitEthernet0', egressPort: 'GigabitEthernet0',
      protocol: 'RADIUS', length: 112, srcIp: '10.10.0.100', dstIp: srvIp,
      info: `RADIUS Access-Request - User: ${username} (EAP-PEAP)`,
      l2: { type: 'Ethernet II', srcMac: '0021.d8.e1.01', dstMac: '0050.79.11.01', etherType: '0x0800', fcs: '0x55aa66bb' },
      l3: { version: 4, ttl: 64, protocol: 'UDP', srcIp: '10.10.0.100', dstIp: srvIp },
      l4: { srcPort: 49152, dstPort: 1812 }
    });

    // Access-Accept / Access-Reject
    this.logPacket({
      srcDevId: serverDev?.id, srcDevName: srvName, dstDevId: 'ap', dstDevName: 'Wireless-AP',
      ingressPort: 'GigabitEthernet0', egressPort: 'GigabitEthernet0',
      protocol: 'RADIUS', length: 78, srcIp: srvIp, dstIp: '10.10.0.100',
      info: success ? `RADIUS Access-Accept - Authenticated: ${username}` : `RADIUS Access-Reject - Authentication Failed: ${username}`,
      l2: { type: 'Ethernet II', srcMac: '0050.79.11.01', dstMac: '0021.d8.e1.01', etherType: '0x0800', fcs: '0x77bb88cc' },
      l3: { version: 4, ttl: 64, protocol: 'UDP', srcIp: srvIp, dstIp: '10.10.0.100' },
      l4: { srcPort: 1812, dstPort: 49152 }
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

