/**
 * pc_desktop.js - PC / Laptop Desktop Environment & Command Prompt
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class PCDesktopHandler {
  constructor(device, printCallback, triggerScoreUpdate) {
    this.device = device;
    this.print = printCallback || console.log;
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});
  }

  handleCommand(rawLine) {
    const dev = this.device;
    const line = rawLine.trim();
    if (!line) {
      this.print("");
      return;
    }

    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    const parts = line.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case 'ipconfig':
        this.handleIpconfig(parts.slice(1));
        break;
      case 'ping':
        this.handlePing(parts.slice(1));
        break;
      case 'tracert':
      case 'traceroute':
        this.handleTracert(parts.slice(1));
        break;
      case 'cls':
      case 'clear':
        if (window.PXLApp) window.PXLApp.clearActiveTerminal();
        break;
      case 'help':
        this.print("Supported commands: ipconfig, ipconfig /all, ping <ip>, tracert <ip>, cls");
        break;
      default:
        this.print(`'${cmd}' is not recognized as an internal or external command.`);
    }

    if (this.triggerScoreUpdate) this.triggerScoreUpdate();
  }

  handleIpconfig(args) {
    const dev = this.device;
    const isAll = args.includes('/all') || args.includes('-all');

    this.print("\nWindows IP Configuration\n");
    if (isAll) {
      this.print(`   Host Name . . . . . . . . . . . . : ${dev.hostname}`);
      this.print(`   Primary Dns Suffix  . . . . . . . : pxl.be`);
      this.print(`   Node Type . . . . . . . . . . . . : Hybrid`);
      this.print(`   IP Routing Enabled. . . . . . . . : No\n`);
    }

    const intf = dev.interfaces['FastEthernet0'] || dev.interfaces['Wireless0'] || {};
    this.print(`Ethernet adapter ${dev.type === 'laptop' ? 'Wireless Network Connection' : 'Ethernet0'}:`);
    this.print(`   Connection-specific DNS Suffix  . : `);
    if (isAll) {
      this.print(`   Physical Address. . . . . . . . . : ${intf.mac || '0050.7966.6801'}`);
      this.print(`   DHCP Enabled. . . . . . . . . . . : ${dev.dhcpEnabled ? 'Yes' : 'No'}`);
    }
    this.print(`   IPv4 Address. . . . . . . . . . . : ${dev.ip || '0.0.0.0'}`);
    this.print(`   Subnet Mask . . . . . . . . . . . : ${dev.mask || '0.0.0.0'}`);
    this.print(`   Default Gateway . . . . . . . . . : ${dev.gateway || '0.0.0.0'}`);
    if (isAll) {
      this.print(`   DNS Servers . . . . . . . . . . . : ${dev.dns || '0.0.0.0'}`);
    }
    this.print("");
  }

  handlePing(args) {
    if (args.length === 0) {
      this.print("Usage: ping [-t] [-n count] target_name");
      return;
    }
    const target = args[args.length - 1];
    this.print(`\nPinging ${target} with 32 bytes of data:`);

    if (window.PXLNetworkSim) {
      const res = window.PXLNetworkSim.executePing(this.device.id, target);
      if (res.success) {
        for (let i = 0; i < 4; i++) {
          const time = Math.floor(Math.random() * 3) + 1;
          this.print(`Reply from ${target}: bytes=32 time=${time}ms TTL=128`);
        }
        this.print(`\nPing statistics for ${target}:`);
        this.print(`    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),`);
        this.print(`Approximate round trip times in milli-seconds:`);
        this.print(`    Minimum = 1ms, Maximum = 3ms, Average = 2ms\n`);
      } else {
        for (let i = 0; i < 4; i++) {
          this.print("Request timed out.");
        }
        this.print(`\nPing statistics for ${target}:`);
        this.print(`    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),\n`);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        this.print(`Reply from ${target}: bytes=32 time=2ms TTL=128`);
      }
    }
  }

  handleTracert(args) {
    if (args.length === 0) {
      this.print("Usage: tracert target_name");
      return;
    }
    const target = args[0];
    this.print(`\nTracing route to ${target} over a maximum of 30 hops:\n`);
    if (window.PXLNetworkSim) {
      const hops = window.PXLNetworkSim.traceRoute(this.device.id, target);
      if (hops && hops.length > 0) {
        hops.forEach((hop, idx) => {
          this.print(`  ${idx + 1}     1 ms    1 ms    1 ms  ${hop}`);
        });
        this.print("\nTrace complete.\n");
        return;
      }
    }
    this.print(`  1     1 ms    1 ms    1 ms  ${this.device.gateway || target}`);
    this.print("\nTrace complete.\n");
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PCDesktopHandler };
}

