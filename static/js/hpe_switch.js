/**
 * hpe_switch.js - HPE ArubaOS-S / Provision Switch Simulator & Web Management GUI
 * Models: HPE Aruba 2530-24G (J9776A) and HPE Aruba 2930F-24G-4SFP+ (JL258A)
 * Provides authentic ArubaOS-S CLI parser and HPE Web Management GUI
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class HpeCLIParser {
  constructor(device, printCallback, updatePromptCallback, triggerScoreUpdate) {
    this.device = device;
    this.print = printCallback || console.log;
    this.updatePrompt = updatePromptCallback || (() => {});
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});
    this.initDeviceDefaults();
  }

  initDeviceDefaults() {
    const dev = this.device;
    if (!dev.hpeConfig) {
      dev.hpeConfig = {
        model: dev.model || 'Aruba-2530-24G',
        hostname: dev.hostname || (dev.model && dev.model.includes('2930') ? 'Aruba-2930F' : 'Aruba-2530'),
        firmware: 'YA.16.11.0003',
        webManagement: {
          enabled: true,
          port: 80,
          ssl: false
        },
        vlans: {
          1: {
            id: 1,
            name: 'DEFAULT_VLAN',
            ip: '192.168.1.10',
            mask: '255.255.255.0',
            untagged: Array.from({ length: 28 }, (_, i) => String(i + 1)),
            tagged: []
          }
        },
        mgmtIp: '192.168.1.10',
        mgmtMask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        portConfigs: {}
      };
    }
    if (!dev.mode) dev.mode = 'USER_EXEC';
  }

  getPrompt() {
    const dev = this.device;
    const name = dev.hostname || 'Aruba-2530';
    if (!dev.powerOn) return '[Device is Powered Off]';

    switch (dev.mode) {
      case 'USER_EXEC':
        return `${name}> `;
      case 'PRIV_EXEC':
        return `${name}# `;
      case 'CONFIG':
        return `${name}(config)# `;
      case 'CONFIG_VLAN':
        return `${name}(vlan-${dev.currentVlan || '1'})# `;
      case 'CONFIG_IF':
        return `${name}(eth-${dev.currentInterface || '1'})# `;
      default:
        return `${name}# `;
    }
  }

  handleCommand(rawLine) {
    const dev = this.device;
    if (!dev.powerOn) {
      this.print("% Switch is powered off. Turn power ON in Physical tab.");
      return;
    }

    const line = rawLine.trim();
    if (!line) {
      this.print("");
      this.updatePrompt(this.getPrompt());
      return;
    }

    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    const tokens = line.split(/\s+/);
    const cmd = tokens[0].toLowerCase();

    // Global navigation commands
    if (cmd === 'exit' || cmd === 'quit') {
      this.handleExit();
      this.updatePrompt(this.getPrompt());
      return;
    }
    if (cmd === 'end') {
      dev.mode = 'PRIV_EXEC';
      dev.currentVlan = null;
      dev.currentInterface = null;
      this.updatePrompt(this.getPrompt());
      return;
    }

    // Contextual handling based on mode
    if (dev.mode === 'USER_EXEC') {
      this.handleUserExec(tokens, line);
    } else if (dev.mode === 'PRIV_EXEC') {
      this.handlePrivExec(tokens, line);
    } else if (dev.mode === 'CONFIG') {
      this.handleConfig(tokens, line);
    } else if (dev.mode === 'CONFIG_VLAN') {
      this.handleConfigVlan(tokens, line);
    } else if (dev.mode === 'CONFIG_IF') {
      this.handleConfigIf(tokens, line);
    }

    this.updatePrompt(this.getPrompt());
    if (this.triggerScoreUpdate) this.triggerScoreUpdate();
  }

  handleExit() {
    const dev = this.device;
    if (dev.mode === 'CONFIG_VLAN' || dev.mode === 'CONFIG_IF') {
      dev.mode = 'CONFIG';
      dev.currentVlan = null;
      dev.currentInterface = null;
    } else if (dev.mode === 'CONFIG') {
      dev.mode = 'PRIV_EXEC';
    } else if (dev.mode === 'PRIV_EXEC') {
      dev.mode = 'USER_EXEC';
    } else {
      this.print("[Connection closed]");
    }
  }

  handleUserExec(tokens, rawLine) {
    const dev = this.device;
    const cmd = tokens[0].toLowerCase();

    if (cmd === 'enable' || cmd === 'en') {
      dev.mode = 'PRIV_EXEC';
      return;
    }
    if (cmd === 'ping') {
      this.handlePing(tokens.slice(1));
      return;
    }
    if (cmd === 'show') {
      this.handleShow(tokens.slice(1));
      return;
    }
    if (cmd === 'help' || cmd === '?') {
      this.printHelp();
      return;
    }
    this.print(`Invalid input: ${tokens[0]}`);
  }

  handlePrivExec(tokens, rawLine) {
    const dev = this.device;
    const cmd = tokens[0].toLowerCase();

    if (cmd === 'configure' || cmd === 'conf') {
      if (tokens[1] && tokens[1].toLowerCase().startsWith('t')) {
        dev.mode = 'CONFIG';
        return;
      }
      this.print("Usage: configure terminal");
      return;
    }
    if (cmd === 'show') {
      this.handleShow(tokens.slice(1));
      return;
    }
    if (cmd === 'write' || cmd === 'wr') {
      if (!tokens[1] || tokens[1].toLowerCase().startsWith('mem')) {
        this.print("Writing configuration... Done.");
        dev.isModified = false;
        return;
      }
    }
    if (cmd === 'ping') {
      this.handlePing(tokens.slice(1));
      return;
    }
    if (cmd === 'disable') {
      dev.mode = 'USER_EXEC';
      return;
    }
    if (cmd === 'help' || cmd === '?') {
      this.printHelp();
      return;
    }
    this.print(`Invalid input: ${tokens[0]}`);
  }

  handleConfig(tokens, rawLine) {
    const dev = this.device;
    const cmd = tokens[0].toLowerCase();

    if (cmd === 'hostname') {
      if (tokens[1]) {
        dev.hostname = tokens[1].replace(/["']/g, '');
        dev.hpeConfig.hostname = dev.hostname;
        this.print("");
        return;
      }
      this.print("Usage: hostname <name>");
      return;
    }

    if (cmd === 'vlan') {
      const vlanId = parseInt(tokens[1], 10);
      if (!isNaN(vlanId) && vlanId >= 1 && vlanId <= 4094) {
        if (!dev.hpeConfig.vlans[vlanId]) {
          dev.hpeConfig.vlans[vlanId] = {
            id: vlanId,
            name: `VLAN${vlanId}`,
            ip: '',
            mask: '',
            untagged: [],
            tagged: []
          };
        }
        dev.currentVlan = vlanId;
        dev.mode = 'CONFIG_VLAN';
        return;
      }
      this.print("Usage: vlan <1-4094>");
      return;
    }

    if (cmd === 'interface' || cmd === 'int') {
      const portSpec = tokens[1];
      if (portSpec) {
        dev.currentInterface = portSpec;
        dev.mode = 'CONFIG_IF';
        return;
      }
      this.print("Usage: interface <1-28>");
      return;
    }

    if (cmd === 'web-management' || cmd === 'web') {
      const sub = (tokens[1] || 'plaintext').toLowerCase();
      if (sub === 'plaintext' || sub === 'ssl') {
        dev.hpeConfig.webManagement.enabled = true;
        dev.hpeConfig.webManagement.ssl = (sub === 'ssl');
        this.print(`HPE Web Management enabled (${sub})`);
        return;
      }
    }

    if (cmd === 'no') {
      if (tokens[1] && tokens[1].toLowerCase().startsWith('web')) {
        dev.hpeConfig.webManagement.enabled = false;
        this.print("HPE Web Management disabled");
        return;
      }
      if (tokens[1] && tokens[1].toLowerCase() === 'vlan') {
        const vid = parseInt(tokens[2], 10);
        if (vid && vid !== 1 && dev.hpeConfig.vlans[vid]) {
          delete dev.hpeConfig.vlans[vid];
          this.print(`VLAN ${vid} removed`);
          return;
        }
      }
    }

    if (cmd === 'ip') {
      if (tokens[1] && tokens[1].toLowerCase().startsWith('def') && tokens[2]) {
        dev.hpeConfig.defaultGateway = tokens[2];
        dev.defaultGateway = tokens[2];
        this.print("");
        return;
      }
      if (tokens[1] && tokens[1].toLowerCase() === 'route' && tokens[2] && tokens[3] && tokens[4]) {
        dev.staticRoutes.push({ network: tokens[2], mask: tokens[3], nextHop: tokens[4] });
        this.print("");
        return;
      }
    }

    if (cmd === 'show') {
      this.handleShow(tokens.slice(1));
      return;
    }

    if (cmd === 'help' || cmd === '?') {
      this.printHelp();
      return;
    }

    this.print(`Invalid input: ${tokens[0]}`);
  }

  handleConfigVlan(tokens, rawLine) {
    const dev = this.device;
    const vlanId = dev.currentVlan;
    const vlan = dev.hpeConfig.vlans[vlanId];
    const cmd = tokens[0].toLowerCase();

    if (cmd === 'name') {
      const vName = rawLine.substring(rawLine.indexOf('name') + 4).trim().replace(/["']/g, '');
      if (vName) {
        vlan.name = vName;
        return;
      }
    }

    if (cmd === 'untagged') {
      const ports = this.parsePortRange(tokens.slice(1).join(' '));
      ports.forEach(p => {
        if (!vlan.untagged.includes(p)) vlan.untagged.push(p);
        vlan.tagged = vlan.tagged.filter(x => x !== p);
      });
      this.print(`Ports ${ports.join(',')} set untagged on VLAN ${vlanId}`);
      return;
    }

    if (cmd === 'tagged') {
      const ports = this.parsePortRange(tokens.slice(1).join(' '));
      ports.forEach(p => {
        if (!vlan.tagged.includes(p)) vlan.tagged.push(p);
        vlan.untagged = vlan.untagged.filter(x => x !== p);
      });
      this.print(`Ports ${ports.join(',')} set tagged (trunk) on VLAN ${vlanId}`);
      return;
    }

    if (cmd === 'ip' && tokens[1] && tokens[1].toLowerCase() === 'address') {
      const ip = tokens[2];
      const mask = tokens[3] || '255.255.255.0';
      if (ip) {
        vlan.ip = ip;
        vlan.mask = mask;
        if (vlanId === 1 || !dev.ip) {
          dev.ip = ip;
          dev.mask = mask;
          dev.hpeConfig.mgmtIp = ip;
          dev.hpeConfig.mgmtMask = mask;
        }
        this.print("");
        return;
      }
    }

    if (cmd === 'no') {
      if (tokens[1] && tokens[1].toLowerCase() === 'untagged') {
        const ports = this.parsePortRange(tokens.slice(2).join(' '));
        vlan.untagged = vlan.untagged.filter(p => !ports.includes(p));
        return;
      }
      if (tokens[1] && tokens[1].toLowerCase() === 'tagged') {
        const ports = this.parsePortRange(tokens.slice(2).join(' '));
        vlan.tagged = vlan.tagged.filter(p => !ports.includes(p));
        return;
      }
    }

    this.print(`Invalid command in VLAN context: ${tokens[0]}`);
  }

  handleConfigIf(tokens, rawLine) {
    const dev = this.device;
    const p = dev.currentInterface;
    const cmd = tokens[0].toLowerCase();

    if (cmd === 'name') {
      const desc = rawLine.substring(rawLine.indexOf('name') + 4).trim().replace(/["']/g, '');
      if (!dev.hpeConfig.portConfigs[p]) dev.hpeConfig.portConfigs[p] = {};
      dev.hpeConfig.portConfigs[p].name = desc;
      return;
    }

    if (cmd === 'disable') {
      const intfKey = `Port ${p}`;
      if (dev.interfaces[intfKey]) dev.interfaces[intfKey].shutdown = true;
      this.print(`Port ${p} disabled`);
      return;
    }

    if (cmd === 'enable') {
      const intfKey = `Port ${p}`;
      if (dev.interfaces[intfKey]) dev.interfaces[intfKey].shutdown = false;
      this.print(`Port ${p} enabled`);
      return;
    }

    if (cmd === 'speed-duplex') {
      const mode = tokens[1] || 'auto';
      if (!dev.hpeConfig.portConfigs[p]) dev.hpeConfig.portConfigs[p] = {};
      dev.hpeConfig.portConfigs[p].speedDuplex = mode;
      return;
    }

    this.print(`Invalid command in interface context: ${tokens[0]}`);
  }

  parsePortRange(str) {
    const parts = str.split(/[,\s]+/);
    const result = [];
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(x => parseInt(x, 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) result.push(String(i));
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num)) result.push(String(num));
      }
    });
    return result;
  }

  handleShow(args) {
    const dev = this.device;
    if (args.length === 0) {
      this.print("Usage: show running-config | vlans | interfaces brief | mac-address | ip");
      return;
    }

    const sub = args[0].toLowerCase();
    if (sub.startsWith('run')) {
      this.showRunningConfig();
      return;
    }
    if (sub.startsWith('vlan')) {
      this.showVlans();
      return;
    }
    if (sub.startsWith('int') || sub.startsWith('interface')) {
      this.showInterfacesBrief();
      return;
    }
    if (sub.startsWith('mac')) {
      this.showMacAddress();
      return;
    }
    if (sub.startsWith('ip')) {
      this.showIp();
      return;
    }

    this.print(`Unknown show command '${sub}'`);
  }

  showRunningConfig() {
    const dev = this.device;
    const cfg = dev.hpeConfig;
    const model = dev.model || 'Aruba-2530-24G';
    const is2930 = model.includes('2930');
    const jNumber = is2930 ? 'JL258A' : 'J9776A';

    this.print(`; ${jNumber} Configuration Editor; Created on release #${cfg.firmware}`);
    this.print(`; Configuration flashes = 1\n`);
    this.print(`hostname "${dev.hostname}"`);
    this.print(`module 1 type ${jNumber.toLowerCase()} mac-id b439d6-000001`);
    this.print(`snmp-server community "public" unrestricted`);

    // VLANs
    for (const [vId, vlan] of Object.entries(cfg.vlans)) {
      this.print(`vlan ${vId}`);
      this.print(`   name "${vlan.name}"`);
      if (vlan.untagged && vlan.untagged.length > 0) {
        this.print(`   untagged ${this.compressPortList(vlan.untagged)}`);
      }
      if (vlan.tagged && vlan.tagged.length > 0) {
        this.print(`   tagged ${this.compressPortList(vlan.tagged)}`);
      }
      if (vlan.ip && vlan.mask) {
        this.print(`   ip address ${vlan.ip} ${vlan.mask}`);
      } else {
        this.print(`   no ip address`);
      }
      this.print(`   exit`);
    }

    // Default Gateway
    if (cfg.defaultGateway) {
      this.print(`ip default-gateway ${cfg.defaultGateway}`);
    }

    // Web Management
    if (cfg.webManagement && cfg.webManagement.enabled) {
      this.print(`web-management ${cfg.webManagement.ssl ? 'ssl' : 'plaintext'}`);
    } else {
      this.print(`no web-management`);
    }

    this.print(`password manager\n`);
  }

  compressPortList(ports) {
    if (!ports || ports.length === 0) return 'none';
    const nums = ports.map(p => parseInt(p, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length === 0) return ports.join(',');
    const ranges = [];
    let start = nums[0];
    let prev = nums[0];

    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === prev + 1) {
        prev = nums[i];
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = nums[i];
        prev = nums[i];
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(',');
  }

  showVlans() {
    const dev = this.device;
    const cfg = dev.hpeConfig;
    this.print(`\nStatus and Counters - VLAN Information\n`);
    this.print(`Maximum VLANs to support : 256`);
    this.print(`Primary VLAN : DEFAULT_VLAN`);
    this.print(`Management VLAN :\n`);
    this.print(`VLAN ID Name                 | Status     Voice Jumbo`);
    this.print(`------- -------------------- + ---------- ----- -----`);
    for (const [vid, v] of Object.entries(cfg.vlans)) {
      this.print(`${vid.padEnd(7, ' ')} ${(v.name || '').padEnd(20, ' ')} | Port-based No    No`);
    }
    this.print("");
  }

  showInterfacesBrief() {
    const dev = this.device;
    const sim = window.PXLNetworkSim;
    this.print(`\nStatus and Counters - Port Status\n`);
    this.print(`Port   Type       | Alert Enabled Status Mode       Flow Ctrl`);
    this.print(`------ ---------- + ----- ------- ------ ---------- ---------`);

    for (let p = 1; p <= 24; p++) {
      const intfKey = `Port ${p}`;
      const intf = dev.interfaces[intfKey] || {};
      const isUp = sim ? sim.isLinkUp(dev.id, intfKey) : false;
      const status = isUp ? 'Up' : 'Down';
      const mode = isUp ? '1000FDx' : 'Auto';
      const enabled = intf.shutdown ? 'No' : 'Yes';
      this.print(`${String(p).padEnd(6, ' ')} 100/1000T   | No    ${enabled.padEnd(7, ' ')} ${status.padEnd(6, ' ')} ${mode.padEnd(10, ' ')} disable`);
    }
    for (let sfp = 25; sfp <= 28; sfp++) {
      const intfKey = `Port ${sfp} (SFP)`;
      const intf = dev.interfaces[intfKey] || {};
      const isUp = sim ? sim.isLinkUp(dev.id, intfKey) : false;
      const status = isUp ? 'Up' : 'Down';
      const enabled = intf.shutdown ? 'No' : 'Yes';
      this.print(`${String(sfp).padEnd(6, ' ')} SFP        | No    ${enabled.padEnd(7, ' ')} ${status.padEnd(6, ' ')} ${isUp ? '1000FDx' : 'Auto   '} disable`);
    }
    this.print("");
  }

  showMacAddress() {
    const dev = this.device;
    this.print(`\nStatus and Counters - Address Table\n`);
    this.print(`MAC Address       Port  VLAN`);
    this.print(`----------------- ----- ----`);
    if (dev.macTable && Object.keys(dev.macTable).length > 0) {
      for (const [mac, info] of Object.entries(dev.macTable)) {
        this.print(`${mac.padEnd(17, ' ')} ${(info.port || '1').padEnd(5, ' ')} 1`);
      }
    } else {
      this.print(`b439d6-000001     1     1`);
      this.print(`005079-666801     2     1`);
    }
    this.print("");
  }

  showIp() {
    const dev = this.device;
    const cfg = dev.hpeConfig;
    this.print(`\nInternet (IP) Service\n`);
    this.print(`  IP Routing : ${dev.model && dev.model.includes('2930') ? 'Enabled' : 'Disabled'}`);
    this.print(`  Default Gateway : ${cfg.defaultGateway || '0.0.0.0'}\n`);
    this.print(`VLAN| IP Config  IP Address      Subnet Mask     Proxy ARP`);
    this.print(`----+ ---------- --------------- --------------- ---------`);
    for (const [vid, v] of Object.entries(cfg.vlans)) {
      if (v.ip) {
        this.print(`${vid.padEnd(4, ' ')}| Manual     ${v.ip.padEnd(15, ' ')} ${(v.mask || '255.255.255.0').padEnd(15, ' ')} Disabled`);
      }
    }
    this.print("");
  }

  handlePing(args) {
    if (args.length === 0) {
      this.print("Usage: ping <ip-address>");
      return;
    }
    const target = args[0];
    this.print(`\nRunning ping to ${target}...`);
    const sim = window.PXLNetworkSim;
    if (sim) {
      const res = sim.executePing(this.device.id, target);
      if (res.success) {
        this.print(`${target} is alive, round-trip time = 1 ms`);
        this.print(`4 packets transmitted, 4 packets received, 0% packet loss`);
      } else {
        this.print(`Request timed out. Target ${target} unreachable from ${this.device.hostname}`);
      }
    }
    this.print("");
  }

  printHelp() {
    this.print("\nHPE ArubaOS-S Command Summary:");
    this.print("  enable                     Enter privileged exec mode");
    this.print("  configure terminal         Enter global configuration mode");
    this.print("  hostname <name>            Set system hostname");
    this.print("  vlan <1-4094>              Enter VLAN configuration context");
    this.print("    name <string>            Assign name to VLAN");
    this.print("    untagged <ports>         Assign access ports (e.g. untagged 1-8)");
    this.print("    tagged <ports>           Assign trunk ports (e.g. tagged 24)");
    this.print("    ip address <ip> <mask>   Assign SVI IP address to VLAN");
    this.print("  interface <port>           Enter port configuration context");
    this.print("    enable / disable         Admin enable or disable interface");
    this.print("    name <description>       Port description");
    this.print("  web-management [plaintext] Enable HPE Web GUI on port 80");
    this.print("  ip default-gateway <ip>    Configure default gateway");
    this.print("  show running-config        Display active switch configuration");
    this.print("  show vlans                 Display configured VLANs");
    this.print("  show interfaces brief      Display physical port link statuses");
    this.print("  show mac-address           Display CAM/MAC address table");
    this.print("  show ip                    Display IP addresses and routing");
    this.print("  write memory               Save active configuration");
    this.print("  ping <ip>                  Test network connectivity");
    this.print("");
  }

  tabComplete(inputLine) {
    if (!inputLine) return "";
    const raw = inputLine.trim();
    const grammar = [
      'show running-config', 'show vlans', 'show interfaces brief', 'show mac-address', 'show ip',
      'configure terminal', 'hostname', 'vlan', 'interface', 'untagged', 'tagged', 'ip address',
      'ip default-gateway', 'web-management plaintext', 'write memory', 'ping', 'enable', 'disable', 'exit', 'end'
    ];
    const match = grammar.find(g => g.startsWith(raw.toLowerCase()));
    if (match) return match + ' ';
    return inputLine;
  }
}

/**
 * Renders the authentic HPE Aruba Web Management GUI
 */
function renderHpeWebInterfaceHtml(device) {
  const cfg = device.hpeConfig || {
    model: device.model || 'Aruba-2530-24G',
    hostname: device.hostname || 'Aruba-2530',
    firmware: 'YA.16.11.0003',
    mgmtIp: device.ip || '192.168.1.10',
    mgmtMask: device.mask || '255.255.255.0',
    defaultGateway: device.defaultGateway || '192.168.1.1',
    webManagement: { enabled: true, ssl: false },
    vlans: { 1: { id: 1, name: 'DEFAULT_VLAN', ip: '192.168.1.10', mask: '255.255.255.0', untagged: Array.from({ length: 28 }, (_, i) => String(i + 1)), tagged: [] } }
  };

  const sim = window.PXLNetworkSim;
  const is2930 = (cfg.model || '').includes('2930');
  const modelName = is2930 ? 'HPE Aruba 2930F-24G-4SFP+ Switch (JL258A)' : 'HPE Aruba 2530-24G Switch (J9776A)';

  // Build Front-panel 28 port LEDs
  let portsHtml = '';
  for (let p = 1; p <= 24; p++) {
    const intfKey = `Port ${p}`;
    const intf = device.interfaces ? device.interfaces[intfKey] : null;
    const isUp = sim ? sim.isLinkUp(device.id, intfKey) : false;
    const ledColor = (!device.powerOn || (intf && intf.shutdown)) ? '#64748b' : (isUp ? '#22c55e' : '#f59e0b');
    portsHtml += `
      <div style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 24px; height: 38px; background: #0f172a; border: 1px solid #334155; border-radius: 3px; margin: 2px;">
        <span style="display: block; width: 6px; height: 6px; border-radius: 50%; background: ${ledColor}; box-shadow: 0 0 5px ${ledColor}; margin-bottom: 3px;"></span>
        <span style="font-size: 9px; color: #94a3b8; font-weight: bold;">${p}</span>
      </div>
    `;
  }
  for (let sfp = 25; sfp <= 28; sfp++) {
    const intfKey = `Port ${sfp} (SFP)`;
    const intf = device.interfaces ? device.interfaces[intfKey] : null;
    const isUp = sim ? sim.isLinkUp(device.id, intfKey) : false;
    const ledColor = (!device.powerOn || (intf && intf.shutdown)) ? '#64748b' : (isUp ? '#38bdf8' : '#f59e0b');
    portsHtml += `
      <div style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 26px; height: 38px; background: #1e1b4b; border: 1px solid #4338ca; border-radius: 3px; margin: 2px;">
        <span style="display: block; width: 6px; height: 6px; border-radius: 50%; background: ${ledColor}; box-shadow: 0 0 5px ${ledColor}; margin-bottom: 3px;"></span>
        <span style="font-size: 8px; color: #a5b4fc; font-weight: bold;">S${sfp}</span>
      </div>
    `;
  }

  // Build VLAN rows
  let vlanRows = '';
  for (const [vid, v] of Object.entries(cfg.vlans || {})) {
    vlanRows += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px; font-weight: 600;">${vid}</td>
        <td style="padding: 8px;">${v.name}</td>
        <td style="padding: 8px;">${v.ip ? `${v.ip} / ${v.mask}` : '<span style="color:#94a3b8;">Geen IP (Layer 2)</span>'}</td>
        <td style="padding: 8px; font-size: 11px; color: #0369a1;">${v.untagged && v.untagged.length ? 'Untagged: ' + v.untagged.slice(0, 8).join(',') + (v.untagged.length > 8 ? '...' : '') : '-'}</td>
        <td style="padding: 8px; font-size: 11px; color: #c2410c;">${v.tagged && v.tagged.length ? 'Tagged (Trunk): ' + v.tagged.join(',') : '-'}</td>
      </tr>
    `;
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; min-height: 480px; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
      <!-- HPE Header -->
      <div style="background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #ff7900;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: #ff7900; color: #fff; font-weight: 900; font-size: 14px; padding: 4px 8px; border-radius: 4px; letter-spacing: 1px;">aruba</div>
          <div>
            <div style="font-size: 15px; font-weight: 700;">${modelName}</div>
            <div style="font-size: 11px; color: #94a3b8;">Hostname: <strong>${device.hostname}</strong> &bull; Firmware: <strong>${cfg.firmware}</strong> &bull; IP: <strong>${cfg.mgmtIp}</strong></div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="background: #22c55e; color: #fff; font-size: 11px; padding: 2px 10px; border-radius: 12px; font-weight: bold;">WEB ACTIVE</span>
          <button style="background: #334155; border: none; color: #fff; padding: 5px 12px; border-radius: 4px; font-size: 11px; cursor: pointer;" onclick="alert('Aruba Switch Configuration saved to flash memory')">💾 Save Config</button>
        </div>
      </div>

      <!-- Main Layout: Sidebar & Content -->
      <div style="display: flex; flex: 1;">
        <!-- Left Nav Sidebar -->
        <div style="width: 200px; background: #1e293b; color: #cbd5e1; padding: 15px 10px; font-size: 13px; border-right: 1px solid #334155;">
          <div style="font-size: 10px; text-transform: uppercase; color: #ff7900; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 8px;">Management</div>
          <div style="padding: 7px 10px; background: rgba(255,121,0,0.15); color: #ff7900; font-weight: 600; border-radius: 4px; margin-bottom: 4px; cursor: pointer;">🔍 Status & Front Panel</div>
          <div style="padding: 7px 10px; border-radius: 4px; margin-bottom: 4px; cursor: pointer;" onclick="document.getElementById('hpeSectionVlan').scrollIntoView({behavior: 'smooth'})">🏷️ VLAN Configuration</div>
          <div style="padding: 7px 10px; border-radius: 4px; margin-bottom: 4px; cursor: pointer;" onclick="document.getElementById('hpeSectionIp').scrollIntoView({behavior: 'smooth'})">🌐 IP Management</div>
          <div style="padding: 7px 10px; border-radius: 4px; margin-bottom: 4px; cursor: pointer;" onclick="document.getElementById('hpeSectionPorts').scrollIntoView({behavior: 'smooth'})">🔌 Port Settings (1-28)</div>
          <div style="margin-top: 20px; font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 8px;">System Health</div>
          <div style="font-size: 11px; color: #94a3b8; padding: 5px 10px;">CPU Load: <strong>3%</strong></div>
          <div style="font-size: 11px; color: #94a3b8; padding: 5px 10px;">Memory: <strong>14% used</strong></div>
          <div style="font-size: 11px; color: #94a3b8; padding: 5px 10px;">Power: <strong>Internal OK</strong></div>
        </div>

        <!-- Main Body Panels -->
        <div style="flex: 1; padding: 20px; overflow-y: auto; max-height: 520px;">
          <!-- Front Panel Matrix Card -->
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
              <span>Front Panel Port Status & Link Activity:</span>
              <span style="font-size: 11px; color: #64748b;">Groen = Link Up &bull; Oranje = Standby &bull; Grijs = Disabled</span>
            </div>
            <div style="background: #020617; border-radius: 6px; padding: 10px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: center; border: 2px solid #334155;">
              ${portsHtml}
            </div>
          </div>

          <!-- VLAN Configuration Card -->
          <div id="hpeSectionVlan" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; color: #0f172a; display: flex; justify-content: space-between; align-items: center;">
              <span>🏷️ VLAN Management & Port Memberships</span>
              <span style="font-size: 11px; color: #0284c7;">802.1Q Port-Based VLANs</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left; color: #475569;">
                  <th style="padding: 8px;">VLAN ID</th>
                  <th style="padding: 8px;">VLAN Naam</th>
                  <th style="padding: 8px;">IP / Subnet Mask</th>
                  <th style="padding: 8px;">Untagged Poorten</th>
                  <th style="padding: 8px;">Tagged (Trunk)</th>
                </tr>
              </thead>
              <tbody>
                ${vlanRows}
              </tbody>
            </table>

            <!-- Quick Add VLAN Form -->
            <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <span style="font-weight: 600; font-size: 12px;">+ Nieuw VLAN toevoegen:</span>
              <input type="number" id="hpeNewVlanId" placeholder="VLAN ID (bv 10)" style="width: 90px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
              <input type="text" id="hpeNewVlanName" placeholder="VLAN Naam (bv STUDENTS)" style="width: 140px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
              <input type="text" id="hpeNewVlanPorts" placeholder="Poorten (bv 1-8 of 24)" style="width: 110px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;">
              <button class="pt-btn pt-btn-primary" style="padding: 4px 12px; font-size: 11px;" onclick="
                const vid = document.getElementById('hpeNewVlanId').value;
                const vname = document.getElementById('hpeNewVlanName').value || 'VLAN' + vid;
                const ports = (document.getElementById('hpeNewVlanPorts').value || '1').split(/[,-]/);
                if (vid) {
                  const dev = window.PXLNetworkSim.devices['${device.id}'];
                  if (dev && dev.hpeConfig) {
                    dev.hpeConfig.vlans[vid] = { id: parseInt(vid,10), name: vname, untagged: ports, tagged: [] };
                    window.PXLApp.showToast('✅ VLAN ' + vid + ' (' + vname + ') aangemaakt op ' + dev.hostname);
                    window.PXLApp.triggerScoreUpdate();
                    if (window.PXLApp.activeDevice && window.PXLApp.activeDevice.id === dev.id) window.PXLApp.browseToUrl();
                  }
                }
              ">VLAN Toevoegen</button>
            </div>
          </div>

          <!-- IP & Web Management Settings Card -->
          <div id="hpeSectionIp" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; color: #0f172a;">🌐 Switch IP Management & Web Service</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px;">
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 4px;">Management IP Adres (VLAN 1):</label>
                <input type="text" id="hpeMgmtIpInput" value="${cfg.mgmtIp}" style="width: 100%; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box;">
              </div>
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 4px;">Subnet Mask:</label>
                <input type="text" id="hpeMgmtMaskInput" value="${cfg.mgmtMask}" style="width: 100%; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box;">
              </div>
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 4px;">Default Gateway:</label>
                <input type="text" id="hpeMgmtGwInput" value="${cfg.defaultGateway}" style="width: 100%; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box;">
              </div>
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 4px;">Web Management Service:</label>
                <div style="margin-top: 8px;">
                  <label><input type="checkbox" id="hpeWebMgmtChk" ${cfg.webManagement.enabled ? 'checked' : ''}> Web GUI inschakelen (HTTP Poort 80)</label>
                </div>
              </div>
            </div>
            <div style="margin-top: 15px; text-align: right;">
              <button class="pt-btn pt-btn-primary" onclick="
                const ip = document.getElementById('hpeMgmtIpInput').value.trim();
                const mask = document.getElementById('hpeMgmtMaskInput').value.trim();
                const gw = document.getElementById('hpeMgmtGwInput').value.trim();
                const webOn = document.getElementById('hpeWebMgmtChk').checked;
                const dev = window.PXLNetworkSim.devices['${device.id}'];
                if (dev && dev.hpeConfig) {
                  dev.hpeConfig.mgmtIp = ip;
                  dev.ip = ip;
                  dev.hpeConfig.mgmtMask = mask;
                  dev.mask = mask;
                  dev.hpeConfig.defaultGateway = gw;
                  dev.defaultGateway = gw;
                  dev.hpeConfig.webManagement.enabled = webOn;
                  if (dev.hpeConfig.vlans[1]) {
                    dev.hpeConfig.vlans[1].ip = ip;
                    dev.hpeConfig.vlans[1].mask = mask;
                  }
                  window.PXLApp.showToast('✅ HPE Switch IP configuratie succesvol opgeslagen');
                  window.PXLApp.triggerScoreUpdate();
                }
              ">Wijzigingen Toepassen</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.HpeCLIParser = HpeCLIParser;
  window.renderHpeWebInterfaceHtml = renderHpeWebInterfaceHtml;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HpeCLIParser, renderHpeWebInterfaceHtml };
}
