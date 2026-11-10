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
        const checkRes = this.checkObjective(item, sim);
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

  checkObjective(item, sim) {
    const cType = item.checkType || item.type;
    const cond = item.condition || {};

    switch (cType) {
      case 'cabling':
        return this.checkCabling(cond, sim);
      case 'hostname':
        return this.checkHostname(cond, sim);
      case 'enable_secret':
        return this.checkEnableSecret(cond, sim);
      case 'console_password':
        return this.checkConsolePassword(cond, sim);
      case 'banner_motd':
        return this.checkBannerMotd(cond, sim);
      case 'password_encryption':
        return this.checkPasswordEncryption(cond, sim);
      case 'interface_ip':
        return this.checkInterfaceIp(cond, sim);
      case 'switch_svi':
        return this.checkSwitchSvi(cond, sim);
      case 'static_route':
        return this.checkStaticRoute(cond, sim);
      case 'ssh_configured':
        return this.checkSsh(cond, sim);
      case 'wireless_associated':
        return this.checkWireless(cond, sim);
      case 'ping_test':
        return this.checkPing(cond, sim);
      case 'copy_run_start':
        return this.checkSavedConfig(cond, sim);
      case 'default_gateway':
        return this.checkDefaultGateway(cond, sim);
      case 'general':
        return { passed: true, detail: 'Algemeen criterium (gevalideerd)' };
      default:
        return { passed: false, detail: 'Onbekend check-type' };
    }
  }

  checkDefaultGateway(cond, sim) {
    const devId = cond.deviceId || cond.targetDevice;
    const dev = sim.devices[devId];
    if (!dev) return { passed: false, detail: `Apparaat ${devId} niet gevonden` };

    const gw = (dev.gateway || dev.defaultGateway || '').trim();
    if (!gw) return { passed: false, detail: `Default gateway ontbreekt op ${devId}` };

    const ok = cond.expected ? gw === cond.expected.trim() : Boolean(gw);
    return {
      passed: ok,
      detail: ok ? `Default gateway is ${gw}` : `Huidig: ${gw}, verwacht: ${cond.expected}`
    };
  }

  checkCabling(cond, sim) {
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

  checkHostname(cond, sim) {
    const devs = cond.devices ? cond.devices.map(id => sim.devices[id]).filter(Boolean) : Object.values(sim.devices).filter(d => d.type === 'router' || d.type === 'switch');
    if (devs.length === 0) return { passed: false, detail: 'Geen apparaten gevonden' };

    if (cond.expected) {
      const dev = sim.devices[cond.targetDevice];
      if (!dev) return { passed: false, detail: 'Apparaat niet gevonden' };
      const ok = dev.hostname.toLowerCase() === cond.expected.toLowerCase();
      return { passed: ok, detail: ok ? `Hostname is ${dev.hostname}` : `Huidig: ${dev.hostname}, verwacht: ${cond.expected}` };
    }

    // Check all devices have non-default unique names
    const allNonDefault = devs.every(d => d.hostname !== d.defaultHostname);
    const names = devs.map(d => d.hostname.toLowerCase());
    const unique = new Set(names).size === names.length;
    return {
      passed: allNonDefault && unique,
      detail: allNonDefault && unique ? 'Alle apparaten hebben een unieke naam' : 'Namen zijn nog standaard of niet uniek'
    };
  }

  checkEnableSecret(cond, sim) {
    const devs = cond.targetDevice ? [sim.devices[cond.targetDevice]].filter(Boolean) : Object.values(sim.devices).filter(d => d.type === 'router' || d.type === 'switch');
    const ok = devs.length > 0 && devs.every(d => Boolean(d.enableSecret));
    return { passed: ok, detail: ok ? 'Enable secret ingesteld' : 'Enable secret ontbreekt' };
  }

  checkConsolePassword(cond, sim) {
    const devs = cond.targetDevice ? [sim.devices[cond.targetDevice]].filter(Boolean) : Object.values(sim.devices).filter(d => d.type === 'router' || d.type === 'switch');
    if (devs.length === 0) return { passed: false, detail: 'Apparaat niet gevonden' };

    if (cond.checkLoginOnly) {
      const ok = devs.every(d => Boolean(d.consoleLoginRequired));
      return { passed: ok, detail: ok ? 'Console login ingeschakeld' : 'Login nog niet geactiveerd op line con 0' };
    }

    if (cond.expected) {
      const exp = cond.expected.trim().toLowerCase();
      const ok = devs.every(d => d.consolePassword && d.consolePassword.trim().toLowerCase() === exp);
      return { passed: ok, detail: ok ? `Console wachtwoord correct ingesteld (${cond.expected})` : `Wachtwoord komt niet overeen met '${cond.expected}'` };
    }

    const ok = devs.every(d => Boolean(d.consolePassword));
    return { passed: ok, detail: ok ? 'Console wachtwoord ingesteld' : 'Console wachtwoord ontbreekt' };
  }

  checkBannerMotd(cond, sim) {
    const devs = cond.targetDevice ? [sim.devices[cond.targetDevice]].filter(Boolean) : Object.values(sim.devices).filter(d => d.type === 'router' || d.type === 'switch');
    if (devs.length === 0) return { passed: false, detail: 'Apparaat niet gevonden' };

    if (cond.expected) {
      const exp = cond.expected.trim().toLowerCase();
      const ok = devs.every(d => d.bannerMotd && d.bannerMotd.toLowerCase().includes(exp));
      return { passed: ok, detail: ok ? `Banner MOTD correct ingesteld` : `Banner '${cond.expected}' ontbreekt of komt niet overeen` };
    }

    const ok = devs.length > 0 && devs.every(d => Boolean(d.bannerMotd && d.bannerMotd.length > 2));
    return { passed: ok, detail: ok ? 'Banner MOTD aanwezig' : 'Banner MOTD niet geconfigureerd' };
  }

  checkPasswordEncryption(cond, sim) {
    const devs = cond.targetDevice ? [sim.devices[cond.targetDevice]].filter(Boolean) : Object.values(sim.devices).filter(d => d.type === 'router' || d.type === 'switch');
    const ok = devs.length > 0 && devs.every(d => d.servicePasswordEncryption === true);
    return { passed: ok, detail: ok ? 'Service password-encryption actief' : 'Niet ingeschakeld' };
  }

  checkInterfaceIp(cond, sim) {
    // cond: { deviceId, portName, expectedIp, expectedMask, checkDescription, checkNoShutdown }
    const dev = sim.devices[cond.deviceId];
    if (!dev) return { passed: false, detail: `Apparaat ${cond.deviceId} niet gevonden` };

    const intf = dev.interfaces[cond.portName];
    // Check both interface object and device-level IP settings (for PCs/laptops)
    const currentIp = (intf && intf.ip) || dev.ip || '';
    const currentMask = (intf && intf.mask) || dev.mask || '';
    const isShutdown = (intf && intf.shutdown !== undefined) ? intf.shutdown : false;

    const ipOk = cond.expectedIp ? currentIp === cond.expectedIp : true;
    const maskOk = cond.expectedMask ? currentMask === cond.expectedMask : true;
    const shutOk = cond.checkNoShutdown ? !isShutdown : true;
    const descOk = cond.checkDescription ? Boolean(intf && intf.description) : true;

    const passed = ipOk && maskOk && shutOk && descOk;
    let detail = "";
    if (passed) {
      detail = `${cond.portName}: ${currentIp}/${currentMask} UP`;
    } else {
      detail = `${cond.portName}: IP=${currentIp || 'geen'}, Mask=${currentMask || 'geen'}, Status=${isShutdown ? 'Down' : 'Up'}`;
    }
    return { passed, detail };
  }

  checkSwitchSvi(cond, sim) {
    // cond: { switchId, expectedIp, expectedMask, expectedGateway, checkNoShutdown }
    const sw = sim.devices[cond.switchId];
    if (!sw) return { passed: false, detail: `Switch ${cond.switchId} niet gevonden` };

    const vlan = sw.interfaces['Vlan1'];
    if (!vlan) return { passed: false, detail: 'Vlan1 ontbreekt' };

    const ipOk = cond.expectedIp ? vlan.ip === cond.expectedIp : true;
    const maskOk = cond.expectedMask ? vlan.mask === cond.expectedMask : true;
    const shutOk = cond.checkNoShutdown ? !vlan.shutdown : true;
    const gwOk = cond.expectedGateway ? (sw.defaultGateway === cond.expectedGateway || sw.gateway === cond.expectedGateway) : true;

    const passed = ipOk && maskOk && shutOk && gwOk;
    return {
      passed,
      detail: passed ? `Vlan1 ${vlan.ip} UP, Default-GW: ${sw.defaultGateway || '-'}` : `Vlan1: ${vlan.ip || 'geen IP'} (${vlan.shutdown ? 'Down' : 'Up'}), GW: ${sw.defaultGateway || 'geen'}`
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
    const client = sim.devices[cond.clientId];
    if (!client) return { passed: false, detail: `Client ${cond.clientId} niet gevonden` };

    const ok = client.wireless && client.wireless.associatedAp === cond.expectedAp;
    return {
      passed: ok,
      detail: ok ? `Verbonden met AP ${cond.expectedAp}` : 'Geen draadloze associatie met het vereiste AP'
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

