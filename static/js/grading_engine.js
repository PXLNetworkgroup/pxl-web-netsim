/**
 * grading_engine.js - Dynamic Grading & Rubric Evaluation Engine
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class GradingEngine {
  constructor() {
    this.activeExam = null;
    this.lastEvaluation = {
      earnedPoints: 0,
      totalPoints: 0,
      percentage: 0,
      objectives: []
    };
  }

  setExam(exam) {
    this.activeExam = exam;
    this.evaluate();
  }

  evaluate() {
    if (!this.activeExam || !this.activeExam.rubric) {
      return { earnedPoints: 0, totalPoints: 0, percentage: 0, objectives: [] };
    }

    const sim = window.PXLNetworkSim;
    if (!sim) return this.lastEvaluation;

    // 1. Generate live running-configs for all devices for authentic configuration inspection
    const runningConfigs = {};
    for (const [id, dev] of Object.entries(sim.devices)) {
      if (typeof dev.generateRunningConfig === 'function') {
        runningConfigs[id] = dev.generateRunningConfig();
      }
    }

    const results = [];
    let earned = 0;
    let total = 0;

    for (const item of this.activeExam.rubric) {
      if (!item.enabled) continue; // Skip unchecked objectives

      const weight = item.points !== undefined ? item.points : 10;
      total += weight;

      let passed = false;
      let detail = "";

      try {
        const checkRes = this.checkObjective(item, sim, runningConfigs);
        passed = checkRes.passed;
        detail = checkRes.detail;
      } catch (err) {
        passed = false;
        detail = `Fout bij controle: ${err.message}`;
      }

      if (passed) {
        earned += weight;
      }

      results.push({
        id: item.id,
        category: item.category || 'general',
        title: item.title,
        desc: item.desc,
        points: weight,
        passed: passed,
        detail: detail
      });
    }

    const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
    this.lastEvaluation = {
      earnedPoints: earned,
      totalPoints: total,
      percentage: pct,
      objectives: results
    };

    return this.lastEvaluation;
  }

  checkObjective(item, sim, runningConfigs = {}) {
    const cType = item.checkType || item.type;
    const cond = Object.assign({}, item, item.condition || {});

    switch (cType) {
      case 'cabling':
      case 'cable_connection':
        if (cond.dev1 && !cond.fromDevice) cond.fromDevice = cond.dev1;
        if (cond.port1 && !cond.fromPort) cond.fromPort = cond.port1;
        if (cond.dev2 && !cond.toDevice) cond.toDevice = cond.dev2;
        if (cond.port2 && !cond.toPort) cond.toPort = cond.port2;
        return this.checkCabling(cond, sim, runningConfigs);
      case 'hostname':
        return this.checkHostname(cond, sim, runningConfigs);
      case 'enable_secret':
        return this.checkEnableSecret(cond, sim, runningConfigs);
      case 'console_password':
        return this.checkConsolePassword(cond, sim, runningConfigs);
      case 'vty_password':
      case 'line_vty_password':
        return this.checkVtyPassword(cond, sim, runningConfigs);
      case 'banner_motd':
        return this.checkBannerMotd(cond, sim, runningConfigs);
      case 'password_encryption':
        return this.checkPasswordEncryption(cond, sim, runningConfigs);
      case 'interface_ip':
      case 'ip_address':
        if (cond.targetDevice && !cond.deviceId) cond.deviceId = cond.targetDevice;
        if (cond.ip && !cond.expectedIp) cond.expectedIp = cond.ip;
        if (cond.mask && !cond.expectedMask) cond.expectedMask = cond.mask;
        return this.checkInterfaceIp(cond, sim, runningConfigs);
      case 'ip_subnet':
        return this.checkIpSubnet(cond, sim);
      case 'switch_svi':
        return this.checkSwitchSvi(cond, sim, runningConfigs);
      case 'static_route':
        return this.checkStaticRoute(cond, sim, runningConfigs);
      case 'ssh_configured':
        return this.checkSsh(cond, sim, runningConfigs);
      case 'wireless_associated':
      case 'wireless':
      case 'wireless_adapter':
      case 'wlc_wlan':
        return this.checkWireless(cond, sim, runningConfigs);
      case 'ping_test':
      case 'ping':
        if (cond.source && !cond.fromDevice) cond.fromDevice = cond.source;
        if (cond.target && !cond.targetIp) {
          const targetDev = sim.devices[cond.target];
          cond.targetIp = targetDev ? targetDev.ip : cond.target;
        }
        return this.checkPing(cond, sim, runningConfigs);
      case 'dns_query':
      case 'dns_record':
        return this.checkDns(cond, sim);
      case 'http_get':
      case 'web_request':
        return this.checkHttp(cond, sim);
      case 'copy_run_start':
        return this.checkSavedConfig(cond, sim, runningConfigs);
      case 'default_gateway':
        return this.checkDefaultGateway(cond, sim, runningConfigs);
      case 'clock_rate':
      case 'serial_clock':
        return this.checkClockRate(cond, sim, runningConfigs);
      case 'general':
        return { passed: true, detail: 'Algemeen criterium (gevalideerd)' };
      default:
        return { passed: true, detail: `${item.title || item.description || 'Criterium'} (voltooid)` };
    }
  }

  checkClockRate(cond, sim, runningConfigs = {}) {
    const devId = cond.deviceId || cond.targetDevice;
    const dev = devId ? sim.devices[devId] : Object.values(sim.devices).find(d => d.type === 'router');
    if (!dev) return { passed: false, detail: 'Router niet gevonden' };

    const intfName = cond.interface || Object.keys(dev.interfaces).find(k => k.toLowerCase().startsWith('serial')) || 'Serial0/1/0';
    const intf = dev.interfaces[intfName];
    if (!intf) return { passed: false, detail: `Interface ${intfName} niet gevonden` };

    const rate = intf.clockRate;
    const expected = cond.expected || '64000';
    const ok = rate && (String(rate) === String(expected) || !cond.expected);
    return {
      passed: Boolean(ok),
      detail: ok ? `Clock rate op ${intfName} is ${rate}` : `Clock rate ontbreekt of is niet ${expected}`
    };
  }

  checkIpSubnet(cond, sim) {
    const devId = cond.deviceId || cond.targetDevice || cond.dev;
    const dev = sim.devices[devId];
    if (!dev) return { passed: false, detail: `Apparaat ${devId} niet gevonden` };

    const ip = (dev.ip || '').trim();
    const mask = (dev.mask || '').trim();

    if (cond.subnetPrefix) {
      const ok = ip.startsWith(cond.subnetPrefix);
      return { passed: ok, detail: ok ? `IP ${ip} valt binnen ${cond.subnetPrefix}*` : `IP ${ip} valt buiten subnet` };
    }
    if (cond.expectedMask && mask !== cond.expectedMask) {
      return { passed: false, detail: `Masker ${mask} komt niet overeen met ${cond.expectedMask}` };
    }
    const hasIp = Boolean(ip && ip !== '0.0.0.0');
    return { passed: hasIp, detail: hasIp ? `IP geconfigureerd: ${ip}/${mask}` : `Geen geldig IP geconfigureerd` };
  }

  checkDns(cond, sim) {
    const server = sim.devices[cond.dnsServerId || 'Server-PT'] || Object.values(sim.devices).find(d => d.type === 'server');
    if (!server) return { passed: false, detail: 'Geen DNS-server gevonden' };
    const records = server.dnsRecords || [];
    const found = records.some(r => (!cond.name || r.name === cond.name) && (!cond.ip || r.ip === cond.ip));
    return { passed: found, detail: found ? `DNS record voor ${cond.name || 'domein'} gevonden` : `DNS record ontbreekt` };
  }

  checkHttp(cond, sim) {
    const server = sim.devices[cond.serverId || 'Server-PT'] || Object.values(sim.devices).find(d => d.type === 'server');
    if (!server) return { passed: false, detail: 'Geen webserver gevonden' };
    const httpOn = server.services ? server.services.http !== false : true;
    return { passed: httpOn, detail: httpOn ? 'HTTP webserver actief' : 'HTTP service staat uit' };
  }

  checkDefaultGateway(cond, sim, runningConfigs = {}) {
    const devId = cond.deviceId || cond.targetDevice;
    const dev = sim.devices[devId];
    if (!dev) return { passed: false, detail: `Apparaat ${devId} niet gevonden` };

    const cfg = runningConfigs[devId] || (typeof dev.generateRunningConfig === 'function' ? dev.generateRunningConfig() : '');
    const gw = (dev.gateway || dev.defaultGateway || '').trim();

    const inCfg = cond.expected ? (new RegExp(`(?:default-gateway|Default Gateway:)\\s+${cond.expected}`, 'i')).test(cfg) : false;
    const ok = cond.expected ? (gw === cond.expected.trim() || inCfg) : Boolean(gw || inCfg);

    return {
      passed: ok,
      detail: ok ? `Default gateway is ${gw || cond.expected}` : `Default gateway ontbreekt`
    };
  }

  checkCabling(cond, sim, runningConfigs = {}) {
    // cond: { fromDevice, fromPort, toDevice, toPort, cableType }
    const cable = sim.cables.find(c =>
      ((c.fromDevice === cond.fromDevice && c.fromPort === cond.fromPort && c.toDevice === cond.toDevice && c.toPort === cond.toPort) ||
       (c.fromDevice === cond.toDevice && c.fromPort === cond.toPort && c.toDevice === cond.fromDevice && c.toPort === cond.fromPort)) &&
      (!cond.cableType || c.type === cond.cableType)
    );
    const passed = Boolean(cable);
    return {
      passed,
      detail: passed ? 'Bekabeling correct aangesloten' : `Kabel ontbreekt tussen ${cond.fromDevice}:${cond.fromPort} en ${cond.toDevice}:${cond.toPort}`
    };
  }

  checkHostname(cond, sim, runningConfigs = {}) {
    const devId = cond.targetDevice || (cond.devices && cond.devices[0]);
    const dev = devId ? sim.devices[devId] : Object.values(sim.devices).find(d => d.type === 'router' || d.type === 'switch');
    if (!dev) return { passed: false, detail: 'Apparaat niet gevonden' };

    const cfg = runningConfigs[dev.id] || (typeof dev.generateRunningConfig === 'function' ? dev.generateRunningConfig() : '');
    const cfgMatch = cfg.match(/^hostname\s+(\S+)/m);
    const hostFromCfg = cfgMatch ? cfgMatch[1].trim() : dev.hostname;

    if (cond.expected) {
      const exp = cond.expected.trim().toLowerCase();
      const ok = hostFromCfg.toLowerCase() === exp || (dev.hostname && dev.hostname.toLowerCase() === exp);
      return { passed: ok, detail: ok ? `Hostname is ${hostFromCfg}` : `Huidig: ${hostFromCfg}, verwacht: ${cond.expected}` };
    }

    const ok = hostFromCfg !== dev.defaultHostname;
    return { passed: ok, detail: ok ? `Hostname aangepast naar ${hostFromCfg}` : 'Hostname nog standaard' };
  }

  checkEnableSecret(cond, sim, runningConfigs = {}) {
    const devId = cond.targetDevice;
    const dev = devId ? sim.devices[devId] : Object.values(sim.devices).find(d => d.type === 'router' || d.type === 'switch');
    if (!dev) return { passed: false, detail: 'Apparaat niet gevonden' };

    const cfg = runningConfigs[dev.id] || (typeof dev.generateRunningConfig === 'function' ? dev.generateRunningConfig() : '');
    const inCfg = /^enable secret\s+/m.test(cfg);
    const inModel = Boolean(dev.enableSecret);

    const ok = inCfg || inModel;
    return { passed: ok, detail: ok ? 'Enable secret geconfigureerd' : 'Enable secret ontbreekt in running-config' };
  }

  checkConsolePassword(cond, sim, runningConfigs = {}) {
    const devId = cond.targetDevice;
    const dev = devId ? sim.devices[devId] : Object.values(sim.devices).find(d => d.type === 'router' || d.type === 'switch');
    if (!dev) return { passed: false, detail: 'Apparaat niet gevonden' };

    const cfg = runningConfigs[dev.id] || (typeof dev.generateRunningConfig === 'function' ? dev.generateRunningConfig() : '');
    const conMatch = cfg.match(/line con 0([\s\S]*?)(?:!|line|$)/i);
    const conBlock = conMatch ? conMatch[1] : '';

    if (cond.checkLoginOnly) {
      const ok = /^\s*login/m.test(conBlock) || Boolean(dev.consoleLoginRequired);
      return { passed: ok, detail: ok ? 'Console login ingeschakeld' : 'Login niet actief op line con 0' };
    }

    if (cond.expected) {
      const exp = cond.expected.trim().toLowerCase();
      const inModel = dev.consolePassword && dev.consolePassword.trim().toLowerCase() === exp;
      const inCfg = /^\s*password\s+/m.test(conBlock);
      const ok = inModel || inCfg;
      return { passed: ok, detail: ok ? `Console wachtwoord ingesteld (${cond.expected})` : `Wachtwoord ontbreekt of komt niet overeen` };
    }

    const ok = /^\s*password\s+/m.test(conBlock) || Boolean(dev.consolePassword);
    return { passed: ok, detail: ok ? 'Console wachtwoord aanwezig' : 'Console wachtwoord ontbreekt' };
  }

  checkVtyPassword(cond, sim, runningConfigs = {}) {
    const devId = cond.targetDevice || cond.deviceId;
    const dev = devId ? sim.devices[devId] : Object.values(sim.devices).find(d => d.type === 'router' || d.type === 'switch');
    if (!dev) return { passed: false, detail: 'Apparaat niet gevonden' };

    const cfg = runningConfigs[dev.id] || (typeof dev.generateRunningConfig === 'function' ? dev.generateRunningConfig() : '');
    const vtyBlockMatch = cfg.match(/line\s+vty\s+0\s+\d+([\s\S]*?)(?:!|line|$)/i);
    const vtyBlock = vtyBlockMatch ? vtyBlockMatch[1] : '';

    if (cond.expected) {
      const exp = cond.expected.trim().toLowerCase();
      const inModel = dev.vtyPassword && dev.vtyPassword.trim().toLowerCase() === exp;
      const inCfg = /^\s*password\s+/m.test(vtyBlock);
      const ok = inModel || inCfg;
      return { passed: ok, detail: ok ? `Line VTY wachtwoord '${cond.expected}' ingesteld` : `Line VTY wachtwoord '${cond.expected}' ontbreekt` };
    }

    const ok = /^\s*password\s+/m.test(vtyBlock) || Boolean(dev.vtyPassword);
    return { passed: ok, detail: ok ? 'Line VTY wachtwoord aanwezig' : 'Line VTY wachtwoord ontbreekt' };
  }

  checkBannerMotd(cond, sim, runningConfigs = {}) {
    const devId = cond.targetDevice;
    const dev = devId ? sim.devices[devId] : Object.values(sim.devices).find(d => d.type === 'router' || d.type === 'switch');
    if (!dev) return { passed: false, detail: 'Apparaat niet gevonden' };

    const cfg = runningConfigs[dev.id] || (typeof dev.generateRunningConfig === 'function' ? dev.generateRunningConfig() : '');
    const hasBanner = /^banner motd\s+/m.test(cfg) || Boolean(dev.bannerMotd && dev.bannerMotd.length > 2);

    if (cond.expected) {
      const exp = cond.expected.trim().toLowerCase();
      const ok = (dev.bannerMotd && dev.bannerMotd.toLowerCase().includes(exp)) || (cfg.toLowerCase().includes(exp));
      return { passed: ok, detail: ok ? 'Banner MOTD aanwezig' : `Banner '${cond.expected}' ontbreekt` };
    }

    return { passed: hasBanner, detail: hasBanner ? 'Banner MOTD ingesteld' : 'Banner MOTD niet aanwezig' };
  }

  checkPasswordEncryption(cond, sim, runningConfigs = {}) {
    const devId = cond.targetDevice;
    const dev = devId ? sim.devices[devId] : Object.values(sim.devices).find(d => d.type === 'router' || d.type === 'switch');
    if (!dev) return { passed: false, detail: 'Apparaat niet gevonden' };

    const cfg = runningConfigs[dev.id] || (typeof dev.generateRunningConfig === 'function' ? dev.generateRunningConfig() : '');
    const inCfg = /^service password-encryption/m.test(cfg) && !/^no service password-encryption/m.test(cfg);
    const inModel = dev.servicePasswordEncryption === true;

    const ok = inCfg || inModel;
    return { passed: ok, detail: ok ? 'Service password-encryption actief' : 'Service password-encryption niet actief' };
  }

  checkInterfaceIp(cond, sim, runningConfigs = {}) {
    const dev = sim.devices[cond.deviceId];
    if (!dev) return { passed: false, detail: `Apparaat ${cond.deviceId} niet gevonden` };

    const intf = (dev.interfaces && dev.interfaces[cond.portName]) || {};
    const currentIp = intf.ip || dev.ip || '';
    const currentMask = intf.mask || dev.mask || '';
    const isShutdown = intf.shutdown !== undefined ? intf.shutdown : false;

    // Check running config block
    const cfg = runningConfigs[dev.id] || (typeof dev.generateRunningConfig === 'function' ? dev.generateRunningConfig() : '');
    const ipInCfg = cond.expectedIp ? (cfg.includes(cond.expectedIp) || currentIp === cond.expectedIp) : true;
    const maskInCfg = cond.expectedMask ? (cfg.includes(cond.expectedMask) || currentMask === cond.expectedMask) : true;

    const ipOk = cond.expectedIp ? (currentIp === cond.expectedIp || ipInCfg) : true;
    const maskOk = cond.expectedMask ? (currentMask === cond.expectedMask || maskInCfg) : true;
    const shutOk = cond.checkNoShutdown ? (!isShutdown || /no shutdown/i.test(cfg)) : true;

    const passed = ipOk && maskOk && shutOk;
    return {
      passed,
      detail: passed ? `${cond.portName}: ${currentIp}/${currentMask} UP` : `${cond.portName}: configuratie onvolledig`
    };
  }

  checkSwitchSvi(cond, sim, runningConfigs = {}) {
    const sw = sim.devices[cond.switchId];
    if (!sw) return { passed: false, detail: `Switch ${cond.switchId} niet gevonden` };

    const cfg = runningConfigs[sw.id] || (typeof sw.generateRunningConfig === 'function' ? sw.generateRunningConfig() : '');
    const vlanBlockMatch = cfg.match(/interface\s+vlan1([\s\S]*?)(?:!|interface|$)/i);
    const vlanBlock = vlanBlockMatch ? vlanBlockMatch[1] : '';

    const vlan = (sw.interfaces && sw.interfaces['Vlan1']) || {};
    const ipOk = cond.expectedIp ? (vlan.ip === cond.expectedIp || (new RegExp(`ip address\\s+${cond.expectedIp}`, 'i')).test(vlanBlock)) : true;
    const maskOk = cond.expectedMask ? (vlan.mask === cond.expectedMask || (new RegExp(`ip address\\s+\\S+\\s+${cond.expectedMask}`, 'i')).test(vlanBlock)) : true;
    const shutOk = cond.checkNoShutdown ? (!vlan.shutdown || /no shutdown/i.test(vlanBlock)) : true;
    const gwOk = cond.expectedGateway ? (sw.defaultGateway === cond.expectedGateway || (new RegExp(`ip default-gateway\\s+${cond.expectedGateway}`, 'i')).test(cfg)) : true;

    const passed = ipOk && maskOk && shutOk && gwOk;
    return {
      passed,
      detail: passed ? `Vlan1 ${vlan.ip || cond.expectedIp || ''} UP, Default-GW: ${sw.defaultGateway || '-'}` : `Vlan1 configuratie onvolledig`
    };
  }

  checkStaticRoute(cond, sim) {
    // cond: { routerId, network, mask, nextHop }
    const r = sim.devices[cond.routerId];
    if (!r) return { passed: false, detail: `Router ${cond.routerId} niet gevonden` };

    const ok = r.staticRoutes.some(rt =>
      rt.network === cond.network &&
      rt.mask === cond.mask &&
      (!cond.nextHop || rt.nextHop === cond.nextHop || rt.interface === cond.nextHop)
    );
    return {
      passed: ok,
      detail: ok ? `Route naar ${cond.network} aanwezig` : `Route naar ${cond.network}/${cond.mask} ontbreekt`
    };
  }

  checkSsh(cond, sim) {
    const dev = sim.devices[cond.deviceId];
    if (!dev) return { passed: false, detail: `Apparaat ${cond.deviceId} niet gevonden` };

    const hasDomain = Boolean(dev.domainName);
    const hasKey = Boolean(dev.rsaKeyBits && dev.rsaKeyBits >= 512);
    const hasUser = Object.keys(dev.users).length > 0;
    const hasTransport = dev.vtyTransportInput.includes('ssh') || dev.vtyTransportInput === 'all';

    const passed = hasDomain && hasKey && hasUser && hasTransport;
    return {
      passed,
      detail: passed ? 'SSH volledig geconfigureerd' : `Domain: ${hasDomain?'OK':'Mis'}, Key: ${hasKey?'OK':'Mis'}, User: ${hasUser?'OK':'Mis'}, VTY: ${hasTransport?'OK':'Mis'}`
    };
  }

  checkWireless(cond, sim) {
    const devId = cond.clientId || cond.deviceId || cond.targetDevice;
    const client = devId ? sim.devices[devId] : null;

    if (cond.wlcId) {
      const wlc = sim.devices[cond.wlcId];
      if (!wlc || !wlc.wlcConfig) return { passed: false, detail: `WLC ${cond.wlcId} niet gevonden` };
      const wlan = (wlc.wlcConfig.wlans || []).find(w => w.ssid === cond.expectedSsid || w.profile === cond.expectedProfile);
      const ok = Boolean(wlan && (!cond.expectedVlan || wlan.vlan === cond.expectedVlan));
      return {
        passed: ok,
        detail: ok ? `WLAN ${wlan.profile} (${wlan.ssid}) actief op VLAN ${wlan.vlan}` : `WLAN configuratie ontbreekt op WLC`
      };
    }

    if (!client) return { passed: false, detail: `Apparaat ${devId || 'onbekend'} niet gevonden` };

    if (cond.checkCardInstalled) {
      const hasCard = typeof client.hasWirelessCard === 'function' ? client.hasWirelessCard() : Boolean(client.wireless && client.wireless.installed);
      return {
        passed: hasCard,
        detail: hasCard ? `WMP300N Wi-Fi netwerkkaart geïnstalleerd` : `WMP300N Wi-Fi adapter ontbreekt`
      };
    }

    if (cond.expectedSsid) {
      const ssidOk = client.wireless && client.wireless.ssid === cond.expectedSsid;
      if (!ssidOk) return { passed: false, detail: `SSID niet ingesteld op '${cond.expectedSsid}' (huidig: ${client.wireless?.ssid || 'geen'})` };
    }

    if (cond.expectedAp) {
      const apOk = client.wireless && client.wireless.associatedAp === cond.expectedAp;
      if (!apOk) return { passed: false, detail: `Niet verbonden met AP ${cond.expectedAp}` };
    }

    if (cond.subnetPrefix) {
      const ip = client.ip || (client.wireless && client.wireless.ip) || (client.interfaces && client.interfaces['Wireless0'] && client.interfaces['Wireless0'].ip) || '';
      if (!ip.startsWith(cond.subnetPrefix)) {
        return { passed: false, detail: `Geen IP in subnet ${cond.subnetPrefix}x (huidig: ${ip || 'geen'})` };
      }
    }

    if (cond.minRssi) {
      const rssi = (client.wireless && client.wireless.rssi) || -99;
      if (rssi < cond.minRssi) {
        return { passed: false, detail: `Signaal te zwak (${rssi} dBm < vereist ${cond.minRssi} dBm norm)` };
      }
    }

    const isAssoc = Boolean(client.wireless && client.wireless.associatedAp);
    return {
      passed: isAssoc,
      detail: isAssoc ? `Draadloos verbonden met ${client.wireless.associatedAp} (${client.wireless.rssi} dBm, ${client.wireless.txRate} Mbps)` : 'Geen draadloze associatie met het vereiste AP'
    };
  }

  checkPing(cond, sim) {
    // cond: { fromDevice, targetIp }
    const passed = sim.testPing(cond.fromDevice, cond.targetIp);
    return {
      passed,
      detail: passed ? `Ping ${cond.fromDevice} -> ${cond.targetIp} geslaagd` : `Ping ${cond.fromDevice} -> ${cond.targetIp} mislukt`
    };
  }

  checkSavedConfig(cond, sim) {
    const devs = cond.targetDevice ? [sim.devices[cond.targetDevice]].filter(Boolean) : Object.values(sim.devices).filter(d => d.type === 'router' || d.type === 'switch');
    const ok = devs.length > 0 && devs.every(d => Boolean(d.savedStartupConfig));
    return {
      passed: ok,
      detail: ok ? 'Startup-config opgeslagen in NVRAM' : 'Nog niet opgeslagen met copy run start'
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GradingEngine };
}

