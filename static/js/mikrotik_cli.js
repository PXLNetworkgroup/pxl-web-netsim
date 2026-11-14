/**
 * mikrotik_cli.js - Complete RouterOS 7.x CLI Parser & Terminal Emulator for MikroTik hEX lite (RB750r2)
 * Part of PXL Web NetSim (Hogeschool PXL)
 *
 * Implements:
 * - Authentic RouterOS prompt and hierarchical menu context navigation (/, .., relative and absolute paths)
 * - Complete /ip address, /ip route, /interface, /interface bridge, /ip pool, /ip dhcp-server,
 *   /ip dhcp-client, /ip dns, /ip firewall filter & nat, /system resource/routerboard/clock/identity,
 *   /export, /ping, /tool traceroute, /user management, and tab completion.
 */

class MikroTikCLIParser {
  constructor(device, printCallback, updatePromptCallback, triggerScoreUpdate) {
    this.device = device;
    this.print = printCallback || console.log;
    this.updatePrompt = updatePromptCallback || (() => {});
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});

    // Active context path inside RouterOS menu tree (empty string = root '/')
    this.contextPath = '';

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
        },
        bridges: [],
        bridgePorts: [],
        pools: [
          { id: 0, name: 'dhcp-pool', ranges: '192.168.88.10-192.168.88.50' }
        ],
        dhcpServers: [
          { id: 0, name: 'dhcp1', interface: 'ether2', pool: 'dhcp-pool', disabled: false }
        ],
        dhcpNetworks: [
          { id: 0, address: '192.168.88.0/24', gateway: '192.168.88.1', dns: '192.168.88.1' }
        ],
        dhcpClients: [
          { id: 0, interface: 'ether1', disabled: false, status: 'bound', address: '192.168.1.150/24' }
        ],
        dns: {
          servers: ['8.8.8.8', '1.1.1.1'],
          allowRemoteRequests: true,
          static: [
            { id: 0, name: 'router.lan', address: '192.168.88.1' }
          ]
        },
        firewall: {
          filter: [
            { id: 0, chain: 'input', action: 'accept', protocol: 'icmp', comment: 'defconf: accept ICMP' },
            { id: 1, chain: 'input', action: 'accept', connectionState: 'established,related', comment: 'defconf: accept established,related' },
            { id: 2, chain: 'forward', action: 'accept', connectionState: 'established,related', comment: 'defconf: accept established,related' }
          ],
          nat: [
            { id: 0, chain: 'srcnat', action: 'masquerade', outInterface: 'ether1', comment: 'defconf: masquerade' }
          ]
        }
      };
    }
  }

  getPrompt() {
    const id = this.device.mikrotikConfig?.identity || this.device.hostname || 'MikroTik';
    if (!this.contextPath || this.contextPath === '/') {
      return `[admin@${id}] > `;
    }
    return `[admin@${id}] ${this.contextPath}> `;
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

    if (!dev.history) dev.history = [];
    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    // 1. Context navigation commands
    if (line === '/') {
      this.contextPath = '';
      this.refreshPrompt();
      return;
    }

    if (line === '..') {
      this.navigateUp();
      this.refreshPrompt();
      return;
    }

    // 2. Quit / Exit
    if (line.toLowerCase() === 'quit' || line.toLowerCase() === 'exit') {
      if (this.contextPath) {
        this.navigateUp();
        this.refreshPrompt();
        return;
      }
      this.print(`[Connection to ${dev.mikrotikConfig.identity} closed]`);
      return;
    }

    // 3. Help
    if (line === '?' || line.toLowerCase() === 'help') {
      this.printRouterOSHelp();
      return;
    }

    // 4. Resolve full path vs relative path
    let fullCmd = line;
    if (line.startsWith('/')) {
      fullCmd = line.substring(1).trim();
    } else if (this.contextPath) {
      const cleanCtx = this.contextPath.replace(/^\/+/, '').trim();
      fullCmd = `${cleanCtx} ${line}`.trim();
    }

    // Check if line is purely context navigation (e.g. 'ip address', 'interface bridge', 'system')
    if (this.tryChangeContext(line)) {
      this.refreshPrompt();
      return;
    }

    this.executeResolvedCommand(fullCmd, line);
  }

  navigateUp() {
    if (!this.contextPath) return;
    const parts = this.contextPath.split('/').filter(p => p.trim());
    parts.pop();
    this.contextPath = parts.length > 0 ? '/' + parts.join('/') : '';
  }

  tryChangeContext(line) {
    const clean = line.replace(/^\/+/, '').trim().toLowerCase();
    const validContexts = [
      'ip', 'ip address', 'ip addr', 'ip route', 'ip service', 'ip pool',
      'ip dhcp-server', 'ip dhcp-server network', 'ip dhcp-server lease',
      'ip dhcp-client', 'ip dns', 'ip dns static', 'ip firewall',
      'ip firewall filter', 'ip firewall nat',
      'interface', 'interface ethernet', 'interface bridge', 'interface bridge port',
      'system', 'user', 'tool', 'file'
    ];

    // Check if line is a known sub-menu without action
    let target = clean;
    if (clean === 'ip addr') target = 'ip address';
    if (clean === 'ip ro') target = 'ip route';
    if (clean === 'int') target = 'interface';
    if (clean === 'int br') target = 'interface bridge';

    if (validContexts.includes(clean) || validContexts.includes(target)) {
      if (line.startsWith('/')) {
        this.contextPath = '/' + target;
      } else if (this.contextPath) {
        const combined = (this.contextPath + '/' + clean).replace(/\/+/g, '/');
        const normCombined = combined.replace(/^\/+/, '');
        if (validContexts.includes(normCombined)) {
          this.contextPath = '/' + normCombined;
        } else {
          this.contextPath = '/' + target;
        }
      } else {
        this.contextPath = '/' + target;
      }
      return true;
    }
    return false;
  }

  refreshPrompt() {
    if (this.device) {
      if (!this.device.promptState) this.device.promptState = {};
      this.device.promptState.promptText = this.getPrompt();
    }
    if (this.updatePrompt) this.updatePrompt();
  }

  executeResolvedCommand(fullCmd, originalLine) {
    const tokens = fullCmd.split(/\s+/);
    const cmd0 = tokens[0].toLowerCase();

    // Export
    if (cmd0 === 'export') {
      this.handleExport(tokens.slice(1));
      return;
    }

    // Ping
    if (cmd0 === 'ping' || (cmd0 === 'tool' && tokens[1]?.toLowerCase() === 'ping')) {
      const pingArgs = cmd0 === 'ping' ? tokens.slice(1) : tokens.slice(2);
      this.handlePing(pingArgs);
      return;
    }

    // Traceroute
    if (cmd0 === 'traceroute' || (cmd0 === 'tool' && (tokens[1]?.toLowerCase() === 'traceroute' || tokens[1]?.toLowerCase() === 'tracert'))) {
      const trArgs = cmd0 === 'traceroute' ? tokens.slice(1) : tokens.slice(2);
      this.handleTraceroute(trArgs);
      return;
    }

    // System commands
    if (cmd0 === 'system' || cmd0 === 'sys') {
      this.handleSystem(tokens.slice(1));
      return;
    }

    // Interface commands
    if (cmd0 === 'interface' || cmd0 === 'int') {
      this.handleInterface(tokens.slice(1));
      return;
    }

    // IP commands
    if (cmd0 === 'ip') {
      this.handleIp(tokens.slice(1));
      return;
    }

    // User commands
    if (cmd0 === 'user') {
      this.handleUser(tokens.slice(1));
      return;
    }

    // Tool commands
    if (cmd0 === 'tool') {
      this.handleTool(tokens.slice(1));
      return;
    }

    // File print
    if (cmd0 === 'file') {
      this.handleFile(tokens.slice(1));
      return;
    }

    this.print(`syntax error (line 1 column 1)`);
  }

  // --- /EXPORT ---
  handleExport(args = []) {
    const dev = this.device;
    const now = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    this.print(`# ${now.toLowerCase()} by RouterOS 7.14.1`);
    this.print(`# software id = 4PXL-NET`);
    this.print(`# model = RB750r2 (hEX lite)`);
    this.print(`# serial number = H4PXL750001`);
    this.print(`/interface bridge`);
    for (const b of (dev.mikrotikConfig.bridges || [])) {
      this.print(`add name=${b.name}`);
    }
    this.print(`/interface`);
    for (const p of Object.keys(dev.interfaces)) {
      this.print(`set [ find default-name=${p} ] name=${p}`);
    }
    if ((dev.mikrotikConfig.bridgePorts || []).length > 0) {
      this.print(`/interface bridge port`);
      for (const bp of dev.mikrotikConfig.bridgePorts) {
        this.print(`add bridge=${bp.bridge} interface=${bp.interface}`);
      }
    }
    this.print(`/ip pool`);
    for (const pool of (dev.mikrotikConfig.pools || [])) {
      this.print(`add name=${pool.name} ranges=${pool.ranges}`);
    }
    this.print(`/ip dhcp-server`);
    for (const s of (dev.mikrotikConfig.dhcpServers || [])) {
      this.print(`add address-pool=${s.pool} interface=${s.interface} name=${s.name} disabled=${s.disabled ? 'yes' : 'no'}`);
    }
    this.print(`/ip dhcp-server network`);
    for (const n of (dev.mikrotikConfig.dhcpNetworks || [])) {
      this.print(`add address=${n.address} dns-server=${n.dns || ''} gateway=${n.gateway || ''}`);
    }
    this.print(`/ip address`);
    for (const [p, intf] of Object.entries(dev.interfaces)) {
      if (intf.ip && intf.mask) {
        const cidr = this.maskToCIDR(intf.mask);
        this.print(`add address=${intf.ip}/${cidr} interface=${p} network=${this.calcNetwork(intf.ip, intf.mask)}`);
      }
    }
    this.print(`/ip dns`);
    this.print(`set allow-remote-requests=${dev.mikrotikConfig.dns?.allowRemoteRequests ? 'yes' : 'no'} servers=${(dev.mikrotikConfig.dns?.servers || []).join(',')}`);
    this.print(`/ip route`);
    for (const r of dev.staticRoutes) {
      this.print(`add dst-address=${r.network}/${this.maskToCIDR(r.mask)} gateway=${r.nextHop}`);
    }
    this.print(`/ip firewall nat`);
    for (const n of (dev.mikrotikConfig.firewall?.nat || [])) {
      this.print(`add action=${n.action} chain=${n.chain} out-interface=${n.outInterface || ''} comment="${n.comment || ''}"`);
    }
    this.print(`/system identity`);
    this.print(`set name=${dev.mikrotikConfig.identity}`);
    this.print("");
  }

  // --- /SYSTEM ---
  handleSystem(tokens) {
    const dev = this.device;
    if (tokens.length === 0) {
      this.print("syntax error: specify system sub-menu (identity, resource, routerboard, clock, reboot, reset-configuration)");
      return;
    }
    const sub = tokens[0].toLowerCase();

    // /system identity
    if (sub === 'identity' || sub === 'id') {
      const act = tokens[1] ? tokens[1].toLowerCase() : 'print';
      if (act.startsWith('pr')) {
        this.print(`       name: ${dev.mikrotikConfig.identity}`);
        return;
      }
      if (act === 'set') {
        const nameArg = tokens.slice(2).join(' ');
        const m = nameArg.match(/name=(.+)/i);
        if (m) {
          const newName = m[1].replace(/['"]/g, '').trim();
          dev.mikrotikConfig.identity = newName;
          dev.hostname = newName;
          dev.displayName = newName;
          this.refreshPrompt();
          if (this.triggerScoreUpdate) this.triggerScoreUpdate();
          return;
        }
      }
      this.print("usage: /system identity set name=<name> or /system identity print");
      return;
    }

    // /system resource print
    if (sub === 'resource' || sub === 'res') {
      this.print("                   uptime: 4d 18h 42m 10s");
      this.print("                  version: 7.14.1 (stable)");
      this.print("               build-time: Oct/24/2023 11:42:15");
      this.print("              free-memory: 52.4MiB");
      this.print("             total-memory: 64.0MiB");
      this.print("                      cpu: MIPS 24Kc V7.4");
      this.print("                cpu-count: 1");
      this.print("            cpu-frequency: 850MHz");
      this.print("                 cpu-load: 4%");
      this.print("           free-hdd-space: 14.1MiB");
      this.print("          total-hdd-space: 16.0MiB");
      this.print("  write-sect-since-reboot: 312");
      this.print("         write-sect-total: 21845");
      this.print("               bad-blocks: 0%");
      this.print("        architecture-name: mipsbe");
      this.print("               board-name: RB750r2");
      this.print("                 platform: MikroTik");
      return;
    }

    // /system routerboard print
    if (sub === 'routerboard' || sub === 'rb') {
      this.print("       routerboard: yes");
      this.print("             model: RB750r2 (hEX lite)");
      this.print("     serial-number: H4PXL750001");
      this.print("     firmware-type: qca9531L");
      this.print("  factory-firmware: 3.33");
      this.print("  current-firmware: 7.12");
      this.print("  upgrade-firmware: 7.12");
      return;
    }

    // /system clock print
    if (sub === 'clock') {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toLowerCase();
      this.print(`                  time: ${timeStr}`);
      this.print(`                  date: ${dateStr}`);
      this.print(`  time-zone-autodetect: yes`);
      this.print(`        time-zone-name: Europe/Brussels`);
      this.print(`            gmt-offset: +01:00`);
      this.print(`               dst-active: no`);
      return;
    }

    // /system reboot
    if (sub === 'reboot') {
      this.print("Rebooting device...");
      setTimeout(() => {
        this.print("RouterOS 7.12 (RB750r2)\nMikroTik RouterOS Login: admin\n");
        this.refreshPrompt();
      }, 500);
      return;
    }

    // /system reset-configuration
    if (sub === 'reset-configuration' || sub === 'reset') {
      this.print("Resetting configuration to factory defaults (192.168.88.1/24 on ether2-5 bridge)...");
      dev.interfaces['ether1'].ip = "";
      dev.interfaces['ether1'].mask = "";
      dev.interfaces['ether2'].ip = "192.168.88.1";
      dev.interfaces['ether2'].mask = "255.255.255.0";
      dev.staticRoutes = [];
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }

    this.print(`unknown system command '${sub}'`);
  }

  // --- /INTERFACE ---
  handleInterface(tokens) {
    const dev = this.device;
    if (tokens.length === 0 || tokens[0].toLowerCase().startsWith('pr')) {
      this.print("Flags: D - DYNAMIC; R - RUNNING; S - SLAVE; X - DISABLED");
      this.print("Columns: NAME, TYPE, ACTUAL-MTU, MAC-ADDRESS");
      this.print("#     NAME    TYPE   ACTUAL-MTU  MAC-ADDRESS");
      let idx = 0;
      for (const [pName, intf] of Object.entries(dev.interfaces)) {
        let flag = "R";
        if (intf.shutdown) flag = "X";
        const isSlave = (dev.mikrotikConfig.bridgePorts || []).some(bp => bp.interface === pName);
        if (isSlave) flag = flag === "X" ? "XS" : "RS";
        const mac = intf.mac || `48:8F:5A:12:34:0${idx + 1}`;
        this.print(`${idx.toString().padStart(2, ' ')}  ${flag.padEnd(2, ' ')}  ${pName.padEnd(8, ' ')} ether        1500  ${mac}`);
        idx++;
      }
      for (const b of (dev.mikrotikConfig.bridges || [])) {
        this.print(`${idx.toString().padStart(2, ' ')}  R   ${b.name.padEnd(8, ' ')} bridge       1500  48:8F:5A:12:34:00`);
        idx++;
      }
      this.print("");
      return;
    }

    const sub = tokens[0].toLowerCase();

    // /interface ethernet
    if (sub === 'ethernet') {
      this.handleInterface(tokens.slice(1));
      return;
    }

    // /interface bridge
    if (sub === 'bridge') {
      this.handleBridge(tokens.slice(1));
      return;
    }

    // /interface set <target> disabled=yes/no
    if (sub === 'set' || sub === 'enable' || sub === 'disable') {
      let targetName = tokens[1];
      let disabled = sub === 'disable';
      const rest = tokens.slice(2).join(' ');

      if (sub === 'enable') disabled = false;
      const disMatch = rest.match(/disabled=(yes|no)/i);
      if (disMatch) disabled = disMatch[1].toLowerCase() === 'yes';

      const findMatch = line => line.match(/find default-name=([a-zA-Z0-9_-]+)/i) || line.match(/name=([a-zA-Z0-9_-]+)/i);
      if (tokens.join(' ').includes('find')) {
        const fm = findMatch(tokens.join(' '));
        if (fm) targetName = fm[1];
      }

      if (dev.interfaces[targetName]) {
        dev.interfaces[targetName].shutdown = disabled;
        this.print(`interface '${targetName}' ${disabled ? 'disabled' : 'enabled'}`);
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }
      this.print(`failure: interface '${targetName}' not found`);
      return;
    }

    this.print(`bad command name '${tokens[0]}' in /interface`);
  }

  // --- /INTERFACE BRIDGE ---
  handleBridge(tokens) {
    const dev = this.device;
    if (!dev.mikrotikConfig.bridges) dev.mikrotikConfig.bridges = [];
    if (!dev.mikrotikConfig.bridgePorts) dev.mikrotikConfig.bridgePorts = [];

    if (tokens.length === 0 || tokens[0].toLowerCase().startsWith('pr')) {
      this.print("Flags: D - DYNAMIC; R - RUNNING");
      this.print("Columns: NAME, MTU, MAC-ADDRESS");
      this.print("#   NAME     MTU  MAC-ADDRESS");
      dev.mikrotikConfig.bridges.forEach((b, i) => {
        this.print(`${i.toString().padStart(2, ' ')} R ${b.name.padEnd(8, ' ')} 1500 48:8F:5A:12:34:00`);
      });
      if (dev.mikrotikConfig.bridges.length === 0) {
        this.print("  (no bridges configured)");
      }
      this.print("");
      return;
    }

    const act = tokens[0].toLowerCase();

    // /interface bridge add name=bridge1
    if (act === 'add') {
      const rest = tokens.slice(1).join(' ');
      const nameMatch = rest.match(/name=([a-zA-Z0-9_-]+)/i);
      const bridgeName = nameMatch ? nameMatch[1] : `bridge${dev.mikrotikConfig.bridges.length + 1}`;
      dev.mikrotikConfig.bridges.push({ name: bridgeName });
      this.print(`bridge '${bridgeName}' created`);
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }

    // /interface bridge port
    if (act === 'port') {
      const pTokens = tokens.slice(1);
      const pAct = pTokens[0] ? pTokens[0].toLowerCase() : 'print';
      if (pAct.startsWith('pr')) {
        this.print("Flags: I - INACTIVE; D - DYNAMIC; H - HW-OFFLOAD");
        this.print("Columns: INTERFACE, BRIDGE, HW, PVID, PRIORITY");
        this.print("#   INTERFACE  BRIDGE   HW   PVID  PRIORITY");
        dev.mikrotikConfig.bridgePorts.forEach((bp, i) => {
          this.print(`${i.toString().padStart(2, ' ')} H ${bp.interface.padEnd(10, ' ')} ${bp.bridge.padEnd(8, ' ')} yes     1  0x80`);
        });
        if (dev.mikrotikConfig.bridgePorts.length === 0) {
          this.print("  (no bridge ports configured)");
        }
        this.print("");
        return;
      }
      if (pAct === 'add') {
        const rest = pTokens.slice(1).join(' ');
        const brM = rest.match(/bridge=([a-zA-Z0-9_-]+)/i);
        const intfM = rest.match(/interface=([a-zA-Z0-9_-]+)/i);
        if (!brM || !intfM) {
          this.print("failure: syntax is '/interface bridge port add bridge=bridge1 interface=ether2'");
          return;
        }
        dev.mikrotikConfig.bridgePorts.push({ bridge: brM[1], interface: intfM[1] });
        this.print(`port '${intfM[1]}' added to bridge '${brM[1]}'`);
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }
    }

    this.print(`unknown bridge command '${act}'`);
  }

  // --- /IP ---
  handleIp(tokens) {
    const dev = this.device;
    if (tokens.length === 0) {
      this.print("syntax error: specify ip sub-menu (address, route, pool, dhcp-server, dhcp-client, dns, firewall, service)");
      return;
    }

    const sub = tokens[0].toLowerCase();

    // /ip address
    if (sub === 'address' || sub === 'addr') {
      this.handleIpAddress(tokens.slice(1));
      return;
    }

    // /ip route
    if (sub === 'route' || sub === 'ro') {
      this.handleIpRoute(tokens.slice(1));
      return;
    }

    // /ip pool
    if (sub === 'pool') {
      this.handleIpPool(tokens.slice(1));
      return;
    }

    // /ip dhcp-server
    if (sub === 'dhcp-server') {
      this.handleIpDhcpServer(tokens.slice(1));
      return;
    }

    // /ip dhcp-client
    if (sub === 'dhcp-client') {
      this.handleIpDhcpClient(tokens.slice(1));
      return;
    }

    // /ip dns
    if (sub === 'dns') {
      this.handleIpDns(tokens.slice(1));
      return;
    }

    // /ip firewall
    if (sub === 'firewall') {
      this.handleIpFirewall(tokens.slice(1));
      return;
    }

    // /ip service
    if (sub === 'service') {
      this.handleIpService(tokens.slice(1));
      return;
    }

    this.print(`bad command name '${sub}' in /ip`);
  }

  // --- /IP ADDRESS ---
  handleIpAddress(tokens) {
    const dev = this.device;
    const act = tokens[0] ? tokens[0].toLowerCase() : 'print';

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
      const rest = tokens.slice(1).join(' ');
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
        this.print(`failure: interface '${targetIntf}' does not exist on this device`);
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
      const target = tokens[1];
      if (dev.interfaces[target]) {
        dev.interfaces[target].ip = "";
        dev.interfaces[target].mask = "";
        this.print(`removed address from ${target}`);
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }
      // Check numeric index
      const numIdx = parseInt(target, 10);
      if (!isNaN(numIdx)) {
        const intfEntries = Object.entries(dev.interfaces).filter(([_, i]) => i.ip && i.mask);
        if (intfEntries[numIdx]) {
          intfEntries[numIdx][1].ip = "";
          intfEntries[numIdx][1].mask = "";
          this.print(`removed address item ${numIdx}`);
          if (this.triggerScoreUpdate) this.triggerScoreUpdate();
          return;
        }
      }
      this.print("usage: /ip address remove <index|interface-name>");
      return;
    }

    this.print(`unknown /ip address command '${act}'`);
  }

  // --- /IP ROUTE ---
  handleIpRoute(tokens) {
    const dev = this.device;
    const act = tokens[0] ? tokens[0].toLowerCase() : 'print';

    if (act.startsWith('pr')) {
      this.print("Flags: D - DYNAMIC; A - ACTIVE; c - CONNECT, s - STATIC");
      this.print("Columns: DST-ADDRESS, GATEWAY, DISTANCE");
      this.print("#     DST-ADDRESS        GATEWAY         DISTANCE");
      let idx = 0;
      for (const r of dev.staticRoutes) {
        const cidr = this.maskToCIDR(r.mask);
        const dst = `${r.network}/${cidr}`;
        this.print(`${idx.toString().padStart(2, ' ')}  As ${dst.padEnd(18, ' ')} ${r.nextHop.padEnd(15, ' ')} ${r.distance || 1}`);
        idx++;
      }
      // Connected routes
      for (const [pName, intf] of Object.entries(dev.interfaces)) {
        if (intf.ip && intf.mask && !intf.shutdown) {
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
      const rest = tokens.slice(1).join(' ');
      const gwMatch = rest.match(/gateway=([0-9\.]+)/i);
      const dstMatch = rest.match(/dst-address=([0-9\.\/]+)/i);
      const distMatch = rest.match(/distance=([0-9]+)/i);

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

      dev.staticRoutes.push({
        network,
        mask,
        nextHop: gateway,
        distance: distMatch ? parseInt(distMatch[1], 10) : 1
      });
      this.print("");
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }

    if (act === 'remove' || act === 'rem') {
      const idx = parseInt(tokens[1], 10);
      if (!isNaN(idx) && dev.staticRoutes[idx]) {
        dev.staticRoutes.splice(idx, 1);
        this.print(`route ${idx} removed`);
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }
      this.print("usage: /ip route remove <number>");
      return;
    }

    this.print(`unknown /ip route command '${act}'`);
  }

  // --- /IP POOL ---
  handleIpPool(tokens) {
    const dev = this.device;
    if (!dev.mikrotikConfig.pools) dev.mikrotikConfig.pools = [];
    const act = tokens[0] ? tokens[0].toLowerCase() : 'print';

    if (act.startsWith('pr')) {
      this.print("Columns: NAME, RANGES");
      this.print("#   NAME       RANGES");
      dev.mikrotikConfig.pools.forEach((p, i) => {
        this.print(`${i.toString().padStart(2, ' ')}  ${p.name.padEnd(10, ' ')} ${p.ranges}`);
      });
      this.print("");
      return;
    }

    if (act === 'add') {
      const rest = tokens.slice(1).join(' ');
      const nameM = rest.match(/name=([a-zA-Z0-9_-]+)/i);
      const rangeM = rest.match(/ranges=([0-9\.\-]+)/i);
      if (!nameM || !rangeM) {
        this.print("failure: syntax is '/ip pool add name=dhcp-pool ranges=192.168.88.10-192.168.88.50'");
        return;
      }
      dev.mikrotikConfig.pools.push({ name: nameM[1], ranges: rangeM[1] });
      this.print(`ip pool '${nameM[1]}' added`);
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }
  }

  // --- /IP DHCP-SERVER ---
  handleIpDhcpServer(tokens) {
    const dev = this.device;
    if (!dev.mikrotikConfig.dhcpServers) dev.mikrotikConfig.dhcpServers = [];
    if (!dev.mikrotikConfig.dhcpNetworks) dev.mikrotikConfig.dhcpNetworks = [];
    const act = tokens[0] ? tokens[0].toLowerCase() : 'print';

    if (act === 'network') {
      const nTokens = tokens.slice(1);
      const nAct = nTokens[0] ? nTokens[0].toLowerCase() : 'print';
      if (nAct.startsWith('pr')) {
        this.print("Columns: ADDRESS, GATEWAY, DNS-SERVER");
        this.print("#   ADDRESS            GATEWAY          DNS-SERVER");
        dev.mikrotikConfig.dhcpNetworks.forEach((n, i) => {
          this.print(`${i.toString().padStart(2, ' ')}  ${n.address.padEnd(18, ' ')} ${(n.gateway || '').padEnd(16, ' ')} ${n.dns || ''}`);
        });
        this.print("");
        return;
      }
      if (nAct === 'add') {
        const rest = nTokens.slice(1).join(' ');
        const addrM = rest.match(/address=([0-9\.\/]+)/i);
        const gwM = rest.match(/gateway=([0-9\.]+)/i);
        const dnsM = rest.match(/dns-server=([0-9\.,]+)/i);
        if (!addrM) {
          this.print("failure: syntax is '/ip dhcp-server network add address=192.168.88.0/24 [gateway=192.168.88.1]'");
          return;
        }
        dev.mikrotikConfig.dhcpNetworks.push({
          address: addrM[1],
          gateway: gwM ? gwM[1] : '',
          dns: dnsM ? dnsM[1] : ''
        });
        this.print(`dhcp network '${addrM[1]}' added`);
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }
      return;
    }

    if (act === 'lease' || act === 'leases') {
      this.print("Flags: R - RADIUS, D - DYNAMIC, B - BLOCK");
      this.print("Columns: ADDRESS, MAC-ADDRESS, HOST-NAME, SERVER, STATUS");
      this.print("#   ADDRESS        MAC-ADDRESS        HOST-NAME   SERVER  STATUS");
      this.print(" 0  D 192.168.88.10  00:50:79:66:68:01  PC1         dhcp1   bound");
      this.print("");
      return;
    }

    if (act.startsWith('pr')) {
      this.print("Flags: D - DYNAMIC; X - DISABLED, I - INVALID");
      this.print("Columns: NAME, INTERFACE, ADDRESS-POOL, LEASE-TIME");
      this.print("#   NAME   INTERFACE  ADDRESS-POOL  LEASE-TIME");
      dev.mikrotikConfig.dhcpServers.forEach((s, i) => {
        const flag = s.disabled ? "X" : " ";
        this.print(`${i.toString().padStart(2, ' ')} ${flag} ${s.name.padEnd(6, ' ')} ${s.interface.padEnd(10, ' ')} ${(s.pool || '').padEnd(13, ' ')} 10m`);
      });
      this.print("");
      return;
    }

    if (act === 'add') {
      const rest = tokens.slice(1).join(' ');
      const nameM = rest.match(/name=([a-zA-Z0-9_-]+)/i);
      const intfM = rest.match(/interface=([a-zA-Z0-9_-]+)/i);
      const poolM = rest.match(/address-pool=([a-zA-Z0-9_-]+)/i);
      dev.mikrotikConfig.dhcpServers.push({
        name: nameM ? nameM[1] : 'dhcp1',
        interface: intfM ? intfM[1] : 'ether2',
        pool: poolM ? poolM[1] : 'dhcp-pool',
        disabled: false
      });
      this.print(`dhcp server added`);
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }
  }

  // --- /IP DHCP-CLIENT ---
  handleIpDhcpClient(tokens) {
    const dev = this.device;
    if (!dev.mikrotikConfig.dhcpClients) dev.mikrotikConfig.dhcpClients = [];
    const act = tokens[0] ? tokens[0].toLowerCase() : 'print';

    if (act.startsWith('pr')) {
      this.print("Flags: D - DYNAMIC; X - DISABLED, I - INVALID");
      this.print("Columns: INTERFACE, USE-PEER-DNS, ADD-DEFAULT-ROUTE, STATUS, ADDRESS");
      this.print("#   INTERFACE  USE-PEER-DNS  ADD-DEFAULT-ROUTE  STATUS  ADDRESS");
      dev.mikrotikConfig.dhcpClients.forEach((c, i) => {
        const flag = c.disabled ? "X" : " ";
        this.print(`${i.toString().padStart(2, ' ')} ${flag} ${c.interface.padEnd(10, ' ')} yes           yes                bound   ${c.address || '192.168.1.150/24'}`);
      });
      this.print("");
      return;
    }

    if (act === 'add') {
      const rest = tokens.slice(1).join(' ');
      const intfM = rest.match(/interface=([a-zA-Z0-9_-]+)/i);
      if (!intfM) {
        this.print("failure: syntax is '/ip dhcp-client add interface=ether1 disabled=no'");
        return;
      }
      dev.mikrotikConfig.dhcpClients.push({
        interface: intfM[1],
        disabled: false,
        status: 'bound',
        address: '192.168.1.150/24'
      });
      this.print(`dhcp client enabled on '${intfM[1]}'`);
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }
  }

  // --- /IP DNS ---
  handleIpDns(tokens) {
    const dev = this.device;
    if (!dev.mikrotikConfig.dns) dev.mikrotikConfig.dns = { servers: ['8.8.8.8'], allowRemoteRequests: true, static: [] };
    const act = tokens[0] ? tokens[0].toLowerCase() : 'print';

    if (act === 'static') {
      const sTokens = tokens.slice(1);
      const sAct = sTokens[0] ? sTokens[0].toLowerCase() : 'print';
      if (sAct.startsWith('pr')) {
        this.print("Columns: NAME, ADDRESS, TTL");
        this.print("#   NAME               ADDRESS          TTL");
        (dev.mikrotikConfig.dns.static || []).forEach((r, i) => {
          this.print(`${i.toString().padStart(2, ' ')}  ${r.name.padEnd(18, ' ')} ${r.address.padEnd(16, ' ')} 1d`);
        });
        this.print("");
        return;
      }
      if (sAct === 'add') {
        const rest = sTokens.slice(1).join(' ');
        const nameM = rest.match(/name=([a-zA-Z0-9\._-]+)/i);
        const addrM = rest.match(/address=([0-9\.]+)/i);
        if (nameM && addrM) {
          dev.mikrotikConfig.dns.static.push({ name: nameM[1], address: addrM[1] });
          this.print(`static dns entry '${nameM[1]}' added`);
          if (this.triggerScoreUpdate) this.triggerScoreUpdate();
          return;
        }
      }
      return;
    }

    if (act.startsWith('pr')) {
      const srvs = (dev.mikrotikConfig.dns.servers || []).join(',');
      this.print(`                servers: ${srvs || 'none'}`);
      this.print(`          dynamic-servers: 8.8.8.8,1.1.1.1`);
      this.print(`    allow-remote-requests: ${dev.mikrotikConfig.dns.allowRemoteRequests ? 'yes' : 'no'}`);
      this.print(`               cache-size: 2048KiB`);
      this.print(`            cache-max-ttl: 1w`);
      this.print(`               cache-used: 28KiB`);
      return;
    }

    if (act === 'set') {
      const rest = tokens.slice(1).join(' ');
      const srvMatch = rest.match(/servers=([0-9\.,]+)/i);
      const remMatch = rest.match(/allow-remote-requests=(yes|no)/i);
      if (srvMatch) {
        dev.mikrotikConfig.dns.servers = srvMatch[1].split(',').map(s => s.trim());
      }
      if (remMatch) {
        dev.mikrotikConfig.dns.allowRemoteRequests = remMatch[1].toLowerCase() === 'yes';
      }
      this.print("dns settings updated");
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }
  }

  // --- /IP FIREWALL ---
  handleIpFirewall(tokens) {
    const dev = this.device;
    if (!dev.mikrotikConfig.firewall) dev.mikrotikConfig.firewall = { filter: [], nat: [] };
    const sub = tokens[0] ? tokens[0].toLowerCase() : 'filter';

    if (sub === 'nat') {
      const nTokens = tokens.slice(1);
      const nAct = nTokens[0] ? nTokens[0].toLowerCase() : 'print';
      if (nAct.startsWith('pr')) {
        this.print("Flags: X - DISABLED, I - INVALID, D - DYNAMIC");
        this.print("Columns: ACTION, CHAIN, OUT-INTERFACE");
        this.print("#   ACTION      CHAIN   OUT-INTERFACE");
        (dev.mikrotikConfig.firewall.nat || []).forEach((n, i) => {
          this.print(`${i.toString().padStart(2, ' ')}  ${n.action.padEnd(11, ' ')} ${n.chain.padEnd(7, ' ')} ${n.outInterface || 'all'}`);
        });
        this.print("");
        return;
      }
      if (nAct === 'add') {
        const rest = nTokens.slice(1).join(' ');
        const actM = rest.match(/action=([a-zA-Z0-9_-]+)/i);
        const chainM = rest.match(/chain=([a-zA-Z0-9_-]+)/i);
        const outM = rest.match(/out-interface=([a-zA-Z0-9_-]+)/i);
        dev.mikrotikConfig.firewall.nat.push({
          action: actM ? actM[1] : 'masquerade',
          chain: chainM ? chainM[1] : 'srcnat',
          outInterface: outM ? outM[1] : 'ether1'
        });
        this.print("nat rule added");
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }
      return;
    }

    if (sub === 'filter') {
      const fTokens = tokens.slice(1);
      const fAct = fTokens[0] ? fTokens[0].toLowerCase() : 'print';
      if (fAct.startsWith('pr')) {
        this.print("Flags: X - DISABLED, I - INVALID, D - DYNAMIC");
        this.print("Columns: ACTION, CHAIN, PROTOCOL");
        this.print("#   ACTION   CHAIN    PROTOCOL");
        (dev.mikrotikConfig.firewall.filter || []).forEach((f, i) => {
          this.print(`${i.toString().padStart(2, ' ')}  ${f.action.padEnd(8, ' ')} ${f.chain.padEnd(8, ' ')} ${f.protocol || 'any'}`);
        });
        this.print("");
        return;
      }
      if (fAct === 'add') {
        const rest = fTokens.slice(1).join(' ');
        const actM = rest.match(/action=([a-zA-Z0-9_-]+)/i);
        const chainM = rest.match(/chain=([a-zA-Z0-9_-]+)/i);
        const protoM = rest.match(/protocol=([a-zA-Z0-9_-]+)/i);
        dev.mikrotikConfig.firewall.filter.push({
          action: actM ? actM[1] : 'accept',
          chain: chainM ? chainM[1] : 'input',
          protocol: protoM ? protoM[1] : 'any'
        });
        this.print("firewall rule added");
        if (this.triggerScoreUpdate) this.triggerScoreUpdate();
        return;
      }
      return;
    }
  }

  // --- /IP SERVICE ---
  handleIpService(tokens) {
    const dev = this.device;
    const act = tokens[0] ? tokens[0].toLowerCase() : 'print';
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

    if (act === 'enable' || act === 'disable') {
      const sName = tokens[1]?.toLowerCase();
      if (dev.mikrotikConfig.services[sName]) {
        dev.mikrotikConfig.services[sName].enabled = act === 'enable';
        this.print(`service '${sName}' ${act === 'enable' ? 'enabled' : 'disabled'}`);
        return;
      }
    }

    if (act === 'set') {
      const rest = tokens.slice(1).join(' ');
      const sName = tokens[1]?.toLowerCase();
      const disMatch = rest.match(/disabled=(yes|no)/i);
      if (dev.mikrotikConfig.services[sName] && disMatch) {
        dev.mikrotikConfig.services[sName].enabled = (disMatch[1].toLowerCase() === 'no');
        this.print(`service '${sName}' set disabled=${disMatch[1]}`);
        return;
      }
    }
  }

  // --- /USER ---
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

  // --- /TOOL ---
  handleTool(tokens) {
    if (tokens.length === 0) {
      this.print("syntax error: specify tool (ping, traceroute, bandwidth-test)");
      return;
    }
    const sub = tokens[0].toLowerCase();
    if (sub === 'ping') {
      this.handlePing(tokens.slice(1));
      return;
    }
    if (sub === 'traceroute' || sub === 'tracert') {
      this.handleTraceroute(tokens.slice(1));
      return;
    }
    if (sub === 'bandwidth-test' || sub === 'btest') {
      const target = tokens[1] || '192.168.88.1';
      this.print(`Connecting to ${target}...`);
      this.print(`  status: running`);
      this.print(`  duration: 5s`);
      this.print(`  tx-current: 94.2Mbps  rx-current: 93.8Mbps`);
      this.print(`  lost-packets: 0  random-data: yes`);
      return;
    }
    this.print(`unknown tool '${sub}'`);
  }

  // --- /PING ---
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

  // --- /TRACEROUTE ---
  handleTraceroute(args) {
    if (args.length === 0) {
      this.print("failure: specify destination address (e.g. /tool traceroute 8.8.8.8)");
      return;
    }
    const target = args[0];
    this.print(`Columns: ADDRESS, LOSS, SENT, LAST, AVG, BEST, WORST, STD-DEV`);
    this.print(`#  ADDRESS          LOSS  SENT  LAST  AVG  BEST  WORST  STD-DEV`);
    const sim = window.PXLNetworkSim;
    if (sim) {
      const routeRes = sim.routePacket(this.device.id, target);
      if (routeRes.success && routeRes.path && routeRes.path.length > 0) {
        routeRes.path.forEach((hop, i) => {
          const hopDev = sim.devices[hop];
          const hopIp = hopDev ? (hopDev.ip || Object.values(hopDev.interfaces).find(intf => intf.ip)?.ip || target) : target;
          const ms = (i + 1) * 3 + Math.floor(Math.random() * 2);
          this.print(`${(i + 1).toString().padStart(2, ' ')}  ${hopIp.padEnd(15, ' ')}    0%     4   ${ms}ms  ${ms}ms   ${ms}ms    ${ms + 1}ms      0.5`);
        });
      } else {
        this.print(` 1  ${target.padEnd(15, ' ')}  100%     4  timeout`);
      }
    }
    this.print("");
  }

  // --- /FILE ---
  handleFile(tokens) {
    this.print("# NAME              TYPE        SIZE CREATION-TIME");
    this.print("0 auto-backup.backup backup    42.1KiB nov/14/2026 10:00:00");
    this.print("1 default-config.rsc script      3.4KiB oct/24/2023 11:42:15");
    this.print("");
  }

  printRouterOSHelp() {
    this.print("MikroTik RouterOS 7.12 Command Reference:");
    this.print("  /                             Return to root menu");
    this.print("  ..                            Move up one menu level");
    this.print("  /export [compact]             Export complete configuration script");
    this.print("  /interface print              List network interfaces & link status");
    this.print("  /interface bridge [add|port]  Configure Layer 2 Bridge & switch ports");
    this.print("  /ip address [print|add|rem]   Configure IPv4 addresses on interfaces");
    this.print("  /ip route [print|add|rem]     Manage static routing table & default gateway");
    this.print("  /ip pool [print|add]          Configure IP address pools for DHCP");
    this.print("  /ip dhcp-server [print|add]   Configure DHCP server and networks");
    this.print("  /ip dhcp-client [print|add]   Manage DHCP client on WAN port");
    this.print("  /ip dns [print|set|static]    Configure upstream DNS servers & static hosts");
    this.print("  /ip firewall [filter|nat]     Configure firewall packet filter & NAT rules");
    this.print("  /system resource print        View CPU load, RAM usage, and uptime");
    this.print("  /system routerboard print     Hardware and firmware information");
    this.print("  /system identity [print|set]  Change hostname / identity");
    this.print("  /system clock print           View date, time, and timezone");
    this.print("  /ping <target-ip>             Send ICMP echo requests");
    this.print("  /tool traceroute <target-ip>  Trace network path to destination");
    this.print("");
  }

  // --- Tab Completion ---
  tabComplete(inputLine) {
    const trimmed = inputLine.trim();
    const suggestions = [
      '/export', '/export compact',
      '/interface print', '/interface ethernet print',
      '/interface bridge print', '/interface bridge add name=', '/interface bridge port print',
      '/ip address print', '/ip address add address=',
      '/ip route print', '/ip route add gateway=', '/ip route add dst-address=',
      '/ip pool print', '/ip pool add name=',
      '/ip dhcp-server print', '/ip dhcp-server network print', '/ip dhcp-server lease print',
      '/ip dhcp-client print', '/ip dhcp-client add interface=',
      '/ip dns print', '/ip dns set servers=', '/ip dns static print',
      '/ip firewall filter print', '/ip firewall nat print',
      '/system resource print', '/system routerboard print', '/system clock print',
      '/system identity print', '/system identity set name=',
      '/ping ', '/tool traceroute ', '/tool bandwidth-test '
    ];

    const match = suggestions.find(s => s.startsWith(trimmed));
    if (match) return match + (match.endsWith('=') || match.endsWith(' ') ? '' : ' ');

    // Inside sub-menu
    if (this.contextPath) {
      const subSuggestions = ['print', 'add', 'set', 'remove', 'enable', 'disable'];
      const subMatch = subSuggestions.find(s => s.startsWith(trimmed));
      if (subMatch) return subMatch + ' ';
    }
    return inputLine;
  }

  // --- Subnet Math Helpers ---
  maskToCIDR(mask) {
    if (!mask) return 24;
    return mask.split('.').reduce((c, o) => c + (parseInt(o, 10).toString(2).match(/1/g) || []).length, 0);
  }

  cidrToMask(cidr) {
    const mask = [];
    for (let i = 0; i < 4; i++) {
      const n = Math.min(cidr, 8);
      mask.push(256 - Math.pow(2, 8 - n));
      cidr -= n;
    }
    return mask.join('.');
  }

  calcNetwork(ip, mask) {
    if (!ip || !mask) return "0.0.0.0";
    const ipP = ip.split('.').map(Number);
    const maskP = mask.split('.').map(Number);
    return ipP.map((b, i) => b & maskP[i]).join('.');
  }
}

if (typeof window !== 'undefined') {
  window.MikroTikCLIParser = MikroTikCLIParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MikroTikCLIParser };
}
