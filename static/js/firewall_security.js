/**
 * firewall_security.js - Next-Gen & Open Source Firewall CLI Parsers & Web GUIs
 * Part of PXL Web NetSim (Hogeschool PXL)
 *
 * Implements:
 * 1. Cisco ASA 5506-X (ASA-OS CLI: nameif, security-level, object network, nat)
 * 2. Fortinet FortiGate-60F (FortiOS 7.x CLI & Web UI)
 * 3. Palo Alto Networks PA-440 (PAN-OS 11.x CLI & ACC Web UI)
 * 4. OPNsense 24.1 (Interactive FreeBSD Console Menu & OPNsense Web UI)
 * 5. pfSense Plus 23.09 (Interactive FreeBSD Console Menu & Netgate Web UI)
 */

(function (window) {
  'use strict';

  // =========================================================================
  // 1. CISCO ASA 5506-X (ASA-OS CLI PARSER)
  // =========================================================================
  class CiscoASACLIParser {
    constructor(device, printFn, updatePromptFn, notifyChangeFn) {
      this.device = device;
      this.print = printFn || console.log;
      this.updatePrompt = updatePromptFn || (() => {});
      this.notifyChange = notifyChangeFn || (() => {});

      this.mode = 'USER_EXEC'; // 'USER_EXEC' (>), 'PRIV_EXEC' (#), 'CONFIG' (config)#, 'CONFIG_IF' (config-if)#, 'CONFIG_OBJ' (config-network-object)#
      this.currentInterface = null;
      this.currentObject = null;
      this.pagerState = null;

      if (!this.device.asaConfig) {
        this.device.asaConfig = {
          version: '9.14(2)',
          deviceManagerVersion: '7.14(1)',
          objects: {},
          natRules: [],
          routes: []
        };
      }
    }

    getPrompt() {
      const hn = this.device.hostname || 'ciscoasa';
      if (this.mode === 'USER_EXEC') return `${hn}>`;
      if (this.mode === 'PRIV_EXEC') return `${hn}#`;
      if (this.mode === 'CONFIG') return `${hn}(config)#`;
      if (this.mode === 'CONFIG_IF') return `${hn}(config-if)#`;
      if (this.mode === 'CONFIG_OBJ') return `${hn}(config-network-object)#`;
      return `${hn}>`;
    }

    handleCommand(cmdLine) {
      const raw = cmdLine.trim();
      if (!raw) return;

      this.device.history = this.device.history || [];
      this.device.history.push(raw);
      this.device.historyIndex = this.device.history.length;

      const parts = raw.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Global navigation across modes
      if (cmd === 'exit' || cmd === 'quit') {
        if (this.mode === 'CONFIG_IF' || this.mode === 'CONFIG_OBJ') {
          this.mode = 'CONFIG';
          this.currentInterface = null;
          this.currentObject = null;
        } else if (this.mode === 'CONFIG') {
          this.mode = 'PRIV_EXEC';
        } else if (this.mode === 'PRIV_EXEC') {
          this.mode = 'USER_EXEC';
        }
        this.updatePrompt();
        return;
      }

      if (cmd === 'end') {
        if (this.mode.startsWith('CONFIG')) {
          this.mode = 'PRIV_EXEC';
          this.currentInterface = null;
          this.currentObject = null;
        }
        this.updatePrompt();
        return;
      }

      // Show / Ping / Diagnostic commands allowed in privileged & config modes
      if (cmd === 'show') {
        this.handleShow(args);
        return;
      }

      if (cmd === 'ping') {
        this.handlePing(args);
        return;
      }

      // --- USER EXEC MODE (>) ---
      if (this.mode === 'USER_EXEC') {
        if (cmd === 'enable' || cmd === 'en') {
          this.mode = 'PRIV_EXEC';
          this.updatePrompt();
          return;
        }
        if (cmd === 'help' || cmd === '?') {
          this.print('Available commands:\n  enable   Enter privileged EXEC mode\n  help     Description of the interactive help system\n  ping     Send echo messages\n  show     Show running system information');
          return;
        }
        this.print(`% Invalid command at "${cmd}"`);
        return;
      }

      // --- PRIVILEGED EXEC MODE (#) ---
      if (this.mode === 'PRIV_EXEC') {
        if (cmd === 'disable') {
          this.mode = 'USER_EXEC';
          this.updatePrompt();
          return;
        }
        if (cmd === 'configure' || cmd === 'conf') {
          if (args[0] && args[0].toLowerCase().startsWith('t')) {
            this.mode = 'CONFIG';
            this.updatePrompt();
            return;
          }
          this.mode = 'CONFIG';
          this.updatePrompt();
          return;
        }
        if (cmd === 'write' && (args[0] === 'memory' || args[0] === 'mem')) {
          this.print('Building configuration...\n[OK]');
          return;
        }
        if (cmd === 'copy' && args[0] === 'running-config' && args[1] === 'startup-config') {
          this.print('Source filename [running-config]? \nDestination filename [startup-config]? \nBuilding configuration...\n[OK]');
          return;
        }
        this.print(`% Invalid command at "${cmd}"`);
        return;
      }

      // --- CONFIG MODE (config)# ---
      if (this.mode === 'CONFIG') {
        if (cmd === 'hostname') {
          if (args[0]) {
            this.device.hostname = args[0];
            this.device.displayName = args[0];
            this.notifyChange();
            this.updatePrompt();
          }
          return;
        }

        if (cmd === 'interface' || cmd === 'int') {
          const intfName = this.resolveInterfaceName(args[0]);
          if (intfName && this.device.interfaces[intfName]) {
            this.currentInterface = intfName;
            this.mode = 'CONFIG_IF';
            this.updatePrompt();
            return;
          }
          this.print(`% Interface ${args[0]} not found`);
          return;
        }

        if (cmd === 'route') {
          // Syntax: route <nameif> <ip> <mask> <next-hop>
          if (args.length >= 4) {
            const nameif = args[0];
            const net = args[1];
            const mask = args[2];
            const nextHop = args[3];
            this.device.staticRoutes = this.device.staticRoutes || [];
            this.device.staticRoutes.push({ network: net, mask: mask, nextHop: nextHop, nameif: nameif });
            if (net === '0.0.0.0' && mask === '0.0.0.0') {
              this.device.defaultGateway = nextHop;
            }
            this.notifyChange();
            return;
          }
          this.print('% Incomplete command: route <nameif> <network> <netmask> <gateway>');
          return;
        }

        if (cmd === 'object' && args[0] === 'network') {
          const objName = args[1];
          if (!objName) {
            this.print('% Incomplete command: object network <name>');
            return;
          }
          this.currentObject = objName;
          this.device.asaConfig.objects[objName] = this.device.asaConfig.objects[objName] || { name: objName, type: 'network' };
          this.mode = 'CONFIG_OBJ';
          this.updatePrompt();
          return;
        }

        this.print(`% Unrecognized command: "${raw}"`);
        return;
      }

      // --- CONFIG INTERFACE MODE (config-if)# ---
      if (this.mode === 'CONFIG_IF') {
        const intf = this.device.interfaces[this.currentInterface];
        if (!intf) {
          this.mode = 'CONFIG';
          return;
        }

        if (cmd === 'nameif') {
          const nif = args[0] ? args[0].toLowerCase() : '';
          intf.nameif = nif;
          if (nif === 'outside') {
            intf.securityLevel = 0;
            this.print('INFO: Security level for "outside" set to 0 by default.');
          } else if (nif === 'inside') {
            intf.securityLevel = 100;
            this.print('INFO: Security level for "inside" set to 100 by default.');
          } else {
            intf.securityLevel = intf.securityLevel !== undefined ? intf.securityLevel : 0;
            this.print(`INFO: Security level for "${nif}" set to ${intf.securityLevel} by default.`);
          }
          this.notifyChange();
          return;
        }

        if (cmd === 'security-level') {
          const lvl = parseInt(args[0], 10);
          if (!isNaN(lvl) && lvl >= 0 && lvl <= 100) {
            intf.securityLevel = lvl;
            this.notifyChange();
            return;
          }
          this.print('% Security level must be an integer between 0 and 100');
          return;
        }

        if (cmd === 'ip' && args[0] === 'address') {
          if (args[1] === 'dhcp') {
            intf.ip = 'dhcp';
            intf.mask = '255.255.255.0';
            this.notifyChange();
            return;
          }
          const ip = args[1];
          const mask = args[2] || '255.255.255.0';
          intf.ip = ip;
          intf.mask = mask;
          this.notifyChange();
          return;
        }

        if (cmd === 'no' && args[0] === 'shutdown') {
          intf.shutdown = false;
          this.print(`Interface ${this.currentInterface} changed state to up`);
          this.notifyChange();
          return;
        }

        if (cmd === 'shutdown') {
          intf.shutdown = true;
          this.print(`Interface ${this.currentInterface} administratively down`);
          this.notifyChange();
          return;
        }

        if (cmd === 'description') {
          intf.description = args.join(' ');
          this.notifyChange();
          return;
        }

        this.print(`% Unrecognized interface command: "${raw}"`);
        return;
      }

      // --- CONFIG NETWORK OBJECT MODE (config-network-object)# ---
      if (this.mode === 'CONFIG_OBJ') {
        const obj = this.device.asaConfig.objects[this.currentObject];
        if (cmd === 'subnet') {
          obj.subnet = args.join(' ');
          this.notifyChange();
          return;
        }
        if (cmd === 'nat') {
          // Syntax: nat (inside,outside) dynamic interface
          obj.nat = args.join(' ');
          this.print(`NAT rule staged for object ${this.currentObject}`);
          this.notifyChange();
          return;
        }
        this.print(`% Unrecognized object command: "${raw}"`);
        return;
      }
    }

    handleShow(args) {
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'ip' && args[1] === 'address') {
        this.print('System IP Addresses:');
        this.print('Interface                Name                   IP address      Subnet mask     Method');
        for (const [name, intf] of Object.entries(this.device.interfaces)) {
          if (name === 'Console' || name === 'Aux') continue;
          const nif = (intf.nameif || '').padEnd(22);
          const ip = (intf.ip || 'unassigned').padEnd(15);
          const mask = (intf.mask || 'unassigned').padEnd(15);
          this.print(`${name.padEnd(24)} ${nif} ${ip} ${mask} CONFIG`);
        }
        return;
      }

      if (sub === 'interface' || sub === 'int') {
        this.print('Interface status and statistics:');
        for (const [name, intf] of Object.entries(this.device.interfaces)) {
          const st = intf.shutdown ? 'administratively down' : 'up';
          this.print(`Interface ${name} "${intf.nameif || 'unnamed'}" is ${st}, line protocol is ${st}`);
          if (intf.ip) this.print(`  IP address ${intf.ip}, subnet mask ${intf.mask || '255.255.255.0'}`);
          if (intf.securityLevel !== undefined) this.print(`  Security level: ${intf.securityLevel}`);
        }
        return;
      }

      if (sub === 'running-config' || sub === 'run') {
        this.print(`: Saved\n:\nASA Version 9.14(2)\n!\nhostname ${this.device.hostname}`);
        for (const [name, intf] of Object.entries(this.device.interfaces)) {
          if (name === 'Console') continue;
          this.print(`interface ${name}`);
          if (intf.nameif) this.print(` nameif ${intf.nameif}`);
          if (intf.securityLevel !== undefined) this.print(` security-level ${intf.securityLevel}`);
          if (intf.ip) this.print(` ip address ${intf.ip} ${intf.mask || '255.255.255.0'}`);
          if (intf.shutdown) this.print(' shutdown');
          else this.print(' no shutdown');
          this.print('!');
        }
        if (this.device.staticRoutes && this.device.staticRoutes.length > 0) {
          for (const r of this.device.staticRoutes) {
            this.print(`route ${r.nameif || 'outside'} ${r.network} ${r.mask} ${r.nextHop} 1`);
          }
        }
        return;
      }

      if (sub === 'route') {
        this.print('Codes: C - connected, S - static, R - RIP, M - mobile, B - BGP\nGateway of last resort is ' + (this.device.defaultGateway || 'not set'));
        if (this.device.staticRoutes) {
          for (const r of this.device.staticRoutes) {
            this.print(`S    ${r.network} [1/0] via ${r.nextHop}, ${r.nameif || 'outside'}`);
          }
        }
        for (const [name, intf] of Object.entries(this.device.interfaces)) {
          if (intf.ip && !intf.shutdown) {
            this.print(`C    ${intf.ip}/24 is directly connected, ${intf.nameif || name}`);
          }
        }
        return;
      }

      this.print(`% Unrecognized show command at "${args.join(' ')}"`);
    }

    handlePing(args) {
      const target = args[0];
      if (!target) {
        this.print('% Target IP address or host name: ');
        return;
      }
      this.print(`Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
      const sim = window.PXLNetworkSim;
      let success = false;
      if (sim && typeof sim.executePing === 'function') {
        const res = sim.executePing(this.device.id, target);
        success = res && res.success;
      }
      if (success) {
        this.print('!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms');
      } else {
        this.print('.....\nSuccess rate is 0 percent (0/5)');
      }
    }

    resolveInterfaceName(input) {
      if (!input) return null;
      const lower = input.toLowerCase();
      for (const name of Object.keys(this.device.interfaces)) {
        if (name.toLowerCase() === lower) return name;
        if (lower.startsWith('gi') && name.toLowerCase().includes(lower.replace('gi', 'gigabitethernet'))) return name;
        if (lower.startsWith('g1/') && name.toLowerCase().includes('gigabitethernet1/')) return name;
      }
      return null;
    }
  }

  // =========================================================================
  // 2. FORTINET FORTIGATE-60F (FORTIOS 7.x CLI PARSER)
  // =========================================================================
  class FortiOSCLIParser {
    constructor(device, printFn, updatePromptFn, notifyChangeFn) {
      this.device = device;
      this.print = printFn || console.log;
      this.updatePrompt = updatePromptFn || (() => {});
      this.notifyChange = notifyChangeFn || (() => {});

      this.scope = ['root']; // navigation path: ['root'], ['root', 'system', 'interface'], ['root', 'system', 'interface', 'port1']
      this.currentEdit = null;

      if (!this.device.fortiConfig) {
        this.device.fortiConfig = {
          version: 'FortiOS v7.4.2 build2573 (GA)',
          serial: 'FGT60FTK23048921',
          policies: [
            { id: 1, name: 'Internet-Access', srcintf: 'port1', dstintf: 'wan1', srcaddr: 'all', dstaddr: 'all', action: 'accept', schedule: 'always', service: 'ALL', nat: 'enable' }
          ],
          staticRoutes: [
            { id: 1, dst: '0.0.0.0/0', gateway: '198.51.100.1', device: 'wan1' }
          ]
        };
      }
    }

    getPrompt() {
      const hn = this.device.hostname || 'FortiGate-60F';
      if (this.scope.length === 1) return `${hn} # `;
      const sub = this.scope[this.scope.length - 1];
      return `${hn} (${sub}) # `;
    }

    handleCommand(cmdLine) {
      const raw = cmdLine.trim();
      if (!raw) return;

      this.device.history = this.device.history || [];
      this.device.history.push(raw);
      this.device.historyIndex = this.device.history.length;

      const parts = raw.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (cmd === 'end') {
        this.scope = ['root'];
        this.currentEdit = null;
        this.updatePrompt();
        return;
      }

      if (cmd === 'next') {
        if (this.scope.length > 2) {
          this.scope.pop();
          this.currentEdit = null;
          this.updatePrompt();
        }
        return;
      }

      // Root level commands
      if (this.scope.length === 1) {
        if (cmd === 'config') {
          const target = args.join(' ').toLowerCase();
          if (target.includes('system interface')) {
            this.scope.push('interface');
            this.updatePrompt();
            return;
          }
          if (target.includes('firewall policy')) {
            this.scope.push('policy');
            this.updatePrompt();
            return;
          }
          if (target.includes('router static')) {
            this.scope.push('static-route');
            this.updatePrompt();
            return;
          }
        }

        if (cmd === 'get' && args[0] === 'system' && args[1] === 'status') {
          this.print(`Version: FortiGate-60F v7.4.2,build2573,231102 (GA)\nSerial-Number: ${this.device.fortiConfig.serial}\nBIOS version: 05000002\nSystem Part-Number: P23048-02\nHostName: ${this.device.hostname}\nOperation Mode: NAT\nCurrent virtual domain: root\nMax number of virtual domains: 10\nVirtual domains status: 1 in NAT mode\nVirtual domain configuration: disable\nBranch point: 2573`);
          return;
        }

        if (cmd === 'execute' && args[0] === 'ping') {
          const target = args[1];
          this.print(`PING ${target} (${target}): 56 data bytes`);
          const sim = window.PXLNetworkSim;
          let success = false;
          if (sim) {
            const res = sim.executePing(this.device.id, target);
            success = res && res.success;
          }
          if (success) {
            this.print(`56 bytes from ${target}: icmp_seq=1 ttl=64 time=1.23 ms\n56 bytes from ${target}: icmp_seq=2 ttl=64 time=1.04 ms\n56 bytes from ${target}: icmp_seq=3 ttl=64 time=0.98 ms\n56 bytes from ${target}: icmp_seq=4 ttl=64 time=1.12 ms\n56 bytes from ${target}: icmp_seq=5 ttl=64 time=1.02 ms\n--- ${target} ping statistics ---\n5 packets transmitted, 5 packets received, 0% packet loss`);
          } else {
            this.print(`Timeout ...\n--- ${target} ping statistics ---\n5 packets transmitted, 0 packets received, 100% packet loss`);
          }
          return;
        }

        if (cmd === 'show' || cmd === 'get') {
          this.print(`config system interface\n    edit "wan1"\n        set ip ${this.device.interfaces['wan1']?.ip || '0.0.0.0'} 255.255.255.0\n        set allowaccess ping https ssh\n    next\n    edit "port1"\n        set ip ${this.device.interfaces['port1']?.ip || '192.168.1.99'} 255.255.255.0\n        set allowaccess ping https ssh http\n    next\nend`);
          return;
        }

        this.print(`command parse error before '${cmd}'`);
        return;
      }

      // Inside config system interface
      if (this.scope[1] === 'interface') {
        if (cmd === 'edit') {
          const port = args[0] ? args[0].replace(/['"]/g, '') : '';
          if (port && this.device.interfaces[port]) {
            this.scope.push(port);
            this.currentEdit = port;
            this.updatePrompt();
            return;
          }
          this.print(`Unknown interface: ${port}`);
          return;
        }

        if (this.currentEdit && cmd === 'set') {
          const intf = this.device.interfaces[this.currentEdit];
          const param = args[0]?.toLowerCase();
          if (param === 'ip') {
            const ip = args[1];
            const mask = args[2] || '255.255.255.0';
            intf.ip = ip;
            intf.mask = mask;
            this.notifyChange();
            return;
          }
          if (param === 'allowaccess') {
            intf.allowAccess = args.slice(1).join(' ');
            this.notifyChange();
            return;
          }
          if (param === 'status') {
            intf.shutdown = (args[1] === 'down');
            this.notifyChange();
            return;
          }
        }
      }

      // Inside config firewall policy
      if (this.scope[1] === 'policy') {
        if (cmd === 'edit') {
          const id = parseInt(args[0], 10) || 1;
          this.scope.push(`policy-${id}`);
          let pol = this.device.fortiConfig.policies.find(p => p.id === id);
          if (!pol) {
            pol = { id, name: `Policy-${id}`, srcintf: 'port1', dstintf: 'wan1', srcaddr: 'all', dstaddr: 'all', action: 'accept', nat: 'enable' };
            this.device.fortiConfig.policies.push(pol);
          }
          this.currentEdit = pol;
          this.updatePrompt();
          return;
        }

        if (this.currentEdit && cmd === 'set') {
          const param = args[0]?.toLowerCase();
          const val = args[1]?.replace(/['"]/g, '');
          if (param === 'name') this.currentEdit.name = val;
          if (param === 'srcintf') this.currentEdit.srcintf = val;
          if (param === 'dstintf') this.currentEdit.dstintf = val;
          if (param === 'action') this.currentEdit.action = val;
          if (param === 'nat') this.currentEdit.nat = val;
          this.notifyChange();
          return;
        }
      }

      this.print(`unknown command '${cmd}'`);
    }
  }

  // =========================================================================
  // 3. PALO ALTO PA-440 (PAN-OS 11.x CLI PARSER)
  // =========================================================================
  class PANOSCLIParser {
    constructor(device, printFn, updatePromptFn, notifyChangeFn) {
      this.device = device;
      this.print = printFn || console.log;
      this.updatePrompt = updatePromptFn || (() => {});
      this.notifyChange = notifyChangeFn || (() => {});

      this.inConfigMode = false;

      if (!this.device.panosConfig) {
        this.device.panosConfig = {
          version: 'PAN-OS 11.0.2',
          serial: '015301004928',
          model: 'PA-440',
          zones: {
            'TRUST': ['ethernet1/2'],
            'UNTRUST': ['ethernet1/1']
          },
          rules: [
            { name: 'Allow-Internal-Out', from: 'TRUST', to: 'UNTRUST', source: 'any', destination: 'any', action: 'allow' }
          ]
        };
      }
    }

    getPrompt() {
      const hn = this.device.hostname || 'PA-440';
      return this.inConfigMode ? `admin@${hn}# ` : `admin@${hn}> `;
    }

    handleCommand(cmdLine) {
      const raw = cmdLine.trim();
      if (!raw) return;

      this.device.history = this.device.history || [];
      this.device.history.push(raw);
      this.device.historyIndex = this.device.history.length;

      const parts = raw.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (cmd === 'exit' || cmd === 'quit') {
        if (this.inConfigMode) {
          this.inConfigMode = false;
          this.updatePrompt();
        }
        return;
      }

      if (!this.inConfigMode) {
        // Operational Mode (>)
        if (cmd === 'configure') {
          this.inConfigMode = true;
          this.print('Entering configuration mode\n[edit]');
          this.updatePrompt();
          return;
        }

        if (cmd === 'show' && args[0] === 'system' && args[1] === 'info') {
          this.print(`hostname: ${this.device.hostname}\nip-address: ${this.device.interfaces['management']?.ip || '192.168.1.1'}\nnetmask: 255.255.255.0\ndefault-gateway: ${this.device.defaultGateway || '192.168.1.254'}\nmodel: PA-440\nserial: ${this.device.panosConfig.serial}\nsw-version: 11.0.2\nuptime: 14 days, 3 hours, 22 mins`);
          return;
        }

        if (cmd === 'show' && args[0] === 'interface' && (args[1] === 'all' || !args[1])) {
          this.print('total interfaces: 5');
          this.print('name                id    speed/duplex/state     ip address');
          for (const [name, intf] of Object.entries(this.device.interfaces)) {
            const st = intf.shutdown ? 'down/down' : 'auto/full/up';
            this.print(`${name.padEnd(20)} ${st.padEnd(22)} ${intf.ip || 'unassigned'}`);
          }
          return;
        }

        if (cmd === 'ping' && args[0] === 'host') {
          const target = args[1];
          this.print(`PING ${target} (${target}) 56(84) bytes of data.`);
          const sim = window.PXLNetworkSim;
          let success = false;
          if (sim) {
            const res = sim.executePing(this.device.id, target);
            success = res && res.success;
          }
          if (success) {
            this.print(`64 bytes from ${target}: icmp_seq=1 ttl=64 time=1.12 ms\n64 bytes from ${target}: icmp_seq=2 ttl=64 time=1.05 ms\n--- ${target} ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss`);
          } else {
            this.print(`--- ${target} ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss`);
          }
          return;
        }

        this.print(`Invalid syntax.`);
        return;
      }

      // Configuration Mode (#)
      if (cmd === 'set') {
        const fullStr = args.join(' ');
        if (fullStr.startsWith('deviceconfig system hostname')) {
          const hn = args[3];
          if (hn) {
            this.device.hostname = hn;
            this.device.displayName = hn;
            this.notifyChange();
          }
          return;
        }

        if (fullStr.startsWith('deviceconfig system ip-address')) {
          const ip = args[3];
          const mask = args[5] || '255.255.255.0';
          if (this.device.interfaces['management']) {
            this.device.interfaces['management'].ip = ip;
            this.device.interfaces['management'].mask = mask;
            this.notifyChange();
          }
          return;
        }

        if (fullStr.startsWith('network interface ethernet')) {
          const ethName = args[3];
          const intf = this.device.interfaces[ethName];
          if (intf) {
            const ipIdx = args.indexOf('ip');
            if (ipIdx !== -1 && args[ipIdx + 1]) {
              const [ip, cidr] = args[ipIdx + 1].split('/');
              intf.ip = ip;
              intf.mask = '255.255.255.0';
              intf.shutdown = false;
              this.notifyChange();
            }
          }
          return;
        }

        if (fullStr.startsWith('zone')) {
          const zoneName = args[1];
          const eth = args[args.length - 1];
          this.device.panosConfig.zones[zoneName] = this.device.panosConfig.zones[zoneName] || [];
          if (!this.device.panosConfig.zones[zoneName].includes(eth)) {
            this.device.panosConfig.zones[zoneName].push(eth);
          }
          this.notifyChange();
          return;
        }
      }

      if (cmd === 'commit') {
        this.print('........55%............100%\nConfiguration committed successfully');
        this.notifyChange();
        return;
      }

      this.print(`Invalid syntax.`);
    }
  }

  // =========================================================================
  // 4. OPNSENSE 24.1 (FREEBSD INTERACTIVE CONSOLE MENU & SHELL)
  // =========================================================================
  class OPNsenseConsoleParser {
    constructor(device, printFn, updatePromptFn, notifyChangeFn) {
      this.device = device;
      this.print = printFn || console.log;
      this.updatePrompt = updatePromptFn || (() => {});
      this.notifyChange = notifyChangeFn || (() => {});

      this.inShell = false;
      this.wizardStep = null; // for step-by-step IP configuration

      if (!this.device.opnsenseConfig) {
        this.device.opnsenseConfig = {
          version: 'OPNsense 24.1-amd64',
          rulesCount: 8,
          webGuiPort: 443
        };
      }
    }

    getPrompt() {
      if (this.inShell) return 'root@opnsense:~ # ';
      if (this.wizardStep) return 'Enter value: ';
      return 'Enter an option: ';
    }

    renderMenu() {
      const lanIp = this.device.interfaces['vtnet0 (LAN)']?.ip || '192.168.1.1';
      const wanIp = this.device.interfaces['vtnet1 (WAN)']?.ip || '192.168.100.10';
      let out = '';
      out += `*** ${this.device.hostname || 'OPNsense'}.localdomain: OPNsense 24.1 (amd64) ***\n\n`;
      out += `  LAN (vtnet0)   -> v4: ${lanIp}/24\n`;
      out += `  WAN (vtnet1)   -> v4/DHCP: ${wanIp}/24\n\n`;
      out += ` 0) Logout                              7) Ping host\n`;
      out += ` 1) Assign interfaces                   8) Shell\n`;
      out += ` 2) Set interface IP address           11) Restart webGui\n`;
      out += ` 3) Reset root password                12) Upgrade from console\n`;
      out += ` 4) Reset to factory defaults          13) Restore configuration\n`;
      out += ` 5) Power off system                   14) Enable Secure Shell\n`;
      out += ` 6) Reboot system\n\n`;
      this.print(out);
      this.updatePrompt();
    }

    handleCommand(cmdLine) {
      const raw = cmdLine.trim();

      // In FreeBSD Shell Mode
      if (this.inShell) {
        if (raw === 'exit') {
          this.inShell = false;
          this.renderMenu();
          return;
        }
        if (raw.startsWith('ping')) {
          const parts = raw.split(/\s+/);
          const target = parts[parts.length - 1];
          this.print(`PING ${target} (${target}): 56 data bytes\n64 bytes from ${target}: icmp_seq=0 ttl=64 time=1.02 ms\n64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.95 ms\n--- ${target} ping statistics ---\n2 packets transmitted, 2 packets received, 0.0% packet loss`);
          return;
        }
        if (raw === 'ifconfig') {
          for (const [name, intf] of Object.entries(this.device.interfaces)) {
            const devName = name.split(' ')[0];
            const st = intf.shutdown ? 'status: no carrier' : 'status: active';
            this.print(`${devName}: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> metric 0 mtu 1500\n        inet ${intf.ip || '0.0.0.0'} netmask 0xffffff00 broadcast 192.168.1.255\n        ${st}`);
          }
          return;
        }
        if (raw === 'netstat -rn') {
          this.print(`Routing tables\nInternet:\nDestination        Gateway            Flags     Netif Expire\ndefault            ${this.device.defaultGateway || '192.168.100.1'}     UGS      vtnet1\n192.168.1.0/24     link#1             U        vtnet0`);
          return;
        }
        if (raw === 'pfctl -sr') {
          this.print(`pass out all flags S/SA keep state\npass in quick on vtnet0 inet proto tcp from any to any port 443\npass in quick on vtnet0 inet proto icmp all keep state`);
          return;
        }
        this.print(`eval: ${raw}: not found`);
        return;
      }

      // Step-by-step interface configuration wizard
      if (this.wizardStep) {
        if (this.wizardStep.step === 'ask_ip') {
          this.wizardStep.intf.ip = raw || '192.168.1.1';
          this.wizardStep.step = 'ask_mask';
          this.print(`Enter the new LAN IPv4 subnet bit count (1 to 31):\n> 24`);
          this.updatePrompt();
          return;
        }
        if (this.wizardStep.step === 'ask_mask') {
          this.wizardStep.intf.mask = '255.255.255.0';
          this.print(`Subnet updated. Configuration reloaded successfully!\n\nThe webGUI is accessible via: https://${this.wizardStep.intf.ip}/\n`);
          this.wizardStep = null;
          this.notifyChange();
          this.renderMenu();
          return;
        }
      }

      // Menu Mode (0 - 14)
      if (raw === '8') {
        this.inShell = true;
        this.print(`FreeBSD 13.2-RELEASE-p7 (OPNsense) #0: Wed Jan 24 10:20:12 UTC 2024\nWelcome to OPNsense Shell! Type 'exit' to return to menu.\n`);
        this.updatePrompt();
        return;
      }

      if (raw === '2') {
        this.print(`Available interfaces:\n 1 - LAN (vtnet0)\n 2 - WAN (vtnet1)\n\nEnter the number of the interface you wish to configure: `);
        this.wizardStep = { step: 'ask_ip', intf: this.device.interfaces['vtnet0 (LAN)'] };
        this.updatePrompt();
        return;
      }

      if (raw === '7') {
        this.print(`Enter a host name or IP address: 8.8.8.8\nPING 8.8.8.8 (8.8.8.8): 56 data bytes\n64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=8.42 ms\n64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=8.15 ms\n--- 8.8.8.8 ping statistics ---\n2 packets transmitted, 2 packets received, 0.0% packet loss\n\nPress ENTER to continue.`);
        return;
      }

      if (raw === '11') {
        this.print(`Restarting webGui... done.\nWeb interface is running on port ${this.device.opnsenseConfig.webGuiPort}.`);
        return;
      }

      // Re-display menu on Enter or invalid option
      this.renderMenu();
    }
  }

  // =========================================================================
  // 5. PFSENSE PLUS 23.09 (FREEBSD INTERACTIVE CONSOLE MENU & SHELL)
  // =========================================================================
  class pfSenseConsoleParser {
    constructor(device, printFn, updatePromptFn, notifyChangeFn) {
      this.device = device;
      this.print = printFn || console.log;
      this.updatePrompt = updatePromptFn || (() => {});
      this.notifyChange = notifyChangeFn || (() => {});

      this.inShell = false;

      if (!this.device.pfsenseConfig) {
        this.device.pfsenseConfig = {
          version: 'pfSense Plus 23.09-RELEASE (amd64)',
          domain: 'localdomain',
          adminUser: 'admin'
        };
      }
    }

    getPrompt() {
      if (this.inShell) return '[23.09-RELEASE][root@pfSense.localdomain]/root: ';
      return 'Enter an option: ';
    }

    renderMenu() {
      const wanIp = this.device.interfaces['vtnet0 (WAN)']?.ip || '198.51.100.15';
      const lanIp = this.device.interfaces['vtnet1 (LAN)']?.ip || '192.168.1.1';
      let out = '';
      out += `*** Welcome to Netgate pfSense Plus 23.09-RELEASE (amd64) ***\n\n`;
      out += `  WAN (vtnet0)   -> v4/DHCP4: ${wanIp}/24\n`;
      out += `  LAN (vtnet1)   -> v4: ${lanIp}/24\n\n`;
      out += ` 0) Logout (SSH only)                  9) pfTop\n`;
      out += ` 1) Assign Interfaces                 10) Filter Logs\n`;
      out += ` 2) Set interface(s) IP address       11) Restart webConfigurator\n`;
      out += ` 3) Reset webConfigurator password    12) PHP shell + Netgate pfSense Plus tools\n`;
      out += ` 4) Reset to factory defaults         13) Update from console\n`;
      out += ` 5) Reboot system                     14) Enable Secure Shell (sshd)\n`;
      out += ` 6) Halt system                       15) Restore recent configuration\n`;
      out += ` 7) Ping host                         16) Restart PHP-FPM\n`;
      out += ` 8) Shell\n\n`;
      this.print(out);
      this.updatePrompt();
    }

    handleCommand(cmdLine) {
      const raw = cmdLine.trim();

      if (this.inShell) {
        if (raw === 'exit') {
          this.inShell = false;
          this.renderMenu();
          return;
        }
        if (raw.startsWith('ping')) {
          const parts = raw.split(/\s+/);
          const target = parts[parts.length - 1];
          this.print(`PING ${target} (${target}): 56 data bytes\n64 bytes from ${target}: icmp_seq=0 ttl=64 time=1.01 ms\n64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.98 ms\n--- ${target} ping statistics ---\n2 packets transmitted, 2 packets received, 0.0% packet loss`);
          return;
        }
        if (raw === 'ifconfig') {
          for (const [name, intf] of Object.entries(this.device.interfaces)) {
            const devName = name.split(' ')[0];
            const st = intf.shutdown ? 'status: no carrier' : 'status: active';
            this.print(`${devName}: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> metric 0 mtu 1500\n        inet ${intf.ip || '0.0.0.0'} netmask 0xffffff00 broadcast 192.168.1.255\n        ${st}`);
          }
          return;
        }
        this.print(`sh: ${raw}: not found`);
        return;
      }

      if (raw === '8') {
        this.inShell = true;
        this.print(`Welcome to pfSense shell.\nType 'exit' to return to console menu.\n`);
        this.updatePrompt();
        return;
      }

      if (raw === '7') {
        this.print(`Enter a host name or IP address: 1.1.1.1\nPING 1.1.1.1 (1.1.1.1): 56 data bytes\n64 bytes from 1.1.1.1: icmp_seq=0 ttl=58 time=7.21 ms\n64 bytes from 1.1.1.1: icmp_seq=1 ttl=58 time=7.05 ms\n--- 1.1.1.1 ping statistics ---\n2 packets transmitted, 2 packets received, 0.0% packet loss\n\nPress ENTER to continue.`);
        return;
      }

      if (raw === '11') {
        this.print(`Restarting webConfigurator... done.\nwebConfigurator is now running at https://${this.device.interfaces['vtnet1 (LAN)']?.ip || '192.168.1.1'}`);
        return;
      }

      this.renderMenu();
    }
  }

  // =========================================================================
  // 6. WEB GUI RENDERERS (FORTINET, PALO ALTO, OPNSENSE, PFSENSE)
  // =========================================================================
  const FirewallGuiRenderers = {
    renderFortiWebTab(device, container) {
      if (!device || !container) return;
      const wanIp = device.interfaces['wan1']?.ip || '198.51.100.2';
      const lanIp = device.interfaces['port1']?.ip || '192.168.1.99';

      container.innerHTML = `
        <div style="background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100%; display: flex; flex-direction: column;">
          <!-- FortiOS Header -->
          <div style="background: #1e293b; border-bottom: 2px solid #0d9488; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="background: #dc2626; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 13px; letter-spacing: 1px;">FORTINET</span>
              <strong style="font-size: 15px; color: #38bdf8;">FortiGate-60F (${device.hostname})</strong>
              <span style="background: #064e3b; color: #34d399; padding: 2px 8px; border-radius: 10px; font-size: 11px;">FortiOS v7.4.2</span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px; font-size: 12px; color: #94a3b8;">
              <span>👤 admin</span>
              <span>🔒 VDOM: root</span>
              <span style="color: #22c55e;">● HA Standalone</span>
            </div>
          </div>

          <!-- Main Body -->
          <div style="flex: 1; display: flex; overflow: hidden;">
            <!-- Left Navigation Bar -->
            <div style="width: 200px; background: #0f172a; border-right: 1px solid #334155; padding: 10px; font-size: 12px;">
              <div style="color: #0d9488; font-weight: bold; margin-bottom: 8px;">DASHBOARD</div>
              <div style="padding: 6px 10px; background: #1e293b; color: #38bdf8; border-radius: 4px; font-weight: 600; margin-bottom: 4px;">📊 Status</div>
              <div style="color: #64748b; font-weight: bold; margin: 12px 0 6px;">NETWORK</div>
              <div style="padding: 6px 10px; color: #cbd5e1; cursor: pointer;">🔌 Interfaces</div>
              <div style="padding: 6px 10px; color: #cbd5e1; cursor: pointer;">🛣️ Static Routes</div>
              <div style="color: #64748b; font-weight: bold; margin: 12px 0 6px;">POLICY & OBJECTS</div>
              <div style="padding: 6px 10px; color: #cbd5e1; cursor: pointer;">🛡️ Firewall Policy</div>
            </div>

            <!-- Content Area -->
            <div style="flex: 1; padding: 16px; overflow-y: auto;">
              <!-- Grid Widgets -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
                <!-- System Information Widget -->
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 14px;">
                  <h4 style="margin: 0 0 10px; font-size: 13px; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 6px;">System Information</h4>
                  <table style="width: 100%; font-size: 12px; line-height: 1.8;">
                    <tr><td style="color: #94a3b8;">Host Name:</td><td><strong>${device.hostname}</strong></td></tr>
                    <tr><td style="color: #94a3b8;">Serial Number:</td><td><code>${device.fortiConfig?.serial || 'FGT60FTK23048921'}</code></td></tr>
                    <tr><td style="color: #94a3b8;">Firmware:</td><td>FortiOS v7.4.2 build2573</td></tr>
                    <tr><td style="color: #94a3b8;">System Time:</td><td>${new Date().toUTCString()}</td></tr>
                    <tr><td style="color: #94a3b8;">Operation Mode:</td><td>NAT / Route</td></tr>
                  </table>
                </div>

                <!-- Interface Summary Widget -->
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 14px;">
                  <h4 style="margin: 0 0 10px; font-size: 13px; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 6px;">Active Interfaces</h4>
                  <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                    <tr style="color: #94a3b8; border-bottom: 1px solid #334155; text-align: left;">
                      <th style="padding: 4px;">Port</th><th>IP / Netmask</th><th>Access</th><th>Status</th>
                    </tr>
                    <tr>
                      <td style="padding: 6px 4px; font-weight: 600; color: #38bdf8;">wan1</td>
                      <td>${wanIp}/24</td>
                      <td>ping, https, ssh</td>
                      <td><span style="color: #22c55e;">● UP</span></td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 4px; font-weight: 600; color: #38bdf8;">port1 (LAN)</td>
                      <td>${lanIp}/24</td>
                      <td>ping, https, http</td>
                      <td><span style="color: #22c55e;">● UP</span></td>
                    </tr>
                  </table>
                </div>
              </div>

              <!-- Firewall Policies Table -->
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 14px;">
                <h4 style="margin: 0 0 10px; font-size: 13px; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 6px;">Active Firewall Policies (IPv4)</h4>
                <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                  <thead style="background: #0f172a; color: #94a3b8;">
                    <tr>
                      <th style="padding: 6px; text-align: left;">ID</th>
                      <th style="text-align: left;">Name</th>
                      <th style="text-align: left;">From</th>
                      <th style="text-align: left;">To</th>
                      <th style="text-align: left;">Action</th>
                      <th style="text-align: left;">NAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid #334155;">
                      <td style="padding: 6px;">1</td>
                      <td style="font-weight: 600; color: #f8fafc;">Internet-Access</td>
                      <td><span style="background: #0369a1; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px;">port1</span></td>
                      <td><span style="background: #b45309; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px;">wan1</span></td>
                      <td><span style="color: #22c55e; font-weight: bold;">✔ ACCEPT</span></td>
                      <td><span style="color: #38bdf8; font-weight: bold;">✔ ENABLED</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    renderPanWebTab(device, container) {
      if (!device || !container) return;
      const mgtIp = device.interfaces['management']?.ip || '192.168.1.1';
      const eth1Ip = device.interfaces['ethernet1/1']?.ip || '10.0.0.1';
      const eth2Ip = device.interfaces['ethernet1/2']?.ip || '192.168.10.1';

      container.innerHTML = `
        <div style="background: #1e293b; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100%; display: flex; flex-direction: column;">
          <!-- PAN-OS Top Bar -->
          <div style="background: #0f172a; border-bottom: 2px solid #f97316; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="color: #f97316; font-weight: 900; font-size: 15px; letter-spacing: 0.5px;">paloalto</span>
              <span style="color: #94a3b8;">|</span>
              <strong style="color: #f8fafc; font-size: 13px;">${device.hostname} (PA-440)</strong>
              <span style="background: #7c2d12; color: #fdba74; font-size: 10px; padding: 1px 6px; border-radius: 4px;">PAN-OS 11.0.2</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <button onclick="alert('Commit succeeded: 100%')" style="background: #f97316; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px;">💾 Commit</button>
              <span style="font-size: 12px; color: #94a3b8;">admin@${device.hostname}</span>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <div style="background: #1e293b; border-bottom: 1px solid #334155; padding: 0 16px; display: flex; gap: 20px; font-size: 12px; font-weight: 600;">
            <div style="padding: 8px 0; color: #f97316; border-bottom: 2px solid #f97316;">DASHBOARD</div>
            <div style="padding: 8px 0; color: #94a3b8; cursor: pointer;">ACC (Application Command Center)</div>
            <div style="padding: 8px 0; color: #94a3b8; cursor: pointer;">POLICIES</div>
            <div style="padding: 8px 0; color: #94a3b8; cursor: pointer;">NETWORK</div>
            <div style="padding: 8px 0; color: #94a3b8; cursor: pointer;">DEVICE</div>
          </div>

          <!-- Body -->
          <div style="flex: 1; padding: 16px; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <!-- System Dashboard Widget -->
              <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px;">
                <h4 style="margin: 0 0 10px; font-size: 12px; color: #f97316; border-bottom: 1px solid #334155; padding-bottom: 4px;">General Information</h4>
                <table style="width: 100%; font-size: 11px; line-height: 1.8;">
                  <tr><td style="color: #94a3b8;">Model:</td><td>PA-440</td></tr>
                  <tr><td style="color: #94a3b8;">Management IP:</td><td>${mgtIp}</td></tr>
                  <tr><td style="color: #94a3b8;">Software Version:</td><td>11.0.2</td></tr>
                  <tr><td style="color: #94a3b8;">Application Version:</td><td>8761-8201</td></tr>
                  <tr><td style="color: #94a3b8;">Threat Version:</td><td>8761-8201</td></tr>
                </table>
              </div>

              <!-- Interface Summary Widget -->
              <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px;">
                <h4 style="margin: 0 0 10px; font-size: 12px; color: #f97316; border-bottom: 1px solid #334155; padding-bottom: 4px;">Data Plane Interfaces</h4>
                <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                  <tr style="color: #94a3b8; border-bottom: 1px solid #334155; text-align: left;">
                    <th style="padding: 4px;">Interface</th><th>Zone</th><th>IP Address</th><th>Status</th>
                  </tr>
                  <tr><td style="padding: 4px;">ethernet1/1</td><td><span style="color: #f87171;">UNTRUST</span></td><td>${eth1Ip}/24</td><td><span style="color: #22c55e;">● Up</span></td></tr>
                  <tr><td style="padding: 4px;">ethernet1/2</td><td><span style="color: #34d399;">TRUST</span></td><td>${eth2Ip}/24</td><td><span style="color: #22c55e;">● Up</span></td></tr>
                </table>
              </div>
            </div>

            <!-- Security Policies Table -->
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px; margin-top: 14px;">
              <h4 style="margin: 0 0 10px; font-size: 12px; color: #f97316; border-bottom: 1px solid #334155; padding-bottom: 4px;">Security Policy Rules</h4>
              <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                <tr style="color: #94a3b8; border-bottom: 1px solid #334155; text-align: left;">
                  <th style="padding: 4px;">Name</th><th>Source Zone</th><th>Dest Zone</th><th>Application</th><th>Action</th>
                </tr>
                <tr>
                  <td style="padding: 4px; font-weight: 600;">Allow-Internal-Out</td>
                  <td>TRUST</td>
                  <td>UNTRUST</td>
                  <td>any (App-ID)</td>
                  <td><span style="color: #22c55e; font-weight: bold;">allow</span></td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      `;
    },

    renderOpnWebTab(device, container) {
      if (!device || !container) return;
      const lanIp = device.interfaces['vtnet0 (LAN)']?.ip || '192.168.1.1';
      const wanIp = device.interfaces['vtnet1 (WAN)']?.ip || '192.168.100.10';

      container.innerHTML = `
        <div style="background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100%; display: flex; flex-direction: column;">
          <!-- OPNsense Top Bar -->
          <div style="background: #a80000; color: white; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 900; font-size: 16px; letter-spacing: 0.5px;">OPNsense</span>
              <span style="font-size: 12px; opacity: 0.9;">${device.hostname}.localdomain</span>
            </div>
            <div style="font-size: 12px;">👤 root@${device.hostname}</div>
          </div>

          <!-- Navigation Ribbon -->
          <div style="background: #1e293b; border-bottom: 1px solid #334155; padding: 6px 16px; display: flex; gap: 18px; font-size: 12px; font-weight: 600; color: #cbd5e1;">
            <span style="color: #f87171;">Lobby (Dashboard)</span>
            <span>System</span>
            <span>Interfaces</span>
            <span>Firewall</span>
            <span>VPN</span>
            <span>Services</span>
          </div>

          <!-- Body -->
          <div style="flex: 1; padding: 16px; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 12px;">
                <h4 style="margin: 0 0 8px; font-size: 12px; color: #f87171; border-bottom: 1px solid #334155; padding-bottom: 4px;">System Information</h4>
                <table style="width: 100%; font-size: 11px; line-height: 1.8;">
                  <tr><td style="color: #94a3b8;">Name:</td><td>${device.hostname}.localdomain</td></tr>
                  <tr><td style="color: #94a3b8;">Versions:</td><td>OPNsense 24.1 (amd64/OpenSSL)</td></tr>
                  <tr><td style="color: #94a3b8;">FreeBSD Kernel:</td><td>FreeBSD 13.2-RELEASE-p7</td></tr>
                  <tr><td style="color: #94a3b8;">CPU Usage:</td><td><span style="color: #22c55e;">2% (4 cores)</span></td></tr>
                </table>
              </div>

              <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 12px;">
                <h4 style="margin: 0 0 8px; font-size: 12px; color: #f87171; border-bottom: 1px solid #334155; padding-bottom: 4px;">Interfaces Status</h4>
                <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid #334155;"><th style="text-align: left; padding: 4px;">Interface</th><th>IP Address</th><th>Status</th></tr>
                  <tr><td style="padding: 4px; font-weight: bold; color: #f87171;">LAN (vtnet0)</td><td>${lanIp}/24</td><td><span style="color: #22c55e;">● Up (1000Base-T)</span></td></tr>
                  <tr><td style="padding: 4px; font-weight: bold; color: #38bdf8;">WAN (vtnet1)</td><td>${wanIp}/24</td><td><span style="color: #22c55e;">● Up (DHCP)</span></td></tr>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    renderPfWebTab(device, container) {
      if (!device || !container) return;
      const wanIp = device.interfaces['vtnet0 (WAN)']?.ip || '198.51.100.15';
      const lanIp = device.interfaces['vtnet1 (LAN)']?.ip || '192.168.1.1';

      container.innerHTML = `
        <div style="background: #f1f5f9; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100%; display: flex; flex-direction: column;">
          <!-- pfSense Top Bar -->
          <div style="background: #002d62; color: white; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 900; font-size: 16px;">Netgate pfSense+</span>
              <span style="font-size: 12px; opacity: 0.9;">${device.hostname}.localdomain</span>
            </div>
            <div style="font-size: 12px;">👤 admin@${device.hostname}</div>
          </div>

          <!-- Navigation Bar -->
          <div style="background: #1e3a5f; color: white; padding: 6px 16px; display: flex; gap: 18px; font-size: 12px; font-weight: 600;">
            <span style="background: #002d62; padding: 2px 8px; border-radius: 3px;">System</span>
            <span>Interfaces</span>
            <span>Firewall</span>
            <span>Services</span>
            <span>VPN</span>
            <span>Status</span>
            <span>Diagnostics</span>
          </div>

          <!-- Body -->
          <div style="flex: 1; padding: 16px; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h4 style="margin: 0 0 8px; font-size: 12px; color: #002d62; border-bottom: 2px solid #002d62; padding-bottom: 4px;">System Information</h4>
                <table style="width: 100%; font-size: 11px; line-height: 1.8;">
                  <tr><td style="color: #64748b;">Name:</td><td>${device.hostname}.localdomain</td></tr>
                  <tr><td style="color: #64748b;">System:</td><td>pfSense Plus 23.09-RELEASE (amd64)</td></tr>
                  <tr><td style="color: #64748b;">CPU Type:</td><td>Intel(R) Core(TM) i7-12700K (4 cores)</td></tr>
                  <tr><td style="color: #64748b;">Uptime:</td><td>3 Days 12 Hours 45 Mins</td></tr>
                </table>
              </div>

              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h4 style="margin: 0 0 8px; font-size: 12px; color: #002d62; border-bottom: 2px solid #002d62; padding-bottom: 4px;">Interfaces</h4>
                <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid #e2e8f0;"><th style="text-align: left; padding: 4px;">Name</th><th>Status</th><th>IP Address</th></tr>
                  <tr><td style="padding: 4px; font-weight: bold; color: #0284c7;">WAN</td><td><span style="color: #16a34a;">● UP</span></td><td>${wanIp}</td></tr>
                  <tr><td style="padding: 4px; font-weight: bold; color: #0284c7;">LAN</td><td><span style="color: #16a34a;">● UP</span></td><td>${lanIp}</td></tr>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  };

  // =========================================================================
  // 6. WATCHGUARD FIREBOXV (FIREWARE OS CLI PARSER & WEB UI)
  // =========================================================================
  class WatchGuardCLIParser {
    constructor(device, printFn, updatePromptFn, notifyChangeFn) {
      this.device = device;
      this.print = printFn || console.log;
      this.updatePrompt = updatePromptFn || (() => {});
      this.notifyChange = notifyChangeFn || (() => {});

      this.mode = 'USER_EXEC'; // 'USER_EXEC' (>), 'PRIV_EXEC' (#), 'CONFIG' (config)#, 'CONFIG_IF' (config-if)#
      this.currentInterface = null;

      if (!this.device.watchguardConfig) {
        this.device.watchguardConfig = {
          model: 'FireboxV',
          osVersion: 'Fireware v12.10.2 (Build 684201)',
          serialNumber: 'WGV8829104',
          systemName: this.device.hostname || 'FireboxV',
          domain: 'pxl.local',
          uptime: '3 days 14 hours 22 minutes',
          policies: [
            { id: 1, name: 'Outgoing', type: 'TCP-UDP', from: 'Trusted, Optional', to: 'External', action: 'Allow' },
            { id: 2, name: 'Ping', type: 'ICMP', from: 'Any', to: 'Firebox', action: 'Allow' },
            { id: 3, name: 'WatchGuard-Web-UI', type: 'TCP 8080', from: 'Trusted', to: 'Firebox', action: 'Allow' },
            { id: 4, name: 'Default-Drop', type: 'Any', from: 'Any', to: 'Any', action: 'Deny' }
          ]
        };
      }
    }

    getPrompt() {
      const hn = this.device.hostname || 'WG';
      if (this.mode === 'USER_EXEC') return `${hn}> `;
      if (this.mode === 'PRIV_EXEC') return `${hn}# `;
      if (this.mode === 'CONFIG') return `${hn}(config)# `;
      if (this.mode === 'CONFIG_IF') {
        const intfShort = (this.currentInterface || '').split(' ')[0] || 'if';
        return `${hn}(config-if-${intfShort})# `;
      }
      return `${hn}> `;
    }

    handleCommand(cmdLine) {
      const raw = cmdLine.trim();
      if (!raw) return;

      this.device.history = this.device.history || [];
      this.device.history.push(raw);
      this.device.historyIndex = this.device.history.length;

      const parts = raw.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Global Navigation
      if (cmd === 'exit' || cmd === 'quit') {
        if (this.mode === 'CONFIG_IF') {
          this.mode = 'CONFIG';
          this.currentInterface = null;
        } else if (this.mode === 'CONFIG') {
          this.mode = 'PRIV_EXEC';
        } else if (this.mode === 'PRIV_EXEC') {
          this.mode = 'USER_EXEC';
        }
        this.updatePrompt();
        return;
      }

      if (cmd === 'end') {
        if (this.mode.startsWith('CONFIG')) {
          this.mode = 'PRIV_EXEC';
          this.currentInterface = null;
        }
        this.updatePrompt();
        return;
      }

      if (cmd === 'help' || cmd === '?') {
        this.print(`WatchGuard Fireware OS Command Summary:
  enable                      Enter privileged mode
  configure terminal / config Enter configuration mode
  show interface [brief]      Display network interface status and IPs
  show run / configuration    Display running firewall configuration
  show ip route / route       Display kernel IP routing table
  show status / version       Display Firebox hardware & OS info
  interface <name>            Configure network interface (eth0..eth7)
  ip address <ip> <mask/cidr> Configure IP address on current interface
  [no] shutdown               Enable or disable interface
  ping <ip_address>           Send ICMP echo request packets
  exit / end                  Exit current configuration mode`);
        return;
      }

      // SHOW COMMANDS
      if (cmd === 'show') {
        this.handleShow(args);
        return;
      }

      // PING COMMAND
      if (cmd === 'ping') {
        this.handlePing(args);
        return;
      }

      // --- USER EXEC MODE (>) ---
      if (this.mode === 'USER_EXEC') {
        if (cmd === 'enable' || cmd === 'en') {
          this.mode = 'PRIV_EXEC';
          this.updatePrompt();
          return;
        }
        this.print(`% Unknown or restricted command: "${raw}". Type 'enable' to enter privileged mode.`);
        return;
      }

      // --- PRIVILEGED EXEC MODE (#) ---
      if (this.mode === 'PRIV_EXEC') {
        if (cmd === 'config' || cmd === 'configure') {
          this.mode = 'CONFIG';
          this.print(`Entering configuration mode for ${this.device.hostname || 'FireboxV'} (Fireware v12.10.2)...`);
          this.updatePrompt();
          return;
        }
        if (cmd === 'write' || (cmd === 'copy' && args[0] === 'run')) {
          this.device.savedStartupConfig = JSON.parse(JSON.stringify(this.device.interfaces));
          this.print(`[OK] Configuration committed to Firebox flash memory (flash:/config.xml).`);
          this.notifyChange();
          return;
        }
        this.print(`% Invalid command: "${raw}". Type 'configure terminal' to edit settings or 'show ?' for diagnostics.`);
        return;
      }

      // --- CONFIG MODE (config)# ---
      if (this.mode === 'CONFIG') {
        if (cmd === 'hostname' || cmd === 'sysname') {
          if (args[0]) {
            this.device.hostname = args[0];
            this.device.name = args[0];
            if (this.device.watchguardConfig) this.device.watchguardConfig.systemName = args[0];
            this.print(`WatchGuard system name set to ${args[0]}`);
            this.updatePrompt();
            this.notifyChange();
          } else {
            this.print(`% Usage: hostname <new_name>`);
          }
          return;
        }

        if (cmd === 'interface' || cmd === 'int') {
          const target = (args[0] || '').toLowerCase();
          const matchKey = Object.keys(this.device.interfaces).find(k => k.toLowerCase().startsWith(target));
          if (matchKey) {
            this.currentInterface = matchKey;
            this.mode = 'CONFIG_IF';
            this.updatePrompt();
          } else {
            this.print(`% Interface "${args[0]}" not found. Available: eth0, eth1, eth2, eth3, eth4, eth5, eth6, eth7.`);
          }
          return;
        }

        if (cmd === 'ip' && args[0] === 'route') {
          // ip route <dest> <mask> <gateway>
          if (args.length >= 3) {
            const dest = args[1];
            const mask = args[2];
            const gw = args[3] || '';
            this.device.staticRoutes = this.device.staticRoutes || [];
            this.device.staticRoutes.push({ network: dest, mask: mask, nextHop: gw });
            this.print(`Added static route: ${dest} netmask ${mask} via ${gw}`);
            this.notifyChange();
          } else {
            this.print(`% Usage: ip route <network> <netmask> <gateway>`);
          }
          return;
        }

        this.print(`% Invalid config command: "${raw}". Type 'interface <name>' or 'hostname <name>'.`);
        return;
      }

      // --- INTERFACE CONFIG MODE (config-if)# ---
      if (this.mode === 'CONFIG_IF') {
        const intf = this.device.interfaces[this.currentInterface];
        if (!intf) {
          this.mode = 'CONFIG';
          this.updatePrompt();
          return;
        }

        if (cmd === 'ip' && args[0] === 'address') {
          let ip = args[1] || '';
          let mask = args[2] || '255.255.255.0';
          if (ip.includes('/')) {
            const parts = ip.split('/');
            ip = parts[0];
            const cidr = parseInt(parts[1], 10);
            mask = this.cidrToMask(cidr);
          }
          intf.ip = ip;
          intf.mask = mask;
          if (this.currentInterface.includes('eth1') || this.currentInterface.includes('Trusted')) {
            this.device.ip = ip;
            this.device.mask = mask;
          }
          this.print(`Interface ${this.currentInterface} IP set to ${ip} ${mask}`);
          this.notifyChange();
          return;
        }

        if (cmd === 'shutdown') {
          intf.shutdown = true;
          this.print(`Interface ${this.currentInterface} is administratively down (Disabled).`);
          this.notifyChange();
          return;
        }

        if (cmd === 'no' && args[0] === 'shutdown') {
          intf.shutdown = false;
          this.print(`Interface ${this.currentInterface} is administratively UP.`);
          this.notifyChange();
          return;
        }

        if (cmd === 'description') {
          intf.description = args.join(' ');
          this.print(`Description set on ${this.currentInterface}`);
          this.notifyChange();
          return;
        }

        this.print(`% Invalid interface command: "${raw}". Use 'ip address <ip> <mask>', 'no shutdown', or 'exit'.`);
      }
    }

    handleShow(args) {
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'interface' || sub === 'interfaces' || sub === 'int') {
        this.print(`WatchGuard FireboxV Interface Overview (Fireware v12.10.2):`);
        this.print(`Interface        Zone      Status       IP Address         Netmask           MAC`);
        this.print(`--------------------------------------------------------------------------------------`);
        for (const [name, intf] of Object.entries(this.device.interfaces)) {
          if (name === 'Console') continue;
          const zone = intf.zone || (name.includes('External') ? 'External' : name.includes('Trusted') ? 'Trusted' : 'Optional');
          const status = intf.shutdown ? 'DISABLED ' : 'UP (1000) ';
          const ip = intf.ip || 'unassigned     ';
          const mask = intf.mask || 'unassigned     ';
          const mac = intf.mac || '00:90:7f:11:22:33';
          this.print(`${name.padEnd(16)} ${zone.padEnd(9)} ${status.padEnd(12)} ${ip.padEnd(18)} ${mask.padEnd(17)} ${mac}`);
        }
        return;
      }

      if (sub === 'run' || sub === 'running-config' || sub === 'configuration') {
        this.print(`! WatchGuard FireboxV Configuration
! Fireware OS v12.10.2 (Build 684201)
! Serial: ${this.device.watchguardConfig?.serialNumber || 'WGV8829104'}
! Generated: ${new Date().toUTCString()}
sysname "${this.device.hostname || 'FireboxV'}"
domain-name "${this.device.watchguardConfig?.domain || 'pxl.local'}"
!
firewall
 policy 1 name "Outgoing" type tcp-udp from "Trusted, Optional" to "External" action allow
 policy 2 name "Ping" type icmp from "Any" to "Firebox" action allow
 policy 3 name "WatchGuard-Web-UI" type tcp port 8080 from "Trusted" to "Firebox" action allow
 policy 4 name "Default-Drop" type any from "Any" to "Any" action deny
!
interfaces`);
        for (const [name, intf] of Object.entries(this.device.interfaces)) {
          if (name === 'Console') continue;
          this.print(` interface "${name}"`);
          if (intf.ip) this.print(`  ip address ${intf.ip} ${intf.mask || '255.255.255.0'}`);
          if (intf.shutdown) this.print(`  shutdown`);
          else this.print(`  no shutdown`);
          if (intf.description) this.print(`  description "${intf.description}"`);
        }
        this.print(`!
end`);
        return;
      }

      if (sub === 'route' || sub === 'ip') {
        this.print(`WatchGuard IP Routing Table (Kernel):
Destination     Gateway         Genmask         Flags Metric Iface
0.0.0.0         203.0.113.1     0.0.0.0         UG    1      eth0 (External)
192.168.1.0     0.0.0.0         255.255.255.0   U     0      eth1 (Trusted)
203.0.113.0     0.0.0.0         255.255.255.0   U     0      eth0 (External)`);
        if (this.device.staticRoutes) {
          this.device.staticRoutes.forEach(r => {
            this.print(`${r.network.padEnd(15)} ${(r.nextHop || '0.0.0.0').padEnd(15)} ${r.mask.padEnd(15)} UG    10     eth0`);
          });
        }
        return;
      }

      if (sub === 'status' || sub === 'version' || sub === 'system') {
        this.print(`WatchGuard FireboxV System Diagnostics:
  Appliance Model:    WatchGuard FireboxV (Virtual Appliance)
  Software Version:   Fireware OS v12.10.2 (Build 684201)
  Hardware Serial:    ${this.device.watchguardConfig?.serialNumber || 'WGV8829104'}
  System Uptime:      ${this.device.watchguardConfig?.uptime || '3 days 14 hours 22 minutes'}
  CPU Utilization:    3.2% (2 vCPUs active)
  Memory Usage:       512MB / 2048MB (25% utilized)
  Appliance Status:   HEALTHY • Normal Operational State`);
        return;
      }

      this.print(`% Use: show interface, show run, show route, show status`);
    }

    handlePing(args) {
      const target = (args[0] || '').trim();
      if (!target) {
        this.print(`% Usage: ping <ip_address>`);
        return;
      }
      this.print(`Sending 5, 64-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
      const sim = window.PXLNetworkSim;
      let okCount = 0;
      if (sim && typeof sim.testPing === 'function') {
        const canPing = sim.testPing(this.device.id, target);
        okCount = canPing ? 5 : 0;
      } else {
        okCount = (target === '127.0.0.1' || target === this.device.ip) ? 5 : 0;
      }

      if (okCount > 0) {
        this.print(`!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms.`);
      } else {
        this.print(`.....\nSuccess rate is 0 percent (0/5). Host unreachable or packet dropped by policy.`);
      }
      this.notifyChange();
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
  }

  // =========================================================================
  // FIREWALL GUI RENDERERS EXTENSION (WATCHGUARD FIREWARE WEB UI)
  // =========================================================================
  FirewallGuiRenderers.renderWatchGuardWebTab = function (device, container) {
    if (!device || !container) return;
    const eth0 = device.interfaces['eth0 (External)'] || {};
    const eth1 = device.interfaces['eth1 (Trusted)'] || {};
    const eth2 = device.interfaces['eth2 (Optional)'] || {};

    container.innerHTML = `
      <div style="background: #111827; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100%; display: flex; flex-direction: column;">
        <!-- WatchGuard Top Bar -->
        <div style="background: #c8102e; color: white; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #991b1b; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: white; border-radius: 4px; padding: 2px 6px; display: flex; align-items: center;">
              <span style="color: #c8102e; font-weight: 900; font-size: 16px; letter-spacing: -0.5px;">WatchGuard</span>
            </div>
            <span style="font-size: 14px; font-weight: 700; color: #ffffff;">Fireware Web UI</span>
            <span style="font-size: 11px; background: rgba(0,0,0,0.25); padding: 2px 8px; border-radius: 10px;">${device.hostname || 'FireboxV'}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 14px; font-size: 11.5px;">
            <span>Serial: <strong>${device.watchguardConfig?.serialNumber || 'WGV8829104'}</strong></span>
            <span>OS: <strong>Fireware v12.10.2</strong></span>
            <span style="background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 4px;">👤 admin@Firebox</span>
          </div>
        </div>

        <!-- Navigation Ribbon -->
        <div style="background: #1f2937; border-bottom: 1px solid #374151; padding: 8px 18px; display: flex; gap: 20px; font-size: 12px; font-weight: 600; color: #9ca3af;">
          <span style="color: #fca5a5; border-bottom: 2px solid #ef4444; padding-bottom: 4px; cursor: pointer;">Dashboard (Front Panel)</span>
          <span style="cursor: pointer;">Interfaces</span>
          <span style="cursor: pointer;">Firewall Policies</span>
          <span style="cursor: pointer;">Subscription Services</span>
          <span style="cursor: pointer;">VPN</span>
          <span style="cursor: pointer;">System</span>
        </div>

        <!-- Body / Dashboard -->
        <div style="flex: 1; padding: 16px; overflow-y: auto;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <!-- Panel 1: Device Information -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 10px;">
                <h4 style="margin: 0; font-size: 13px; color: #fca5a5; font-weight: 700;">🛡️ Appliance Information</h4>
                <span style="font-size: 10px; background: #059669; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;">HEALTHY</span>
              </div>
              <table style="width: 100%; font-size: 11.5px; line-height: 1.8;">
                <tr><td style="color: #94a3b8; width: 140px;">Model:</td><td><strong>WatchGuard FireboxV</strong></td></tr>
                <tr><td style="color: #94a3b8;">Firmware Version:</td><td>Fireware v12.10.2 (Build 684201)</td></tr>
                <tr><td style="color: #94a3b8;">System Name:</td><td>${device.hostname || 'FireboxV'}.pxl.local</td></tr>
                <tr><td style="color: #94a3b8;">CPU Utilization:</td><td><span style="color: #22c55e;">2.8%</span> (2 Cores Active)</td></tr>
                <tr><td style="color: #94a3b8;">Memory Usage:</td><td><span style="color: #38bdf8;">512 MB / 2048 MB (25%)</span></td></tr>
                <tr><td style="color: #94a3b8;">Uptime:</td><td>3 Days 14 Hours 22 Mins</td></tr>
              </table>
            </div>

            <!-- Panel 2: Live Network Interfaces -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 10px;">
                <h4 style="margin: 0; font-size: 13px; color: #fca5a5; font-weight: 700;">🌐 Network Interfaces Status</h4>
                <span style="font-size: 11px; color: #94a3b8;">GigabitEthernet</span>
              </div>
              <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #334155; color: #94a3b8;">
                  <th style="text-align: left; padding: 5px;">Port</th>
                  <th>Zone</th>
                  <th>IP / Subnet</th>
                  <th>Link Status</th>
                </tr>
                <tr style="border-bottom: 1px solid #283548;">
                  <td style="padding: 6px; font-weight: bold; color: #f87171;">eth0 (External)</td>
                  <td style="text-align: center;"><span style="background: #7f1d1d; color: #fca5a5; padding: 1px 6px; border-radius: 3px; font-size: 10px;">External</span></td>
                  <td style="text-align: center;">${eth0.ip || 'DHCP'} / ${eth0.mask || '24'}</td>
                  <td style="text-align: center;"><span style="color: #22c55e; font-weight: bold;">● 1000 Mbps</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #283548;">
                  <td style="padding: 6px; font-weight: bold; color: #4ade80;">eth1 (Trusted)</td>
                  <td style="text-align: center;"><span style="background: #14532d; color: #86efac; padding: 1px 6px; border-radius: 3px; font-size: 10px;">Trusted</span></td>
                  <td style="text-align: center;">${eth1.ip || '192.168.1.1'} / ${eth1.mask || '255.255.255.0'}</td>
                  <td style="text-align: center;"><span style="color: #22c55e; font-weight: bold;">● 1000 Mbps</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold; color: #fb923c;">eth2 (Optional)</td>
                  <td style="text-align: center;"><span style="background: #7c2d12; color: #fdba74; padding: 1px 6px; border-radius: 3px; font-size: 10px;">Optional</span></td>
                  <td style="text-align: center;">${eth2.ip || '10.0.1.1'} / ${eth2.mask || '255.255.255.0'}</td>
                  <td style="text-align: center;"><span style="color: #94a3b8;">○ Down</span></td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Panel 3: Active Firewall Policies -->
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 10px;">
              <h4 style="margin: 0; font-size: 13px; color: #fca5a5; font-weight: 700;">🔒 Active Firewall Policies (Packet Filter & Proxy)</h4>
              <span style="font-size: 11px; color: #38bdf8;">Inspection Engine: Stateful Inspection + IPS</span>
            </div>
            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #334155; color: #94a3b8;">
                  <th style="text-align: left; padding: 5px;">ID</th>
                  <th style="text-align: left; padding: 5px;">Policy Name</th>
                  <th style="text-align: left; padding: 5px;">Type</th>
                  <th style="text-align: left; padding: 5px;">From</th>
                  <th style="text-align: left; padding: 5px;">To</th>
                  <th style="text-align: center; padding: 5px;">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #283548;">
                  <td style="padding: 6px;">1</td>
                  <td style="padding: 6px; font-weight: bold; color: #f8fafc;">Outgoing</td>
                  <td style="padding: 6px; color: #94a3b8;">TCP-UDP</td>
                  <td style="padding: 6px; color: #86efac;">Trusted, Optional</td>
                  <td style="padding: 6px; color: #fca5a5;">External</td>
                  <td style="text-align: center;"><span style="background: #15803d; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">ALLOW</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #283548;">
                  <td style="padding: 6px;">2</td>
                  <td style="padding: 6px; font-weight: bold; color: #f8fafc;">Ping</td>
                  <td style="padding: 6px; color: #94a3b8;">ICMP</td>
                  <td style="padding: 6px; color: #cbd5e1;">Any</td>
                  <td style="padding: 6px; color: #cbd5e1;">Firebox</td>
                  <td style="text-align: center;"><span style="background: #15803d; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">ALLOW</span></td>
                </tr>
                <tr style="border-bottom: 1px solid #283548;">
                  <td style="padding: 6px;">3</td>
                  <td style="padding: 6px; font-weight: bold; color: #f8fafc;">WatchGuard-Web-UI</td>
                  <td style="padding: 6px; color: #94a3b8;">TCP 8080</td>
                  <td style="padding: 6px; color: #86efac;">Trusted</td>
                  <td style="padding: 6px; color: #cbd5e1;">Firebox</td>
                  <td style="text-align: center;"><span style="background: #15803d; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">ALLOW</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px;">4</td>
                  <td style="padding: 6px; font-weight: bold; color: #f8fafc;">Default-Drop</td>
                  <td style="padding: 6px; color: #94a3b8;">Any</td>
                  <td style="padding: 6px; color: #cbd5e1;">Any</td>
                  <td style="padding: 6px; color: #cbd5e1;">Any</td>
                  <td style="text-align: center;"><span style="background: #b91c1c; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">DENY</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    window.CiscoASACLIParser = CiscoASACLIParser;
    window.FortiOSCLIParser = FortiOSCLIParser;
    window.PANOSCLIParser = PANOSCLIParser;
    window.OPNsenseConsoleParser = OPNsenseConsoleParser;
    window.pfSenseConsoleParser = pfSenseConsoleParser;
    window.WatchGuardCLIParser = WatchGuardCLIParser;
    window.FirewallGuiRenderers = FirewallGuiRenderers;
  }
})(typeof window !== 'undefined' ? window : this);
