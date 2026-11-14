/**
 * openwrt_cli.js - OpenWrt 23.05 Linux Shell (BusyBox Ash) Parser
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class OpenWrtCLIParser {
  constructor(device, printCallback, updatePromptCallback, triggerScoreUpdate) {
    this.device = device;
    this.print = printCallback || console.log;
    this.updatePrompt = updatePromptCallback || (() => {});
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});

    this.initDeviceDefaults();
  }

  initDeviceDefaults() {
    const dev = this.device;
    if (!dev.openwrtConfig) {
      dev.openwrtConfig = {
        hostname: dev.hostname || 'OpenWrt',
        rootPassword: '',
        uciStaged: {},
        network: {
          lan: {
            ipaddr: dev.interfaces['eth1']?.ip || '192.168.1.1',
            netmask: dev.interfaces['eth1']?.mask || '255.255.255.0',
            proto: 'static',
            device: 'br-lan'
          },
          wan: {
            ipaddr: dev.interfaces['eth0']?.ip || '',
            netmask: dev.interfaces['eth0']?.mask || '',
            gateway: dev.defaultGateway || '',
            proto: 'dhcp',
            device: 'eth0'
          }
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

    const tokens = line.split(/\s+/);
    const cmd = tokens[0].toLowerCase();

    // 1. Exit / Logout
    if (cmd === 'exit' || cmd === 'logout') {
      this.print(`Connection to ${dev.openwrtConfig.hostname} closed.`);
      return;
    }

    // 2. cat /etc/banner
    if (cmd === 'cat') {
      this.handleCat(tokens.slice(1));
      return;
    }

    // 3. uci
    if (cmd === 'uci') {
      this.handleUci(tokens.slice(1));
      return;
    }

    // 4. ifconfig / ip addr
    if (cmd === 'ifconfig') {
      this.handleIfconfig(tokens.slice(1));
      return;
    }
    if (cmd === 'ip') {
      this.handleIpCmd(tokens.slice(1));
      return;
    }

    // 5. route / ip route
    if (cmd === 'route') {
      this.handleRoute();
      return;
    }

    // 6. /etc/init.d/network restart
    if (line === '/etc/init.d/network restart' || line === 'service network restart') {
      this.print("Restarting network service...");
      this.applyUciChanges();
      this.print("network: interface 'lan' is up");
      this.print("network: interface 'wan' is up");
      return;
    }

    // 7. ping
    if (cmd === 'ping') {
      this.handlePing(tokens.slice(1));
      return;
    }

    // 7b. traceroute
    if (cmd === 'traceroute') {
      this.handleTraceroute(tokens.slice(1));
      return;
    }

    // 7c. nslookup
    if (cmd === 'nslookup') {
      this.handleNslookup(tokens.slice(1));
      return;
    }

    // 7d. uname
    if (cmd === 'uname') {
      if (tokens.includes('-a')) {
        this.print("Linux OpenWrt 5.15.137 #0 SMP Wed Nov 15 12:00:00 2023 mips GNU/Linux");
      } else {
        this.print("Linux");
      }
      return;
    }

    // 7e. uptime
    if (cmd === 'uptime') {
      this.print(" 12:34:56 up 2 days,  4:12,  load average: 0.05, 0.08, 0.02");
      return;
    }

    // 7f. free
    if (cmd === 'free') {
      this.print("              total        used        free      shared  buff/cache   available");
      this.print("Mem:         128456       34212       94244        1024       12800       91200");
      this.print("Swap:             0           0           0");
      return;
    }

    // 7g. df
    if (cmd === 'df') {
      this.print("Filesystem           1K-blocks      Used Available Use% Mounted on");
      this.print("/dev/root                12288     12288         0 100% /rom");
      this.print("tmpfs                    64228       612     63616   1% /tmp");
      this.print("/dev/mtdblock3           16384      1420     14964   9% /overlay");
      this.print("overlayfs:/overlay       16384      1420     14964   9% /");
      return;
    }

    // 7h. ps
    if (cmd === 'ps') {
      this.print("  PID USER       VSZ STAT COMMAND");
      this.print("    1 root      1420 S    /sbin/init");
      this.print("  412 root       980 S    /sbin/ubusd");
      this.print("  650 root      1240 S    /sbin/netifd");
      this.print("  890 root      1120 S    /usr/sbin/dropbear -F -P /var/run/dropbear.1.pid");
      this.print(" 1205 root      1340 S    /usr/sbin/dnsmasq -k");
      this.print(" 1430 root      1210 S    /bin/ash --login");
      return;
    }

    // 8. passwd
    if (cmd === 'passwd') {
      this.print("Changing password for root.");
      this.print("New password: *******\nRetype password: *******\npasswd: password for root changed by root");
      return;
    }

    // 9. reboot
    if (cmd === 'reboot') {
      this.print("OpenWrt is rebooting...\n");
      setTimeout(() => {
        this.printOpenWrtBanner();
        if (this.updatePrompt) this.updatePrompt();
      }, 500);
      return;
    }

    // 10. help
    if (cmd === 'help') {
      this.print("BusyBox v1.36.1 (ash) built-in commands:");
      this.print("  uci show network                     Show network configuration");
      this.print("  uci set network.lan.ipaddr='<ip>'    Configure LAN IP address");
      this.print("  uci commit network                   Commit and apply UCI changes");
      this.print("  /etc/init.d/network restart          Reload network interfaces");
      this.print("  ifconfig / ip addr                   Show interface status");
      this.print("  cat /etc/banner                      Show OpenWrt system banner");
      this.print("  ping <ip>                            Test network reachability");
      this.print("");
      return;
    }

    this.print(`ash: ${cmd}: not found`);
  }

  handleCat(args) {
    if (args.length === 0) {
      this.print("cat: missing file operand");
      return;
    }
    const target = args[0];
    if (target === '/etc/banner') {
      this.printOpenWrtBanner();
      return;
    }
    if (target === '/etc/config/network') {
      this.print("config interface 'loopback'");
      this.print("        option device 'lo'");
      this.print("        option proto 'static'");
      this.print("        option ipaddr '127.0.0.1'");
      this.print("        option netmask '255.0.0.0'\n");
      this.print("config interface 'lan'");
      this.print("        option device 'br-lan'");
      this.print("        option proto 'static'");
      this.print(`        option ipaddr '${this.device.openwrtConfig.network.lan.ipaddr}'`);
      this.print(`        option netmask '${this.device.openwrtConfig.network.lan.netmask}'\n`);
      this.print("config interface 'wan'");
      this.print("        option device 'eth0'");
      this.print(`        option proto '${this.device.openwrtConfig.network.wan.proto}'`);
      if (this.device.openwrtConfig.network.wan.ipaddr) {
        this.print(`        option ipaddr '${this.device.openwrtConfig.network.wan.ipaddr}'`);
        this.print(`        option netmask '${this.device.openwrtConfig.network.wan.netmask}'`);
        this.print(`        option gateway '${this.device.openwrtConfig.network.wan.gateway}'`);
      }
      return;
    }
    this.print(`cat: can't open '${target}': No such file or directory`);
  }

  handleUci(args) {
    if (args.length === 0) {
      this.print("Usage: uci [<options>] <command> [<arguments>]");
      this.print("Commands: show, set, get, commit, changes");
      return;
    }

    const sub = args[0].toLowerCase();
    const cfg = this.device.openwrtConfig;

    if (sub === 'show') {
      this.print("network.loopback=interface");
      this.print("network.loopback.device='lo'");
      this.print("network.loopback.proto='static'");
      this.print("network.loopback.ipaddr='127.0.0.1'");
      this.print("network.loopback.netmask='255.0.0.0'");
      this.print("network.lan=interface");
      this.print("network.lan.device='br-lan'");
      this.print("network.lan.proto='static'");
      this.print(`network.lan.ipaddr='${cfg.network.lan.ipaddr}'`);
      this.print(`network.lan.netmask='${cfg.network.lan.netmask}'`);
      this.print("network.wan=interface");
      this.print("network.wan.device='eth0'");
      this.print(`network.wan.proto='${cfg.network.wan.proto}'`);
      if (cfg.network.wan.ipaddr) {
        this.print(`network.wan.ipaddr='${cfg.network.wan.ipaddr}'`);
        this.print(`network.wan.netmask='${cfg.network.wan.netmask}'`);
        this.print(`network.wan.gateway='${cfg.network.wan.gateway}'`);
      }
      return;
    }

    if (sub === 'set') {
      if (args.length < 2) {
        this.print("uci: missing argument for 'set'");
        return;
      }
      const expr = args.slice(1).join(' ');
      const match = expr.match(/([a-zA-Z0-9_\.]+)=['"]?([^'"]+)['"]?/);
      if (match) {
        const key = match[1];
        const val = match[2];
        cfg.uciStaged[key] = val;
        this.print("");
        return;
      }
      this.print("uci: syntax error in set expression");
      return;
    }

    if (sub === 'commit') {
      this.applyUciChanges();
      this.print("");
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }

    if (sub === 'changes') {
      const keys = Object.keys(cfg.uciStaged);
      if (keys.length === 0) {
        this.print("No staged UCI changes.");
        return;
      }
      for (const k of keys) {
        this.print(`+${k}='${cfg.uciStaged[k]}'`);
      }
      return;
    }

    this.print(`uci: unknown command '${sub}'`);
  }

  applyUciChanges() {
    const dev = this.device;
    const cfg = dev.openwrtConfig;

    for (const [k, v] of Object.entries(cfg.uciStaged)) {
      if (k === 'network.lan.ipaddr') cfg.network.lan.ipaddr = v;
      if (k === 'network.lan.netmask') cfg.network.lan.netmask = v;
      if (k === 'network.wan.ipaddr') cfg.network.wan.ipaddr = v;
      if (k === 'network.wan.netmask') cfg.network.wan.netmask = v;
      if (k === 'network.wan.gateway') {
        cfg.network.wan.gateway = v;
        dev.defaultGateway = v;
      }
      if (k === 'system.@system[0].hostname') {
        cfg.hostname = v;
        dev.hostname = v;
        dev.displayName = v;
        if (this.updatePrompt) this.updatePrompt();
      }
    }

    // Apply to hardware interfaces
    if (dev.interfaces['eth1']) {
      dev.interfaces['eth1'].ip = cfg.network.lan.ipaddr;
      dev.interfaces['eth1'].mask = cfg.network.lan.netmask;
      dev.interfaces['eth1'].shutdown = false;
    }
    if (dev.interfaces['eth0'] && cfg.network.wan.ipaddr) {
      dev.interfaces['eth0'].ip = cfg.network.wan.ipaddr;
      dev.interfaces['eth0'].mask = cfg.network.wan.netmask || '255.255.255.0';
      dev.interfaces['eth0'].shutdown = false;
    }

    // Add static default route if WAN gateway configured
    if (cfg.network.wan.gateway) {
      dev.staticRoutes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: cfg.network.wan.gateway }];
    }

    cfg.uciStaged = {};
  }

  handleIfconfig(args) {
    const dev = this.device;
    const cfg = dev.openwrtConfig;

    this.print(`br-lan    Link encap:Ethernet  HWaddr ${dev.interfaces['eth1']?.mac || '52:54:00:12:34:56'}`);
    this.print(`          inet addr:${cfg.network.lan.ipaddr}  Bcast:192.168.1.255  Mask:${cfg.network.lan.netmask}`);
    this.print(`          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1`);
    this.print(`          RX packets:1240 errors:0 dropped:0 overruns:0 frame:0`);
    this.print(`          TX packets:1189 errors:0 dropped:0 overruns:0 carrier:0\n`);

    this.print(`eth0      Link encap:Ethernet  HWaddr ${dev.interfaces['eth0']?.mac || '52:54:00:12:34:55'}`);
    const wanIp = cfg.network.wan.ipaddr || '0.0.0.0';
    const wanMask = cfg.network.wan.netmask || '0.0.0.0';
    this.print(`          inet addr:${wanIp}  Mask:${wanMask}`);
    this.print(`          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1\n`);

    this.print(`lo        Link encap:Local Loopback`);
    this.print(`          inet addr:127.0.0.1  Mask:255.0.0.0`);
    this.print(`          UP LOOPBACK RUNNING  MTU:65536  Metric:1\n`);
  }

  handleIpCmd(args) {
    if (args.length === 0 || args[0].toLowerCase() === 'a' || args[0].toLowerCase() === 'addr') {
      this.handleIfconfig([]);
      return;
    }
    if (args[0].toLowerCase() === 'route' || args[0].toLowerCase() === 'r') {
      this.handleRoute();
      return;
    }
  }

  handleRoute() {
    const dev = this.device;
    const cfg = dev.openwrtConfig;
    this.print("Kernel IP routing table");
    this.print("Destination     Gateway         Genmask         Flags Metric Ref    Use Iface");
    if (cfg.network.wan.gateway) {
      this.print(`0.0.0.0         ${cfg.network.wan.gateway.padEnd(15, ' ')} 0.0.0.0         UG    0      0        0 eth0`);
    }
    this.print(`192.168.1.0     0.0.0.0         255.255.255.0   U     0      0        0 br-lan`);
    this.print("");
  }

  handlePing(args) {
    if (args.length === 0) {
      this.print("ping: missing host operand");
      return;
    }
    const target = args[0];
    this.print(`PING ${target} (${target}): 56 data bytes`);
    if (window.PXLNetworkSim) {
      const res = window.PXLNetworkSim.executePing(this.device.id, target);
      for (let seq = 1; seq <= 4; seq++) {
        if (res.success) {
          const ms = 2 + Math.floor(Math.random() * 6);
          this.print(`64 bytes from ${target}: seq=${seq} ttl=64 time=${ms}.4 ms`);
        } else {
          this.print(`Request timeout for icmp_seq ${seq}`);
        }
      }
      if (res.success) {
        this.print(`--- ${target} ping statistics ---`);
        this.print(`4 packets transmitted, 4 packets received, 0% packet loss\n`);
      } else {
        this.print(`--- ${target} ping statistics ---`);
        this.print(`4 packets transmitted, 0 packets received, 100% packet loss\n`);
      }
    }
  }

  handleTraceroute(args) {
    if (args.length === 0) {
      this.print("traceroute: missing host operand");
      return;
    }
    const target = args[0];
    this.print(`traceroute to ${target} (${target}), 30 hops max, 38 byte packets`);
    const sim = window.PXLApp?.sim || window.PXLNetworkSim;
    if (sim && typeof sim.executeTraceroute === 'function') {
      const hops = sim.executeTraceroute(this.device.id, target);
      if (hops && hops.length > 0) {
        hops.forEach((h, idx) => {
          this.print(` ${idx + 1}  ${h.ip || h.name}  ${h.rtt || '2.145'} ms  ${h.rtt2 || '2.089'} ms  ${h.rtt3 || '2.112'} ms`);
        });
      } else {
        this.print(` 1  * * *`);
        this.print(` 2  * * *`);
      }
    } else {
      this.print(` 1  ${target}  1.821 ms  1.654 ms  1.712 ms`);
    }
    this.print("");
  }

  handleNslookup(args) {
    if (args.length === 0) {
      this.print("nslookup: missing host operand");
      return;
    }
    const query = args[0];
    const sim = window.PXLApp?.sim;
    const dnsServer = this.device.defaultGateway || '192.168.1.1';
    this.print(`Server:    ${dnsServer}`);
    this.print(`Address:   ${dnsServer}#53\n`);

    if (sim && typeof sim.resolveDns === 'function') {
      const res = sim.resolveDns(this.device.id, query);
      if (res && res.success) {
        if (res.type === 'PTR') {
          this.print(`${query}.in-addr.arpa\tname = ${res.hostname}`);
        } else {
          this.print(`Name:      ${query}`);
          this.print(`Address 1: ${res.ip}`);
        }
      } else {
        this.print(`** server can't find ${query}: NXDOMAIN`);
      }
    } else {
      this.print(`Name:      ${query}`);
      this.print(`Address 1: 192.168.1.10`);
    }
    this.print("");
  }

  printOpenWrtBanner() {
    this.print(`  _______                     ________        __`);
    this.print(` |       |.-----.-----.-----.|  |  |  |.----.|  |_`);
    this.print(` |   -   ||  _  |  -__|     ||  |  |  ||   _||   _|`);
    this.print(` |_______||   __|_____|__|__||________||__|  |____|`);
    this.print(`          |__| W I R E L E S S   F R E E D O M`);
    this.print(` -----------------------------------------------------`);
    this.print(` OpenWrt 23.05.2, r23630-94290f9e3d`);
    this.print(` -----------------------------------------------------\n`);
  }

  tabComplete(inputLine) {
    if (!inputLine) return "";
    const raw = inputLine.trim();
    const openwrtGrammar = [
      '/etc/init.d/network restart',
      'cat /etc/banner',
      'cat /etc/config/network',
      'ifconfig',
      'ip addr',
      'ip route',
      'ping',
      'reboot',
      'route -n',
      'uci commit network',
      'uci set network.lan.ipaddr=',
      'uci set network.lan.netmask=',
      'uci set network.wan.gateway=',
      'uci set network.wan.ipaddr=',
      'uci show network'
    ];

    const match = openwrtGrammar.find(g => g.startsWith(raw));
    if (match) return match + ' ';
    return inputLine;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OpenWrtCLIParser };
}

