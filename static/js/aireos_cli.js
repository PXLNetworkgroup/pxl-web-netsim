/**
 * aireos_cli.js - Cisco 3504 Wireless LAN Controller AireOS CLI Parser
 * Models: Cisco 3504 WLC (AIR-CT3504-K9) running AireOS 8.10.x
 * Implements native non-hierarchical AireOS syntax:
 *   - Direct command execution (no 'enable' or 'configure terminal')
 *   - 'config wlan ...', 'config interface ...', 'config switchconfig ...'
 *   - 'show sysinfo', 'show wlan summary', 'show interface summary', 'show ap summary'
 *   - 'save config', 'reset system', setup wizard
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class AireOSCLIParser {
  constructor(device, printCallback, updatePromptCallback, triggerScoreUpdate) {
    this.device = device;
    this.print = printCallback || console.log;
    this.updatePrompt = updatePromptCallback || (() => {});
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});

    // Interactive state for confirmation prompts (save config, reset) or setup wizard
    this.pendingConfirm = null; // null | 'save_config' | 'reset_system'
    this.wizardState = null;

    this.initDeviceDefaults();
  }

  initDeviceDefaults() {
    const dev = this.device;
    if (!dev.wlcConfig) {
      dev.wlcConfig = {
        model: '3504',
        systemName: dev.hostname || 'Cisco_3504',
        systemLocation: 'PXL Campus Hasselt',
        systemContact: 'noc@pxl.be',
        mgmtIp: dev.ip || '10.10.0.254',
        mgmtMask: dev.mask || '255.255.255.0',
        mgmtGateway: dev.defaultGateway || '10.10.0.1',
        mgmtVlan: 10,
        interfaces: {
          'management': { name: 'management', vlan: 10, ip: '10.10.0.254', mask: '255.255.255.0', gateway: '10.10.0.1', port: 1, dhcpServer: '10.10.0.1', type: 'Static' },
          'virtual': { name: 'virtual', vlan: 0, ip: '192.0.2.1', mask: '255.255.255.0', gateway: '0.0.0.0', port: 'N/A', dhcpServer: '0.0.0.0', type: 'Static' },
          'int_staff': { name: 'int_staff', vlan: 20, ip: '10.20.0.254', mask: '255.255.255.0', gateway: '10.20.0.1', port: 1, dhcpServer: '10.20.0.1', type: 'Dynamic' },
          'int_guest': { name: 'int_guest', vlan: 30, ip: '10.30.0.254', mask: '255.255.255.0', gateway: '10.30.0.1', port: 1, dhcpServer: '10.30.0.1', type: 'Dynamic' }
        },
        wlans: [
          { id: 1, profile: 'WLAN-Staff', ssid: 'PXL-Staff', status: 'Enabled', intf: 'int_staff', vlan: 20, authMode: 'WPA2-PSK', passphrase: 'CiscoStaff123!' },
          { id: 2, profile: 'WLAN-Guest', ssid: 'PXL-Guest', status: 'Enabled', intf: 'int_guest', vlan: 30, authMode: 'Open', passphrase: '' }
        ]
      };
    }
  }

  getPrompt() {
    const dev = this.device;
    if (!dev.powerOn) return '[Device is Powered Off]';
    if (this.pendingConfirm) {
      if (this.pendingConfirm === 'save_config') return 'Are you sure you want to save? (y/n) ';
      if (this.pendingConfirm === 'reset_system') return 'Are you sure you want to reset system? (y/n) ';
    }
    const name = dev.wlcConfig?.systemName || dev.hostname || 'Cisco Controller';
    return `(${name}) > `;
  }

  handleCommand(rawLine) {
    const dev = this.device;
    if (!dev.powerOn) {
      this.print("% Controller is powered off. Turn power ON in Physical tab.");
      return;
    }

    const line = rawLine.trim();

    // Handle interactive confirmations (save / reset)
    if (this.pendingConfirm) {
      const answer = line.toLowerCase();
      if (this.pendingConfirm === 'save_config') {
        this.pendingConfirm = null;
        if (answer === 'y' || answer === 'yes') {
          dev.savedStartupConfig = JSON.stringify(dev.wlcConfig, null, 2);
          this.print("Configuration Saved!");
          this.triggerScoreUpdate();
        } else {
          this.print("Configuration Not Saved.");
        }
      } else if (this.pendingConfirm === 'reset_system') {
        this.pendingConfirm = null;
        if (answer === 'y' || answer === 'yes') {
          this.print("Restarting system.\nController is rebooting...\nSystem ready.");
          if (typeof dev.factoryReset === 'function') dev.factoryReset();
          this.initDeviceDefaults();
          this.triggerScoreUpdate();
        } else {
          this.print("Reset cancelled.");
        }
      }
      this.updatePrompt(this.getPrompt());
      return;
    }

    if (!line) {
      this.print("");
      this.updatePrompt(this.getPrompt());
      return;
    }

    if (!dev.history) dev.history = [];
    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    const lower = line.toLowerCase();
    const tokens = line.split(/\s+/);
    const cmd = tokens[0].toLowerCase();

    // Cisco IOS compatibility trap warning (Help students understand AireOS vs IOS)
    if (lower === 'enable' || lower === 'en') {
      this.print("Note: AireOS does not require 'enable' mode. All commands execute directly from the active CLI prompt.");
      this.updatePrompt(this.getPrompt());
      return;
    }
    if (lower.startsWith('conf') || lower === 'configure terminal') {
      this.print("Note: AireOS has no 'configure terminal' context. Use direct 'config <subcommand>' syntax (e.g. 'config wlan create ...').");
      this.updatePrompt(this.getPrompt());
      return;
    }
    if (lower === 'write' || lower === 'wr' || lower.startsWith('copy run')) {
      this.print("Note: In AireOS, use 'save config' to commit changes to flash memory.");
      this.updatePrompt(this.getPrompt());
      return;
    }

    // Help commands
    if (cmd === 'help' || cmd === '?') {
      this.printHelp();
      this.updatePrompt(this.getPrompt());
      return;
    }

    // Show commands
    if (cmd === 'show') {
      this.handleShow(tokens.slice(1));
      this.updatePrompt(this.getPrompt());
      return;
    }

    // Config commands
    if (cmd === 'config') {
      this.handleConfig(tokens.slice(1));
      this.updatePrompt(this.getPrompt());
      return;
    }

    // Save config
    if (lower === 'save config') {
      this.pendingConfirm = 'save_config';
      this.print("Are you sure you want to save? (y/n)");
      this.updatePrompt(this.getPrompt());
      return;
    }

    // Reset system
    if (lower === 'reset system' || lower === 'reset') {
      this.pendingConfirm = 'reset_system';
      this.print("Are you sure you want to reset system? (y/n)");
      this.updatePrompt(this.getPrompt());
      return;
    }

    // Ping command
    if (cmd === 'ping') {
      this.handlePing(tokens.slice(1));
      this.updatePrompt(this.getPrompt());
      return;
    }

    // Clear screen
    if (cmd === 'clear') {
      const screen = document.getElementById('cliTerminalScreen');
      if (screen) screen.innerHTML = '';
      this.updatePrompt(this.getPrompt());
      return;
    }

    this.print(`Incorrect usage. Use the '?' or 'help' command to view available commands.`);
    this.updatePrompt(this.getPrompt());
  }

  handleShow(args) {
    const dev = this.device;
    const cfg = dev.wlcConfig;
    if (!args.length) {
      this.print("Incorrect usage: show <sysinfo|wlan|interface|ap|client|run-config>");
      return;
    }
    const sub = args[0].toLowerCase();

    if (sub === 'sysinfo') {
      this.print(`Manufacturer's Name.............................. Cisco Systems Inc.`);
      this.print(`Product Name..................................... Cisco 3504 Wireless LAN Controller`);
      this.print(`Product Version.................................. 8.10.190.0`);
      this.print(`RTOS Version..................................... 8.10.190.0`);
      this.print(`Bootloader Version............................... 8.5.103.0`);
      this.print(`System Name...................................... ${cfg.systemName || dev.hostname || 'Cisco_3504'}`);
      this.print(`System Location.................................. ${cfg.systemLocation || 'PXL Campus Hasselt'}`);
      this.print(`System Contact................................... ${cfg.systemContact || 'noc@pxl.be'}`);
      this.print(`IP Address....................................... ${cfg.mgmtIp || dev.ip || '10.10.0.254'}`);
      this.print(`IP Netmask....................................... ${cfg.mgmtMask || dev.mask || '255.255.255.0'}`);
      this.print(`IP Gateway....................................... ${cfg.mgmtGateway || dev.defaultGateway || '10.10.0.1'}`);
      this.print(`MAC Address...................................... ${dev.interfaces['GigabitEthernet0/1']?.mac || '00:24:97:aa:01:00'}`);
      this.print(`Maximum Number of APs Supported.................. 150`);
      this.print(`Active APs....................................... 1`);
      this.print(`Active Clients................................... 2`);
      return;
    }

    if (sub === 'wlan') {
      if (args[1] && args[1].toLowerCase() === 'summary') {
        const wlans = cfg.wlans || [];
        this.print(`Number of WLANs.................................. ${wlans.length}\n`);
        this.print(`WLAN ID  WLAN Profile Name    SSID               Status    Interface Name`);
        this.print(`-------  -------------------  -----------------  --------  --------------------`);
        for (const w of wlans) {
          const idStr = String(w.id).padEnd(9, ' ');
          const profStr = (w.profile || `WLAN-${w.id}`).padEnd(21, ' ');
          const ssidStr = (w.ssid || '').padEnd(19, ' ');
          const statStr = (w.status || 'Enabled').padEnd(10, ' ');
          const intfStr = `${w.intf || 'management'} (VLAN ${w.vlan || 10})`;
          this.print(`${idStr}${profStr}${ssidStr}${statStr}${intfStr}`);
        }
        return;
      }

      const wlanId = parseInt(args[1], 10);
      const w = (cfg.wlans || []).find(x => x.id === wlanId);
      if (w) {
        this.print(`WLAN Identifier.................................. ${w.id}`);
        this.print(`Profile Name..................................... ${w.profile}`);
        this.print(`Network Name (SSID).............................. ${w.ssid}`);
        this.print(`Status........................................... ${w.status}`);
        this.print(`Interface........................................ ${w.intf} (VLAN ${w.vlan})`);
        this.print(`Broadcast SSID................................... Enabled`);
        this.print(`Security Mode.................................... ${w.authMode}`);
        if (w.authMode.includes('PSK')) {
          this.print(`WPA2-PSK Key..................................... ${w.passphrase || '<not configured>'}`);
        }
        return;
      }
      this.print("Incorrect usage: show wlan summary or show wlan <id>");
      return;
    }

    if (sub === 'interface' || sub === 'int') {
      if (args[1] && args[1].toLowerCase() === 'summary') {
        this.print(`Interface Name                   Port Vlan Id  IP Address      Type    Ap Mgr Guest`);
        this.print(`-------------------------------- ---- -------- --------------- ------- ------ -----`);
        for (const [k, intf] of Object.entries(cfg.interfaces || {})) {
          const nameStr = intf.name.padEnd(33, ' ');
          const portStr = String(intf.port || 1).padEnd(5, ' ');
          const vlanStr = String(intf.vlan || 0).padEnd(9, ' ');
          const ipStr = (intf.ip || '0.0.0.0').padEnd(16, ' ');
          const typeStr = (intf.type || 'Dynamic').padEnd(8, ' ');
          const apMgr = (intf.name === 'management' ? 'Yes' : 'No').padEnd(7, ' ');
          const guest = (intf.name.includes('guest') ? 'Yes' : 'No');
          this.print(`${nameStr}${portStr}${vlanStr}${ipStr}${typeStr}${apMgr}${guest}`);
        }
        return;
      }

      const intfName = args[1];
      const intf = cfg.interfaces && cfg.interfaces[intfName];
      if (intf) {
        this.print(`Interface Name................................... ${intf.name}`);
        this.print(`MAC Address...................................... ${dev.interfaces['GigabitEthernet0/1']?.mac || '00:24:97:aa:01:00'}`);
        this.print(`IP Address....................................... ${intf.ip}`);
        this.print(`IP Netmask....................................... ${intf.mask}`);
        this.print(`IP Gateway....................................... ${intf.gateway}`);
        this.print(`VLAN Identifier.................................. ${intf.vlan}`);
        this.print(`Primary Physical Port............................ ${intf.port || 1}`);
        this.print(`Primary DHCP Server.............................. ${intf.dhcpServer || intf.gateway}`);
        return;
      }
      this.print("Incorrect usage: show interface summary or show interface detailed <name>");
      return;
    }

    if (sub === 'ap') {
      this.print(`Number of APs.................................... 1\n`);
      this.print(`AP Name             Slots  AP Model              Ethernet MAC       Location          Port  Country  Priority`);
      this.print(`------------------  -----  --------------------  -----------------  ----------------  ----  -------  ------`);
      this.print(`LAP-1               2      AIR-CAP3702I-E-K9     00:21:d8:bb:01:10  PXL Lokaal A102   1     BE       1`);
      return;
    }

    if (sub === 'client') {
      const sim = window.PXLNetworkSim;
      const associated = [];
      if (sim && sim.wirelessAssociations) {
        for (const [clientId, apId] of Object.entries(sim.wirelessAssociations)) {
          if (apId === dev.id) {
            const cDev = sim.devices[clientId];
            if (cDev) associated.push(cDev);
          }
        }
      }
      this.print(`Number of Connected Clients...................... ${associated.length}\n`);
      this.print(`MAC Address        AP Name   WLAN  State            Protocol  IP Address`);
      this.print(`-----------------  --------  ----  ---------------  --------  ---------------`);
      for (const c of associated) {
        const mac = (c.interfaces['Wireless0']?.mac || '00:14:69:aa:01:01').padEnd(19, ' ');
        const ap = 'LAP-1'.padEnd(10, ' ');
        const wlan = (c.wireless?.ssid || 'WLAN').padEnd(6, ' ');
        const state = 'Associated'.padEnd(17, ' ');
        const proto = '802.11ac'.padEnd(10, ' ');
        const ip = c.ip || '0.0.0.0';
        this.print(`${mac}${ap}${wlan}${state}${proto}${ip}`);
      }
      return;
    }

    if (sub === 'run-config' || sub === 'running-config') {
      this.print(`Current configuration on ${cfg.systemName || dev.hostname}:\n`);
      this.print(`config sysname ${cfg.systemName || dev.hostname}`);
      this.print(`config location ${cfg.systemLocation}`);
      for (const [k, intf] of Object.entries(cfg.interfaces || {})) {
        if (k !== 'management' && k !== 'virtual') {
          this.print(`config interface create ${intf.name} ${intf.vlan}`);
        }
        this.print(`config interface address ${intf.name} ${intf.ip} ${intf.mask} ${intf.gateway}`);
      }
      for (const w of (cfg.wlans || [])) {
        this.print(`config wlan create ${w.id} ${w.profile} ${w.ssid}`);
        this.print(`config wlan interface ${w.id} ${w.intf}`);
        if (w.authMode.includes('PSK')) {
          this.print(`config wlan security wpa enable ${w.id}`);
          this.print(`config wlan security wpa akm psk set-key ascii ${w.passphrase} ${w.id}`);
        }
        if (w.status === 'Enabled') {
          this.print(`config wlan enable ${w.id}`);
        }
      }
      return;
    }

    this.print(`Unknown show command: 'show ${args.join(' ')}'. Type '?' for help.`);
  }

  handleConfig(args) {
    const dev = this.device;
    const cfg = dev.wlcConfig;
    if (!args.length) {
      this.print("Incorrect usage: config <sysname|wlan|interface>");
      return;
    }
    const topic = args[0].toLowerCase();

    // config sysname <name>
    if (topic === 'sysname') {
      if (args[1]) {
        cfg.systemName = args[1].trim();
        dev.hostname = cfg.systemName;
        this.print(`System name updated to ${cfg.systemName}`);
        this.triggerScoreUpdate();
        return;
      }
      this.print("Usage: config sysname <system-name>");
      return;
    }

    // config wlan <create|delete|enable|disable|interface|security>
    if (topic === 'wlan') {
      const action = args[1]?.toLowerCase();

      // config wlan create <id> <profile> <ssid>
      if (action === 'create') {
        const id = parseInt(args[2], 10);
        const profile = args[3];
        const ssid = args[4] || profile;
        if (!id || !profile) {
          this.print("Usage: config wlan create <wlan-id> <profile-name> <ssid>");
          return;
        }
        if (!cfg.wlans) cfg.wlans = [];
        let existing = cfg.wlans.find(w => w.id === id);
        if (existing) {
          existing.profile = profile;
          existing.ssid = ssid;
        } else {
          cfg.wlans.push({
            id,
            profile,
            ssid,
            status: 'Disabled',
            intf: 'management',
            vlan: 10,
            authMode: 'WPA2-PSK',
            passphrase: 'CiscoPassword123!'
          });
        }
        this.print(`WLAN ${id} created with profile '${profile}' and SSID '${ssid}'.`);
        this.refreshSim();
        return;
      }

      // config wlan enable <id> / config wlan disable <id>
      if (action === 'enable' || action === 'disable') {
        const id = parseInt(args[2], 10);
        const w = (cfg.wlans || []).find(x => x.id === id);
        if (!w) {
          this.print(`Error: WLAN ${id} does not exist.`);
          return;
        }
        w.status = (action === 'enable') ? 'Enabled' : 'Disabled';
        this.print(`WLAN ${id} is now ${w.status}.`);
        this.refreshSim();
        return;
      }

      // config wlan delete <id>
      if (action === 'delete') {
        const id = parseInt(args[2], 10);
        cfg.wlans = (cfg.wlans || []).filter(x => x.id !== id);
        this.print(`WLAN ${id} deleted.`);
        this.refreshSim();
        return;
      }

      // config wlan interface <id> <interface-name>
      if (action === 'interface') {
        const id = parseInt(args[2], 10);
        const intfName = args[3];
        const w = (cfg.wlans || []).find(x => x.id === id);
        if (!w) {
          this.print(`Error: WLAN ${id} does not exist.`);
          return;
        }
        const intf = cfg.interfaces && cfg.interfaces[intfName];
        if (!intf) {
          this.print(`Error: Interface '${intfName}' not found on controller.`);
          return;
        }
        w.intf = intfName;
        w.vlan = intf.vlan;
        this.print(`WLAN ${id} mapped to interface '${intfName}' (VLAN ${w.vlan}).`);
        this.refreshSim();
        return;
      }

      // config wlan security ...
      if (action === 'security') {
        // config wlan security wpa enable <id>
        // config wlan security wpa akm psk set-key ascii <key> <id>
        const secProto = args[2]?.toLowerCase();
        if (secProto === 'wpa') {
          if (args[3]?.toLowerCase() === 'enable') {
            const id = parseInt(args[4], 10);
            const w = (cfg.wlans || []).find(x => x.id === id);
            if (w) {
              w.authMode = 'WPA2-PSK';
              this.print(`WPA/WPA2 security enabled on WLAN ${id}.`);
              this.refreshSim();
              return;
            }
          }
          if (args[3]?.toLowerCase() === 'disable') {
            const id = parseInt(args[4], 10);
            const w = (cfg.wlans || []).find(x => x.id === id);
            if (w) {
              w.authMode = 'Open';
              this.print(`WPA/WPA2 security disabled on WLAN ${id} (Open authentication).`);
              this.refreshSim();
              return;
            }
          }
          if (args[3]?.toLowerCase() === 'akm' && args[4]?.toLowerCase() === 'psk' && args[5]?.toLowerCase() === 'set-key' && args[6]?.toLowerCase() === 'ascii') {
            const key = args[7];
            const id = parseInt(args[8], 10);
            const w = (cfg.wlans || []).find(x => x.id === id);
            if (w && key) {
              w.authMode = 'WPA2-PSK';
              w.passphrase = key;
              this.print(`WPA2-PSK passphrase set for WLAN ${id}.`);
              this.refreshSim();
              return;
            }
          }
        }
      }

      this.print("Incorrect usage: config wlan <create|delete|enable|disable|interface|security>");
      return;
    }

    // config interface <create|address|port|dhcp>
    if (topic === 'interface') {
      const action = args[1]?.toLowerCase();

      // config interface create <name> <vlan-id>
      if (action === 'create') {
        const name = args[2];
        const vlan = parseInt(args[3], 10);
        if (!name || isNaN(vlan)) {
          this.print("Usage: config interface create <name> <vlan-id>");
          return;
        }
        if (!cfg.interfaces) cfg.interfaces = {};
        cfg.interfaces[name] = {
          name,
          vlan,
          ip: '0.0.0.0',
          mask: '255.255.255.0',
          gateway: '0.0.0.0',
          port: 1,
          type: 'Dynamic'
        };
        this.print(`Dynamic interface '${name}' created and bound to VLAN ${vlan}.`);
        this.refreshSim();
        return;
      }

      // config interface address <name> <ip> <netmask> <gateway>
      if (action === 'address') {
        const name = args[2];
        const ip = args[3];
        const mask = args[4];
        const gw = args[5];
        if (!name || !ip || !mask) {
          this.print("Usage: config interface address <interface-name> <ip-address> <netmask> [gateway]");
          return;
        }
        if (cfg.interfaces && cfg.interfaces[name]) {
          cfg.interfaces[name].ip = ip;
          cfg.interfaces[name].mask = mask;
          if (gw) cfg.interfaces[name].gateway = gw;
          if (name === 'management') {
            cfg.mgmtIp = ip;
            cfg.mgmtMask = mask;
            if (gw) cfg.mgmtGateway = gw;
            dev.ip = ip;
            dev.mask = mask;
            if (gw) dev.defaultGateway = gw;
          }
          this.print(`Interface '${name}' configured with IP ${ip} / ${mask}.`);
          this.refreshSim();
          return;
        }
        this.print(`Error: Interface '${name}' does not exist.`);
        return;
      }

      this.print("Incorrect usage: config interface <create|address>");
      return;
    }

    this.print(`Unknown config command: 'config ${args.join(' ')}'. Type '?' for help.`);
  }

  handlePing(args) {
    if (!args.length) {
      this.print("Usage: ping <ip-address>");
      return;
    }
    const targetIp = args[0];
    const sim = window.PXLNetworkSim;
    if (!sim) {
      this.print(`Ping ${targetIp}: simulator not available.`);
      return;
    }

    this.print(`Sending 5, 32-byte ICMP Echos to ${targetIp}, timeout is 2 seconds:`);
    const res = sim.executePing(this.device.id, targetIp);
    if (res.success) {
      this.print("!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/3/7 ms");
    } else {
      this.print(".....\nSuccess rate is 0 percent (0/5)");
    }
  }

  refreshSim() {
    const sim = window.PXLNetworkSim;
    if (sim && typeof sim.updateWirelessAssociations === 'function') {
      sim.updateWirelessAssociations();
    }
    if (window.PXLApp) {
      window.PXLApp.canvasWorkspace.render();
      this.triggerScoreUpdate();
    }
  }

  printHelp() {
    this.print("\nAireOS Command Summary (Cisco 3504 Wireless LAN Controller):");
    this.print("  show sysinfo                                Display controller hardware and software info");
    this.print("  show wlan summary                           Display list of configured WLANs");
    this.print("  show wlan <id>                              Display detailed WLAN settings");
    this.print("  show interface summary                      Display controller interfaces and VLANs");
    this.print("  show interface detailed <name>              Display interface IP, netmask, and VLAN");
    this.print("  show ap summary                             Display registered lightweight APs");
    this.print("  show client summary                         Display associated wireless clients");
    this.print("  show run-config                             Display full running configuration");
    this.print("  config sysname <name>                       Change controller hostname");
    this.print("  config wlan create <id> <profile> <ssid>    Create a new WLAN profile");
    this.print("  config wlan enable / disable <id>           Enable or disable a WLAN");
    this.print("  config wlan interface <id> <intf-name>      Map WLAN to dynamic interface / VLAN");
    this.print("  config wlan security wpa enable <id>        Enable WPA/WPA2 security");
    this.print("  config wlan security wpa akm psk set-key ascii <key> <id>  Set WPA2-PSK key");
    this.print("  config interface create <name> <vlan-id>    Create dynamic interface mapped to VLAN");
    this.print("  config interface address <name> <ip> <mask> [gw] Configure interface IP address");
    this.print("  save config                                 Save active configuration to flash memory");
    this.print("  reset system                                Reboot the controller");
    this.print("  ping <ip>                                   Test ICMP reachability from controller\n");
  }

  tabComplete(inputLine) {
    if (!inputLine) return "";
    const raw = inputLine.trim();
    const grammar = [
      'show sysinfo', 'show wlan summary', 'show interface summary', 'show ap summary',
      'show client summary', 'show run-config', 'save config', 'reset system',
      'config sysname', 'config wlan create', 'config wlan enable', 'config wlan disable',
      'config wlan interface', 'config wlan security wpa enable', 'config interface create',
      'config interface address', 'ping', 'help'
    ];
    const match = grammar.find(g => g.startsWith(raw.toLowerCase()));
    if (match) return match + ' ';
    return inputLine;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AireOSCLIParser };
}
