/**
 * mikrotik_cli.js - RouterOS CLI Parser & Terminal Emulator for MikroTik hEX lite (RB750r2)
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class MikroTikCLIParser {
  constructor(device, printCallback, updatePromptCallback, triggerScoreUpdate) {
    this.device = device;
    this.print = printCallback || console.log;
    this.updatePrompt = updatePromptCallback || (() => {});
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});

    // Ensure MikroTik specific fields exist
    this.initDeviceDefaults();
  }

  initDeviceDefaults() {
    const dev = this.device;
    if (!dev.mikrotikConfig) {
      dev.mikrotikConfig = {
        identity: dev.hostname || 'MikroTik',
        services: {
          ssh: { enabled: true, port: 22 },
          winbox: { enabled: true, port: 8291 },
          www: { enabled: true, port: 80 },
          ftp: { enabled: false, port: 21 },
          telnet: { enabled: false, port: 23 }
        },
        users: {
          admin: { password: '', group: 'full' }
        }
      };
    }
  }

  handleCommand(rawLine) {
    const dev = this.device;
    if (!dev.powerOn) {
      this.print("% Device is powered off. Please turn power ON in the Physical tab.");
      return;
    }

    const line = rawLine.trim();
    if (!line) {
      this.print("");
      return;
    }

    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    // Normalize command (strip leading slashes or handle contextual navigation)
    let clean = line.replace(/^\/+/, '').trim();
    const tokens = clean.split(/\s+/);
    const cmd0 = tokens[0].toLowerCase();

    // 1. Exit / Quit
    if (cmd0 === 'quit' || cmd0 === 'exit') {
      this.print(`[Connection to ${dev.mikrotikConfig.identity} closed]`);
      return;
    }

    // 2. Help / '?'
    if (cmd0 === '?' || cmd0 === 'help') {
      this.printRouterOSHelp();
      return;
    }

    // 3. /export
    if (cmd0 === 'export') {
      this.handleExport();
      return;
    }

    // 4. /ping <ip>
    if (cmd0 === 'ping') {
      this.handlePing(tokens.slice(1));
      return;
    }

    // 5. /system identity
    if (cmd0 === 'system' || cmd0 === 'sys') {
      this.handleSystem(tokens.slice(1));
      return;
    }

    // 6. /interface
    if (cmd0 === 'interface' || cmd0 === 'int') {
      this.handleInterface(tokens.slice(1));
      return;
    }

    // 7. /ip
    if (cmd0 === 'ip') {
      this.handleIp(tokens.slice(1));
      return;
    }

    // 8. /user
    if (cmd0 === 'user') {
      this.handleUser(tokens.slice(1));
      return;
    }

    // Direct shortcuts (e.g. 'ip addr pr', 'ip route pr')
    this.print(`syntax error (line 1 column 1)`);
  }

  handleExport() {
    const dev = this.device;
    const now = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    this.print(`# ${now.toLowerCase()} by RouterOS 7.12`);
    this.print(`# software id = 4PXL-NET`);
    this.print(`# model = RB750r2`);
    this.print(`# serial number = H4PXL750001`);
    this.print(`/interface`);
    for (const p of Object.keys(dev.interfaces)) {
      this.print(`set [ find default-name=${p} ] name=${p}`);
    }
    this.print(`/ip address`);
    for (const [p, intf] of Object.entries(dev.interfaces)) {
      if (intf.ip && intf.mask) {
        const cidr = this.maskToCIDR(intf.mask);
        this.print(`add address=${intf.ip}/${cidr} interface=${p} network=${this.calcNetwork(intf.ip, intf.mask)}`);
      }
    }
    this.print(`/ip route`);
    for (const r of dev.staticRoutes) {
      this.print(`add dst-address=${r.network}/${this.maskToCIDR(r.mask)} gateway=${r.nextHop}`);
    }
    this.print(`/ip service`);
    for (const [sName, sCfg] of Object.entries(dev.mikrotikConfig.services)) {
      if (sCfg.enabled) {
        this.print(`set ${sName} disabled=no`);
      } else {
        this.print(`set ${sName} disabled=yes`);
      }
    }
    this.print(`/system identity`);
    this.print(`set name=${dev.mikrotikConfig.identity}`);
    this.print("");
  }

  handleSystem(tokens) {
    const dev = this.device;
    if (tokens.length === 0) {
      this.print("syntax error: specify system sub-menu (identity, reboot)");
      return;
    }
    const sub = tokens[0].toLowerCase();
    if (sub === 'identity' || sub === 'id') {
      if (tokens.length >= 2 && tokens[1].toLowerCase() === 'print') {
        this.print(`       name: ${dev.mikrotikConfig.identity}`);
        return;
      }
      if (tokens.length >= 2 && tokens[1].toLowerCase() === 'set') {
        const nameArg = tokens.slice(2).join(' ');
        const m = nameArg.match(/name=(.+)/i);
        if (m) {
          const newName = m[1].replace(/['"]/g, '').trim();
          dev.mikrotikConfig.identity = newName;
          dev.hostname = newName;
          dev.displayName = newName;
          if (this.updatePrompt) this.updatePrompt();
          if (this.triggerScoreUpdate) this.triggerScoreUpdate();
          return;
        }
      }
      this.print("usage: /system identity set name=<name> or /system identity print");
      return;
    }

    if (sub === 'reboot') {
      this.print("Rebooting device...");
      setTimeout(() => {
        this.print("RouterOS 7.12 (RB750r2)\nMikroTik RouterOS Login: admin\n");
        if (this.updatePrompt) this.updatePrompt();
      }, 500);
      return;
    }

    this.print(`unknown system command '${sub}'`);
  }

  handleInterface(tokens) {
    const dev = this.device;
    if (tokens.length === 0 || tokens[0].toLowerCase().startsWith('pr')) {
      this.print("Flags: D - DYNAMIC; R - RUNNING; S - SLAVE");
      this.print("Columns: NAME, TYPE, ACTUAL-MTU, MAC-ADDRESS");
      this.print("#     NAME    TYPE   ACTUAL-MTU  MAC-ADDRESS");
      let idx = 0;
      for (const [pName, intf] of Object.entries(dev.interfaces)) {
        const flag = intf.shutdown ? " " : "R";
        const mac = intf.mac || "48:8F:5A:12:34:56";
        this.print(`${idx.toString().padStart(2, ' ')}  ${flag}  ${pName.padEnd(8, ' ')} ether        1500  ${mac}`);
        idx++;
      }
      this.print("");
      return;
    }
    this.print(`bad command name '${tokens[0]}' in /interface`);
  }

  handleIp(tokens) {
    const dev = this.device;
    if (tokens.length === 0) {
      this.print("syntax error: specify ip sub-menu (address, route, service)");
      return;
    }

    const sub = tokens[0].toLowerCase();

    // /ip address
    if (sub === 'address' || sub === 'addr') {
      const act = tokens[1] ? tokens[1].toLowerCase() : 'print';
      if (act.startsWith('pr')) {
        this.print("Flags: D - DYNAMIC; G - GLOBAL");
        this.print("Columns: ADDRESS, NETWORK, INTERFACE");
        this.print("#   ADDRESS            NETWORK          INTERFACE");
        let idx = 0;
        for (const [pName, intf] of Object.entries(dev.interfaces)) {
          if (intf.ip && intf.mask) {
            const cidr = this.maskToCIDR(intf.mask);
            const net = this.calcNetwork(intf.ip, intf.mask);
            const addrStr = `${intf.ip}/${cidr}`;
            this.print(`${idx.toString().padStart(2, ' ')}   ${addrStr.padEnd(18, ' ')} ${net.padEnd(16, ' ')} ${pName}`);
            idx++;
          }
        }
        if (idx === 0) {
          this.print("  (no ip addresses configured)");
        }
        this.print("");
        return;
      }

      if (act === 'add') {
        const rest = tokens.slice(2).join(' ');
        const addrMatch = rest.match(/address=([0-9\.\/]+)/i);
        const intfMatch = rest.match(/interface=([a-zA-Z0-9_-]+)/i);

        if (!addrMatch || !intfMatch) {
          this.print("failure: syntax is '/ip address add address=192.168.88.1/24 interface=ether1'");
          return;
        }

        const rawAddr = addrMatch[1];
        const targetIntf = intfMatch[1];
        const [ip, cidr] = rawAddr.split('/');
        const mask = cidr ? this.cidrToMask(parseInt(cidr, 10)) : "255.255.255.0";

        if (!dev.interfaces[targetIntf]) {
          this.print(`failure: interface '${targetIntf}' does not exist on this hEX lite`);
          return;
        }

        dev.interfaces[targetIntf].ip = ip;
        dev.interfaces[targetIntf].mask = mask;
        dev.interfaces[targetIntf].shutdown = false;
        this.print("");
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }

      if (act === 'remove' || act === 'rem') {
        const targetIntf = tokens[2];
        if (dev.interfaces[targetIntf]) {
          dev.interfaces[targetIntf].ip = "";
          dev.interfaces[targetIntf].mask = "";
          this.print(`removed address from ${targetIntf}`);
          return;
        }
        this.print("usage: /ip address remove <interface-name>");
        return;
      }
    }

    // /ip route
    if (sub === 'route' || sub === 'ro') {
      const act = tokens[1] ? tokens[1].toLowerCase() : 'print';
      if (act.startsWith('pr')) {
        this.print("Flags: D - DYNAMIC; A - ACTIVE; c - CONNECT, s - STATIC");
        this.print("Columns: DST-ADDRESS, GATEWAY, DISTANCE");
        this.print("#     DST-ADDRESS        GATEWAY         DISTANCE");
        let idx = 0;
        for (const r of dev.staticRoutes) {
          const cidr = this.maskToCIDR(r.mask);
          const dst = `${r.network}/${cidr}`;
          this.print(`${idx.toString().padStart(2, ' ')}  As ${dst.padEnd(18, ' ')} ${r.nextHop.padEnd(15, ' ')} 1`);
          idx++;
        }
        // Also show connected routes
        for (const [pName, intf] of Object.entries(dev.interfaces)) {
          if (intf.ip && intf.mask) {
            const cidr = this.maskToCIDR(intf.mask);
            const net = `${this.calcNetwork(intf.ip, intf.mask)}/${cidr}`;
            this.print(`${idx.toString().padStart(2, ' ')}  Ac ${net.padEnd(18, ' ')} ${pName.padEnd(15, ' ')} 0`);
            idx++;
          }
        }
        this.print("");
        return;
      }

      if (act === 'add') {
        const rest = tokens.slice(2).join(' ');
        const gwMatch = rest.match(/gateway=([0-9\.]+)/i);
        const dstMatch = rest.match(/dst-address=([0-9\.\/]+)/i);

        if (!gwMatch) {
          this.print("failure: syntax is '/ip route add gateway=192.168.1.254 [dst-address=0.0.0.0/0]'");
          return;
        }

        const gateway = gwMatch[1];
        let network = "0.0.0.0";
        let mask = "0.0.0.0";
        if (dstMatch) {
          const [n, c] = dstMatch[1].split('/');
          network = n;
          mask = c ? this.cidrToMask(parseInt(c, 10)) : "255.255.255.0";
        }

        dev.staticRoutes.push({ network, mask, nextHop: gateway });
        this.print("");
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }
    }

    // /ip service
    if (sub === 'service') {
      const act = tokens[1] ? tokens[1].toLowerCase() : 'print';
      if (act.startsWith('pr')) {
        this.print("Flags: X - DISABLED, I - INVALID");
        this.print("Columns: NAME, PORT, ADDRESS");
        this.print("#   NAME     PORT  ADDRESS");
        let idx = 0;
        for (const [sName, sCfg] of Object.entries(dev.mikrotikConfig.services)) {
          const flag = sCfg.enabled ? " " : "X";
          this.print(`${idx.toString().padStart(2, ' ')} ${flag} ${sName.padEnd(8, ' ')} ${sCfg.port.toString().padEnd(5, ' ')} 0.0.0.0/0`);
          idx++;
        }
        this.print("");
        return;
      }

      if (act === 'enable') {
        const sName = tokens[2]?.toLowerCase();
        if (dev.mikrotikConfig.services[sName]) {
          dev.mikrotikConfig.services[sName].enabled = true;
          this.print(`service '${sName}' enabled`);
          return;
        }
      }

      if (act === 'disable') {
        const sName = tokens[2]?.toLowerCase();
        if (dev.mikrotikConfig.services[sName]) {
          dev.mikrotikConfig.services[sName].enabled = false;
          this.print(`service '${sName}' disabled`);
          return;
        }
      }

      if (act === 'set') {
        const rest = tokens.slice(2).join(' ');
        const sName = tokens[2]?.toLowerCase();
        const disMatch = rest.match(/disabled=(yes|no)/i);
        if (dev.mikrotikConfig.services[sName] && disMatch) {
          dev.mikrotikConfig.services[sName].enabled = (disMatch[1].toLowerCase() === 'no');
          this.print(`service '${sName}' set disabled=${disMatch[1]}`);
          return;
        }
      }
    }

    this.print(`bad command name '${sub}' in /ip`);
  }

  handleUser(tokens) {
    const dev = this.device;
    if (tokens.length === 0 || tokens[0].toLowerCase().startsWith('pr')) {
      this.print("Flags: X - DISABLED");
      this.print("Columns: NAME, GROUP");
      this.print("#   NAME   GROUP");
      let idx = 0;
      for (const [uName, uCfg] of Object.entries(dev.mikrotikConfig.users)) {
        this.print(`${idx.toString().padStart(2, ' ')}   ${uName.padEnd(6, ' ')} ${uCfg.group || 'full'}`);
        idx++;
      }
      this.print("");
      return;
    }

    if (tokens[0].toLowerCase() === 'add') {
      const rest = tokens.slice(1).join(' ');
      const nameM = rest.match(/name=([a-zA-Z0-9_-]+)/i);
      const passM = rest.match(/password=([^\s]+)/i);
      if (nameM) {
        const u = nameM[1];
        const p = passM ? passM[1] : '';
        dev.mikrotikConfig.users[u] = { password: p, group: 'full' };
        this.print(`user '${u}' created`);
        return;
      }
    }

    if (tokens[0].toLowerCase() === 'set') {
      const rest = tokens.slice(1).join(' ');
      const user = tokens[1];
      const passM = rest.match(/password=([^\s]+)/i);
      if (dev.mikrotikConfig.users[user] && passM) {
        dev.mikrotikConfig.users[user].password = passM[1];
        this.print(`password updated for '${user}'`);
        return;
      }
    }

    this.print("usage: /user print or /user add name=<name> password=<pw> group=full");
  }

  handlePing(args) {
    if (args.length === 0) {
      this.print("failure: specify destination address (e.g. /ping 192.168.88.1)");
      return;
    }
    const target = args[0];
    this.print(`  SEQ HOST                                     SIZE TTL TIME  STATUS`);
    if (window.PXLNetworkSim) {
      const res = window.PXLNetworkSim.executePing(this.device.id, target);
      for (let seq = 0; seq < 4; seq++) {
        if (res.success) {
          const ms = 1 + Math.floor(Math.random() * 8);
          this.print(`    ${seq} ${target.padEnd(40, ' ')}   56  64  ${ms}ms`);
        } else {
          this.print(`    ${seq} ${target.padEnd(40, ' ')}                timeout`);
        }
      }
      if (res.success) {
        this.print(`    sent=4 received=4 packet-loss=0% min-rtt=1ms avg-rtt=4ms max-rtt=9ms\n`);
      } else {
        this.print(`    sent=4 received=0 packet-loss=100%\n`);
      }
    }
  }

  printRouterOSHelp() {
    this.print("MikroTik RouterOS 7.12 Command Reference:");
    this.print("  /interface print                       List all 5 FastEthernet ports");
    this.print("  /ip address add address=<ip/mask> interface=<port>  Assign IP address");
    this.print("  /ip address print                      Display IP configuration table");
    this.print("  /ip route add gateway=<ip>             Set default / static route");
    this.print("  /ip route print                        Display routing table");
    this.print("  /ip service set ssh disabled=no        Enable SSH service for remote access");
    this.print("  /system identity set name=<name>       Configure router identity");
    this.print("  /user add name=<user> password=<pass>  Create local admin credentials");
    this.print("  /export                                Show active RouterOS configuration");
    this.print("  /ping <destination-ip>                 Test network connectivity");
    this.print("");
  }

  tabComplete(inputLine) {
    if (!inputLine) return "";
    const raw = inputLine.trim();
    const routerOsGrammar = [
      '/export',
      '/interface print',
      '/ip address add address=',
      '/ip address print',
      '/ip address remove',
      '/ip route add gateway=',
      '/ip route print',
      '/ip service print',
      '/ip service set ssh disabled=no',
      '/ip service set ssh disabled=yes',
      '/ping',
      '/system identity set name=',
      '/system identity print',
      '/system reboot',
      '/user print',
      '/user add name='
    ];

    const clean = raw.toLowerCase();
    for (const g of routerOsGrammar) {
      const gClean = g.toLowerCase();
      // Match full prefix
      if (gClean.startsWith(clean)) {
        return (raw.startsWith('/') ? g : g.replace(/^\//, '')) + ' ';
      }
      // Match token prefixes (e.g. /sys id -> /system identity)
      const rawTokens = clean.replace(/^\//, '').split(/\s+/);
      const gTokens = gClean.replace(/^\//, '').split(/\s+/);
      if (rawTokens.length <= gTokens.length) {
        const matches = rawTokens.every((tok, idx) => gTokens[idx].startsWith(tok));
        if (matches) {
          const res = raw.startsWith('/') ? g : g.replace(/^\//, '');
          return res + ' ';
        }
      }
    }
    return inputLine;
  }

  maskToCIDR(mask) {
    if (!mask) return 24;
    return mask.split('.').reduce((acc, oct) => acc + (parseInt(oct, 10).toString(2).match(/1/g) || []).length, 0);
  }

  cidrToMask(cidr) {
    const mask = [];
    for (let i = 0; i < 4; i++) {
      const bits = Math.min(Math.max(cidr - i * 8, 0), 8);
      mask.push(256 - Math.pow(2, 8 - bits));
    }
    return mask.join('.');
  }

  calcNetwork(ip, mask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    return ipParts.map((p, i) => p & maskParts[i]).join('.');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MikroTikCLIParser };
}
