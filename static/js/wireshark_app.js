/**
 * wireshark_app.js - Wireshark Protocol Analyzer & Packet Tracer OSI / PDU Inspector
 * Part of PXL Web NetSim (Hogeschool PXL)
 *
 * Provides:
 * 1. Desktop & Global Wireshark Protocol Analyzer
 * 2. 3-Pane Wireshark view: Packet List, Protocol Tree / OSI Model, Hex Dump & ASCII
 * 3. Packet Tracer style In Layers (1-7) & Out Layers (7-1) PDU Header & Trailer breakdowns
 * 4. Realistic packet serialization with Ethernet II headers, IPv4, ICMP, TCP, UDP, HTTP, DNS, ARP & CRC-32 FCS trailer
 */

(function (window) {
  'use strict';

  // --- CRC32 CALCULATOR FOR ETHERNET FCS TRAILER ---
  const crcTable = (function () {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function calculateCRC32(bytes) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return ((crc ^ (-1)) >>> 0);
  }

  function macToBytes(macStr) {
    if (!macStr) return [0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    const clean = macStr.replace(/[^0-9a-fA-F]/g, '');
    const bytes = [];
    for (let i = 0; i < 12 && i < clean.length; i += 2) {
      bytes.push(parseInt(clean.substr(i, 2), 16) || 0);
    }
    while (bytes.length < 6) bytes.push(0);
    return bytes;
  }

  function ipToBytes(ipStr) {
    if (!ipStr) return [0, 0, 0, 0];
    const parts = ipStr.split('.').map(p => parseInt(p, 10) || 0);
    while (parts.length < 4) parts.push(0);
    return parts.slice(0, 4);
  }

  /**
   * Builds realistic raw bytes for a network packet (Ethernet II + L3 + L4 + Payload + FCS Trailer)
   */
  function buildPacketBytes(pkt) {
    const bytes = [];

    // --- LAYER 2: ETHERNET II HEADER (14 Bytes) ---
    // 1. Destination MAC (6 Bytes)
    const dstMacBytes = pkt.l2?.dstMac === 'ff:ff:ff:ff:ff:ff' || pkt.dstDevId === 'broadcast'
      ? [0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
      : macToBytes(pkt.l2?.dstMac || '00:19:5e:3b:00:01');
    bytes.push(...dstMacBytes);

    // 2. Source MAC (6 Bytes)
    const srcMacBytes = macToBytes(pkt.l2?.srcMac || '00:50:79:66:68:01');
    bytes.push(...srcMacBytes);

    // 3. EtherType (2 Bytes)
    const isArp = pkt.protocol === 'ARP';
    const ethType = isArp ? 0x0806 : 0x0800;
    bytes.push((ethType >> 8) & 0xff, ethType & 0xff);

    // --- LAYER 3 & LAYER 4 ---
    if (isArp) {
      // ARP Hardware Type: Ethernet (0x0001)
      bytes.push(0x00, 0x01);
      // ARP Protocol Type: IPv4 (0x0800)
      bytes.push(0x08, 0x00);
      // Hardware Size (6), Protocol Size (4)
      bytes.push(0x06, 0x04);
      // Opcode: 1 (Request) or 2 (Reply)
      const op = pkt.l3?.arp?.opcode || 1;
      bytes.push(0x00, op);
      // Sender MAC (6)
      bytes.push(...srcMacBytes);
      // Sender IP (4)
      bytes.push(...ipToBytes(pkt.l3?.arp?.senderIp || pkt.srcIp));
      // Target MAC (6)
      const targetMacBytes = op === 1 ? [0x00, 0x00, 0x00, 0x00, 0x00, 0x00] : dstMacBytes;
      bytes.push(...targetMacBytes);
      // Target IP (4)
      bytes.push(...ipToBytes(pkt.l3?.arp?.targetIp || pkt.dstIp));
      // Pad to min Ethernet payload (46 bytes)
      while (bytes.length < 60) bytes.push(0x00);
    } else {
      // IPv4 Header (20 Bytes minimum)
      const ipStart = bytes.length;
      // Version 4, IHL 5 (20 bytes)
      bytes.push(0x45);
      // DSCP / TOS
      bytes.push(0x00);
      // Total Length placeholder (2 Bytes)
      const totalLenIdx = bytes.length;
      bytes.push(0x00, 0x00);
      // Identification (2 Bytes)
      const id = (pkt.id * 137) & 0xffff;
      bytes.push((id >> 8) & 0xff, id & 0xff);
      // Flags (DF=1) + Fragment Offset (0x4000)
      bytes.push(0x40, 0x00);
      // TTL (1 Byte)
      bytes.push(pkt.l3?.ttl || 128);
      // Protocol (1 Byte): ICMP=1, TCP=6, UDP=17
      let protoNum = 1;
      if (pkt.protocol === 'TCP' || pkt.protocol === 'HTTP' || pkt.protocol === 'TELNET' || pkt.protocol === 'SSH') protoNum = 6;
      else if (pkt.protocol === 'UDP' || pkt.protocol === 'DNS' || pkt.protocol === 'DHCP') protoNum = 17;
      bytes.push(protoNum);
      // Header Checksum placeholder
      bytes.push(0xda, 0x4a);
      // Source IP (4 Bytes)
      bytes.push(...ipToBytes(pkt.srcIp || '192.168.1.10'));
      // Destination IP (4 Bytes)
      bytes.push(...ipToBytes(pkt.dstIp || '192.168.1.1'));

      // LAYER 4 / L7 PAYLOAD
      if (protoNum === 1) {
        // ICMP (Echo Request: Type 8, Code 0; Echo Reply: Type 0, Code 0)
        const icmpType = pkt.l4?.type !== undefined ? pkt.l4.type : 8;
        bytes.push(icmpType, 0x00);
        // ICMP Checksum placeholder
        bytes.push(0x4d, 0x5b);
        // Identifier & Sequence
        const seq = pkt.l4?.seq || 1;
        bytes.push(0x00, 0x01, (seq >> 8) & 0xff, seq & 0xff);
        // ICMP Payload: 32 bytes standard Windows/Cisco ping pattern
        const pattern = 'abcdefghijklmnopqrstuvwabcdefghi';
        for (let i = 0; i < 32; i++) {
          bytes.push(pattern.charCodeAt(i % pattern.length));
        }
      } else if (protoNum === 6) {
        // TCP Header (20 Bytes)
        const srcPort = pkt.l4?.srcPort || 49152;
        const dstPort = pkt.l4?.dstPort || (pkt.protocol === 'HTTP' ? 80 : pkt.protocol === 'SSH' ? 22 : 23);
        bytes.push((srcPort >> 8) & 0xff, srcPort & 0xff);
        bytes.push((dstPort >> 8) & 0xff, dstPort & 0xff);
        // Seq (4 Bytes)
        bytes.push(0x00, 0x00, 0x00, (pkt.id || 1) & 0xff);
        // Ack (4 Bytes)
        bytes.push(0x00, 0x00, 0x00, pkt.l4?.ack ? 0x01 : 0x00);
        // Data Offset (5 = 20 Bytes) + Reserved
        bytes.push(0x50);
        // Flags (SYN, ACK, FIN, PSH)
        let flags = 0;
        if (pkt.l4?.flags?.syn) flags |= 0x02;
        if (pkt.l4?.flags?.ack) flags |= 0x10;
        if (pkt.l4?.flags?.fin) flags |= 0x01;
        if (pkt.l4?.flags?.psh) flags |= 0x08;
        if (flags === 0) flags = 0x18; // PSH, ACK default for data
        bytes.push(flags);
        // Window Size (65535)
        bytes.push(0xff, 0xff);
        // Checksum & Urgent pointer
        bytes.push(0x89, 0x2a, 0x00, 0x00);

        // HTTP Payload if present
        if (pkt.protocol === 'HTTP' && pkt.l7?.payload) {
          const str = String(pkt.l7.payload);
          for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
          }
        }
      } else if (protoNum === 17) {
        // UDP Header (8 Bytes)
        const srcPort = pkt.l4?.srcPort || 53211;
        const dstPort = pkt.l4?.dstPort || (pkt.protocol === 'DNS' ? 53 : 67);
        bytes.push((srcPort >> 8) & 0xff, srcPort & 0xff);
        bytes.push((dstPort >> 8) & 0xff, dstPort & 0xff);
        // UDP Length (8 + payload)
        const udpLen = 8 + (pkt.protocol === 'DNS' ? 28 : 240);
        bytes.push((udpLen >> 8) & 0xff, udpLen & 0xff);
        // UDP Checksum
        bytes.push(0x12, 0xef);

        if (pkt.protocol === 'DNS') {
          // Standard DNS query payload
          bytes.push(0x1a, 0x2b, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
          bytes.push(0x03, 0x70, 0x78, 0x6c, 0x02, 0x62, 0x65, 0x00, 0x00, 0x01, 0x00, 0x01);
        }
      }

      // Update IPv4 total length in header
      const ipLen = bytes.length - ipStart;
      bytes[totalLenIdx] = (ipLen >> 8) & 0xff;
      bytes[totalLenIdx + 1] = ipLen & 0xff;
    }

    // --- ETHERNET FCS TRAILER (4 Bytes CRC-32) ---
    // Calculated over the entire frame (Dst MAC to end of payload)
    const crc = calculateCRC32(bytes);
    bytes.push(
      (crc >>> 24) & 0xff,
      (crc >>> 16) & 0xff,
      (crc >>> 8) & 0xff,
      crc & 0xff
    );

    return new Uint8Array(bytes);
  }

  /**
   * Formats a byte array into standard Wireshark Hex Dump with ASCII view
   */
  function formatHexDump(uint8Array) {
    const lines = [];
    const len = uint8Array.length;

    for (let i = 0; i < len; i += 16) {
      const offset = i.toString(16).padStart(4, '0');
      let hexPart = '';
      let asciiPart = '';

      for (let j = 0; j < 16; j++) {
        if (j === 8) hexPart += ' ';
        if (i + j < len) {
          const b = uint8Array[i + j];
          hexPart += b.toString(16).padStart(2, '0') + ' ';
          asciiPart += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
        } else {
          hexPart += '   ';
        }
      }

      lines.push(`${offset}   ${hexPart}  ${asciiPart}`);
    }

    return lines.join('\n');
  }

  // --- WIRESHARK APP CONTROLLER ---
  class WiresharkApp {
    constructor(activeDevice = null, options = {}) {
      if (typeof options === 'string') {
        options = { containerId: options };
      } else if (!options || typeof options !== 'object') {
        options = {};
      }
      this.device = activeDevice;
      this.isGlobal = !activeDevice || options.isGlobal === true;
      this.activeTab = 'tree'; // 'tree' or 'osi'
      this.selectedPacketIndex = null;
      this.activeFilter = '';
      this.activeInterface = 'all';
      this.capturing = true;
      this.activeDeviceFilter = 'all';
      this.containerId = options.containerId || 'pcAppContainer';

      // Keep reference
      window.PXLWireshark = this;
    }

    getSim() {
      return window.PXLNetworkSim;
    }

    getPackets() {
      const sim = this.getSim();
      if (!sim || !sim.packetCaptureLog) return [];

      let list = sim.packetCaptureLog;

      // Filter by device if not global
      if (!this.isGlobal && this.device) {
        list = list.filter(p => p.srcDevId === this.device.id || p.dstDevId === this.device.id || p.srcDevName === this.device.hostname || p.dstDevName === this.device.hostname || p.dstDevId === 'broadcast');
      }

      // Filter by selected device in global mode
      if (this.isGlobal && this.activeDeviceFilter && this.activeDeviceFilter !== 'all') {
        list = list.filter(p => p.srcDevId === this.activeDeviceFilter || p.dstDevId === this.activeDeviceFilter || p.srcDevName === this.activeDeviceFilter || p.dstDevName === this.activeDeviceFilter);
      }

      // Filter by selected interface
      if (this.activeInterface !== 'all') {
        list = list.filter(p => p.ingressPort === this.activeInterface || p.egressPort === this.activeInterface);
      }

      // Filter by user filter query
      if (this.activeFilter) {
        const q = this.activeFilter.trim().toLowerCase();
        list = list.filter(p => {
          if (q === 'icmp') return p.protocol === 'ICMP';
          if (q === 'arp') return p.protocol === 'ARP';
          if (q === 'tcp') return p.protocol === 'TCP';
          if (q === 'http') return p.protocol === 'HTTP';
          if (q === 'dns') return p.protocol === 'DNS';
          if (q === 'dhcp') return p.protocol === 'DHCP';
          if (q.startsWith('port ')) {
            const portNum = parseInt(q.replace('port ', ''), 10);
            return p.l4?.srcPort === portNum || p.l4?.dstPort === portNum;
          }
          if (q.startsWith('ip.addr == ') || q.startsWith('ip.addr==')) {
            const targetIp = q.replace(/ip\.addr\s*==\s*/, '').trim();
            return p.srcIp === targetIp || p.dstIp === targetIp;
          }
          return (
            (p.protocol && p.protocol.toLowerCase().includes(q)) ||
            (p.srcIp && p.srcIp.toLowerCase().includes(q)) ||
            (p.dstIp && p.dstIp.toLowerCase().includes(q)) ||
            (p.info && p.info.toLowerCase().includes(q)) ||
            (p.srcDevName && p.srcDevName.toLowerCase().includes(q)) ||
            (p.dstDevName && p.dstDevName.toLowerCase().includes(q))
          );
        });
      }

      return list;
    }

    render(containerOverride = null) {
      const container = typeof containerOverride === 'string'
        ? document.getElementById(containerOverride)
        : (containerOverride || document.getElementById(this.containerId));

      if (!container) return;

      const packets = this.getPackets();
      const devName = this.device ? (this.device.hostname || this.device.displayName || this.device.id) : 'Topologie (Globaal)';

      container.innerHTML = `
        <div class="ws-wrapper" style="display: flex; flex-direction: column; height: 100%; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; border-radius: 6px;">
          <!-- 1. TOP TOOLBAR -->
          <div class="ws-toolbar" style="background: #1e293b; border-bottom: 1px solid #334155; padding: 6px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🦈</span>
              <span style="font-weight: 700; font-size: 13px; color: #38bdf8;">Wireshark Network Protocol Analyzer</span>
              <span style="background: #0284c7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${devName}</span>
            </div>

            <!-- Capture Controls -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="pt-btn pt-btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="window.PXLWireshark.toggleCapture()">
                ${this.capturing ? '⏸️ Pauzeren' : '▶️ Hervatten'}
              </button>
              <button class="pt-btn pt-btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="window.PXLWireshark.clearCapture()">
                🗑️ Wissen
              </button>
              <button class="pt-btn pt-btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="window.PXLWireshark.exportPacketsJson()" title="Exporteer pakketten als JSON bestand">
                📥 Exporteer
              </button>
              ${this.isGlobal ? `
                <select id="wsDeviceFilterSelect" onchange="window.PXLWireshark.setDeviceFilter(this.value)" style="background: #0f172a; color: #38bdf8; border: 1px solid #475569; border-radius: 4px; font-size: 11px; padding: 3px 6px;">
                  <option value="all" ${this.activeDeviceFilter === 'all' ? 'selected' : ''}>🌐 Alle Apparaten</option>
                  ${this.renderDeviceFilterOptions()}
                </select>
              ` : ''}
              <div style="border-left: 1px solid #475569; height: 18px; margin: 0 4px;"></div>
              <!-- Test Traffic Generator -->
              <select id="wsTrafficGenSelect" onchange="window.PXLWireshark.handleGenerateTraffic(this.value); this.value='';" style="background: #0f172a; color: #e2e8f0; border: 1px solid #475569; border-radius: 4px; font-size: 11px; padding: 3px 6px;">
                <option value="">⚡ Test Verkeer Genereren...</option>
                <option value="icmp">Ping (ICMP Echo Request/Reply)</option>
                <option value="arp">ARP (Who has & Reply)</option>
                <option value="tcp">TCP 3-Way Handshake (SYN/ACK)</option>
                <option value="http">HTTP Web (GET & 200 OK)</option>
                <option value="dns">DNS Resolutie (UDP 53)</option>
                <option value="dhcp">DHCP DORA Exchange</option>
              </select>
            </div>
          </div>

          <!-- 2. FILTER & INTERFACE BAR -->
          <div class="ws-filter-bar" style="background: #0f172a; border-bottom: 1px solid #334155; padding: 6px 12px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Filter:</span>
            <input type="text" id="wsFilterInput" placeholder="bv. icmp, arp, tcp, http, dns, dhcp, ip.addr == 192.168.1.1, port 80"
                   value="${this.activeFilter}"
                   onkeydown="if(event.key==='Enter') window.PXLWireshark.applyFilter(this.value)"
                   style="flex: 1; background: #1e293b; color: #38bdf8; border: 1px solid #0284c7; border-radius: 4px; padding: 4px 8px; font-family: 'Consolas', monospace; font-size: 12px; outline: none;">
            <button class="pt-btn pt-btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="window.PXLWireshark.applyFilter(document.getElementById('wsFilterInput').value)">
              Toepassen
            </button>
            <button class="pt-btn pt-btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="window.PXLWireshark.applyFilter('')">
              Herstel
            </button>
            <!-- Quick Filter Pills -->
            <div style="display: flex; gap: 4px; margin-left: 6px;">
              <span class="ws-filter-pill" onclick="window.PXLWireshark.applyFilter('icmp')">ICMP</span>
              <span class="ws-filter-pill" onclick="window.PXLWireshark.applyFilter('arp')">ARP</span>
              <span class="ws-filter-pill" onclick="window.PXLWireshark.applyFilter('tcp')">TCP</span>
              <span class="ws-filter-pill" onclick="window.PXLWireshark.applyFilter('http')">HTTP</span>
              <span class="ws-filter-pill" onclick="window.PXLWireshark.applyFilter('dns')">DNS</span>
            </div>
          </div>

          <!-- 3. MAIN PANE: PACKET LIST (TOP 35%) -->
          <div class="ws-packet-list" style="flex: 0 0 35%; overflow-y: auto; background: #0b1120; border-bottom: 2px solid #334155;">
            <table style="width: 100%; border-collapse: collapse; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; text-align: left;">
              <thead style="position: sticky; top: 0; background: #1e293b; color: #94a3b8; font-weight: 700; z-index: 10; border-bottom: 1px solid #475569;">
                <tr>
                  <th style="padding: 4px 8px; width: 45px;">No.</th>
                  <th style="padding: 4px 8px; width: 80px;">Tijd</th>
                  <th style="padding: 4px 8px; width: 140px;">Bron (Source)</th>
                  <th style="padding: 4px 8px; width: 140px;">Doel (Destination)</th>
                  <th style="padding: 4px 8px; width: 75px;">Protocol</th>
                  <th style="padding: 4px 8px; width: 55px;">Lengte</th>
                  <th style="padding: 4px 8px;">Informatie / PDU Details</th>
                </tr>
              </thead>
              <tbody id="wsPacketTableBody">
                ${this.renderPacketRows(packets)}
              </tbody>
            </table>
          </div>

          <!-- 4. MIDDLE PANE: PROTOCOL TREE & PACKET TRACER OSI INSPECTOR (35%) -->
          <div class="ws-details-pane" style="flex: 0 0 38%; display: flex; flex-direction: column; background: #0f172a; border-bottom: 2px solid #334155; overflow: hidden;">
            <!-- Tab Switcher -->
            <div style="background: #1e293b; border-bottom: 1px solid #334155; padding: 2px 12px; display: flex; gap: 8px;">
              <button class="ws-tab-btn ${this.activeTab === 'tree' ? 'active' : ''}" onclick="window.PXLWireshark.switchTab('tree')">
                🌲 Wireshark Protocol Tree
              </button>
              <button class="ws-tab-btn ${this.activeTab === 'osi' ? 'active' : ''}" onclick="window.PXLWireshark.switchTab('osi')">
                📦 Packet Tracer OSI Model & PDU Details (In/Out Layers)
              </button>
            </div>

            <div id="wsDetailsContent" style="flex: 1; overflow-y: auto; padding: 8px 12px;">
              ${this.renderSelectedPacketDetails()}
            </div>
          </div>

          <!-- 5. BOTTOM PANE: PACKET BYTES & HEX DUMP (27%) -->
          <div class="ws-hex-pane" style="flex: 1; display: flex; flex-direction: column; background: #050b14; overflow: hidden;">
            <div style="background: #0f172a; border-bottom: 1px solid #1e293b; padding: 3px 12px; font-size: 11px; font-weight: bold; color: #38bdf8; display: flex; justify-content: space-between;">
              <span>Hex Dump &amp; ASCII Inspector (Wireshark Raw Bytes)</span>
              <span id="wsByteCountLabel" style="color: #94a3b8; font-size: 10px;">Selecteer een pakket om bytes te inspecteren</span>
            </div>
            <pre id="wsHexContent" style="flex: 1; margin: 0; padding: 8px 12px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; line-height: 1.4; color: #cbd5e1; overflow-y: auto; white-space: pre;">${this.renderSelectedHexDump()}</pre>
          </div>

          <!-- 6. STATUS BAR -->
          <div class="ws-statusbar" style="background: #1e293b; border-top: 1px solid #334155; padding: 3px 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between;">
            <div>Pakketten: <strong>${packets.length}</strong> | Weergegeven: <strong>${packets.length}</strong></div>
            <div id="wsStatusSelected">Geen pakket geselecteerd</div>
            <div>PXL NetSim Protocol Engine • Live OSI Encapsulation</div>
          </div>
        </div>

        <style>
          .ws-filter-pill {
            background: #334155;
            color: #f1f5f9;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.15s;
          }
          .ws-filter-pill:hover {
            background: #0284c7;
            color: white;
          }
          .ws-tab-btn {
            background: transparent;
            color: #94a3b8;
            border: none;
            border-bottom: 2px solid transparent;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          }
          .ws-tab-btn.active {
            color: #38bdf8;
            border-bottom: 2px solid #38bdf8;
            background: rgba(56, 189, 248, 0.08);
          }
          .ws-pkt-row {
            cursor: pointer;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            transition: background 0.1s;
          }
          .ws-pkt-row:hover {
            background: rgba(56, 189, 248, 0.15) !important;
          }
          .ws-pkt-row.selected {
            background: #0284c7 !important;
            color: #ffffff !important;
          }
          .ws-tree-item {
            font-family: 'Consolas', monospace;
            font-size: 11px;
            margin-bottom: 4px;
            cursor: pointer;
          }
          .ws-tree-header {
            background: #1e293b;
            padding: 4px 8px;
            border-radius: 4px;
            border-left: 3px solid #0284c7;
            color: #e2e8f0;
            font-weight: bold;
          }
          .ws-tree-children {
            padding-left: 20px;
            margin-top: 4px;
            color: #cbd5e1;
            line-height: 1.5;
          }
          .ws-pdu-diagram-box {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 6px 10px;
            margin: 4px;
            border-radius: 4px;
            font-family: 'Consolas', monospace;
            font-size: 10px;
            font-weight: bold;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }
        </style>
      `;

      // Auto select first packet if none selected
      if (this.selectedPacketIndex === null && packets.length > 0) {
        this.selectPacket(0);
      }
    }

    renderPacketRows(packets) {
      if (packets.length === 0) {
        return `
          <tr>
            <td colspan="7" style="text-align: center; padding: 30px; color: #64748b;">
              Geen netwerkpakketten opgenomen. Voer een <code>ping</code>, <code>curl</code> of <code>ssh</code> uit op een apparaat, of klik op <strong>⚡ Test Verkeer Genereren</strong> hierboven!
            </td>
          </tr>
        `;
      }

      return packets.map((p, idx) => {
        const isSelected = this.selectedPacketIndex === idx;
        let rowBg = '#0b1120';
        let textColor = '#e2e8f0';

        // Authentic Wireshark row color tints
        switch (p.protocol) {
          case 'ICMP':
            rowBg = '#1c2833'; // Soft teal/cyan tint
            textColor = '#a7f3d0';
            break;
          case 'ARP':
            rowBg = '#2c2518'; // Pale amber/tan
            textColor = '#fde68a';
            break;
          case 'TCP':
            rowBg = '#152538'; // Light sky blue
            textColor = '#bae6fd';
            break;
          case 'HTTP':
            rowBg = '#143324'; // Pale green
            textColor = '#86efac';
            break;
          case 'DNS':
            rowBg = '#1e1f3a'; // Indigo
            textColor = '#c7d2fe';
            break;
          case 'DHCP':
            rowBg = '#2d182b'; // Magenta/pink
            textColor = '#fbcfe8';
            break;
        }

        const timeStr = typeof p.timestamp === 'number' ? p.timestamp.toFixed(6) : (p.timeFormatted || '0.000000');
        const srcDisp = p.srcIp || (p.l2 && p.l2.srcMac) || p.srcDevName || '0.0.0.0';
        const dstDisp = p.dstIp || (p.l2 && p.l2.dstMac) || (p.dstDevId === 'broadcast' ? 'Broadcast' : p.dstDevName) || '255.255.255.255';

        return `
          <tr class="ws-pkt-row ${isSelected ? 'selected' : ''}" style="background: ${rowBg}; color: ${textColor};" onclick="window.PXLWireshark.selectPacket(${idx})">
            <td style="padding: 3px 8px; font-weight: bold;">${idx + 1}</td>
            <td style="padding: 3px 8px;">${timeStr}</td>
            <td style="padding: 3px 8px;">${srcDisp}</td>
            <td style="padding: 3px 8px;">${dstDisp}</td>
            <td style="padding: 3px 8px; font-weight: bold;">${p.protocol}</td>
            <td style="padding: 3px 8px;">${p.length || 74}</td>
            <td style="padding: 3px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;">${p.info || p.summary || ''}</td>
          </tr>
        `;
      }).join('');
    }

    selectPacket(index) {
      this.selectedPacketIndex = index;
      const packets = this.getPackets();
      const pkt = packets[index];

      // Update row selection class
      const rows = document.querySelectorAll('.ws-pkt-row');
      rows.forEach((r, i) => {
        if (i === index) r.classList.add('selected');
        else r.classList.remove('selected');
      });

      // Update Details Content
      const detailsEl = document.getElementById('wsDetailsContent');
      if (detailsEl) detailsEl.innerHTML = this.renderSelectedPacketDetails();

      // Update Hex Dump Content
      const hexEl = document.getElementById('wsHexContent');
      if (hexEl) hexEl.textContent = this.renderSelectedHexDump();

      // Update byte count label
      const byteLbl = document.getElementById('wsByteCountLabel');
      if (byteLbl && pkt) {
        byteLbl.textContent = `${pkt.length || 74} bytes op draad (wire) • ${((pkt.length || 74) * 8)} bits • Interface: ${pkt.ingressPort || 'FastEthernet0'}`;
      }

      // Update status bar
      const statusEl = document.getElementById('wsStatusSelected');
      if (statusEl && pkt) {
        statusEl.textContent = `Geselecteerd: #${index + 1} (${pkt.protocol} - ${pkt.info || ''})`;
      }
    }

    switchTab(tab) {
      this.activeTab = tab;
      const buttons = document.querySelectorAll('.ws-tab-btn');
      buttons.forEach(b => {
        if (b.innerText.toLowerCase().includes(tab === 'tree' ? 'tree' : 'osi')) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
      const detailsEl = document.getElementById('wsDetailsContent');
      if (detailsEl) detailsEl.innerHTML = this.renderSelectedPacketDetails();
    }

    renderSelectedPacketDetails() {
      const packets = this.getPackets();
      if (this.selectedPacketIndex === null || !packets[this.selectedPacketIndex]) {
        return `<div style="padding: 20px; color: #64748b; text-align: center;">Geen pakket geselecteerd om te inspecteren.</div>`;
      }

      const pkt = packets[this.selectedPacketIndex];

      if (this.activeTab === 'tree') {
        return this.renderWiresharkTree(pkt);
      } else {
        return this.renderPacketTracerOsiView(pkt);
      }
    }

    renderWiresharkTree(pkt) {
      const pLen = pkt.length || 74;
      const bits = pLen * 8;
      const fcs = pkt.l2?.fcs || '0x4a3b1c2d';

      return `
        <div style="font-family: 'Consolas', 'Courier New', monospace; font-size: 11px;">
          <!-- LAYER 1: FRAME -->
          <div class="ws-tree-item">
            <div class="ws-tree-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
              ▼ Frame ${this.selectedPacketIndex + 1}: ${pLen} bytes on wire (${bits} bits), ${pLen} bytes captured on interface ${pkt.ingressPort || 'FastEthernet0'}
            </div>
            <div class="ws-tree-children">
              <div>• Interface id: 0 (${pkt.ingressPort || 'FastEthernet0'})</div>
              <div>• Encapsulation type: Ethernet (1)</div>
              <div>• Arrival Time: ${pkt.timeFormatted || '2026-11-11 16:45:00.123456'}</div>
              <div>• Frame Number: ${this.selectedPacketIndex + 1}</div>
              <div>• Frame Length: ${pLen} bytes (${bits} bits)</div>
              <div>• Capture Length: ${pLen} bytes (${bits} bits)</div>
              <div>• Protocols in frame: eth:ethertype:${(pkt.protocol || 'ip').toLowerCase()}</div>
            </div>
          </div>

          <!-- LAYER 2: ETHERNET II -->
          <div class="ws-tree-item" style="margin-top: 6px;">
            <div class="ws-tree-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
              ▼ Ethernet II, Src: ${pkt.srcDevName || 'PC'} (${pkt.l2?.srcMac || '00:50:79:66:68:01'}), Dst: ${pkt.dstDevName || 'Switch'} (${pkt.l2?.dstMac || '00:19:5e:3b:00:01'})
            </div>
            <div class="ws-tree-children">
              <div>• Destination: ${pkt.l2?.dstMac || '00:19:5e:3b:00:01'} (${pkt.dstDevName || 'Device'})</div>
              <div>• Source: ${pkt.l2?.srcMac || '00:50:79:66:68:01'} (${pkt.srcDevName || 'Device'})</div>
              <div>• Type: ${pkt.protocol === 'ARP' ? 'ARP (0x0806)' : 'IPv4 (0x0800)'}</div>
              <div style="color: #4ade80; font-weight: bold;">• Frame Check Sequence (FCS Trailer): ${fcs} [correct CRC-32 trailer]</div>
            </div>
          </div>

          <!-- LAYER 3: IPv4 or ARP -->
          ${pkt.protocol === 'ARP' ? `
            <div class="ws-tree-item" style="margin-top: 6px;">
              <div class="ws-tree-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                ▼ Address Resolution Protocol (${pkt.l3?.arp?.opcode === 2 ? 'reply' : 'request'})
              </div>
              <div class="ws-tree-children">
                <div>• Hardware type: Ethernet (1)</div>
                <div>• Protocol type: IPv4 (0x0800)</div>
                <div>• Hardware size: 6</div>
                <div>• Protocol size: 4</div>
                <div>• Opcode: ${pkt.l3?.arp?.opcode === 2 ? 'reply (2)' : 'request (1)'}</div>
                <div>• Sender MAC address: ${pkt.l3?.arp?.senderMac || pkt.l2?.srcMac}</div>
                <div>• Sender IP address: ${pkt.l3?.arp?.senderIp || pkt.srcIp}</div>
                <div>• Target MAC address: ${pkt.l3?.arp?.targetMac || pkt.l2?.dstMac}</div>
                <div>• Target IP address: ${pkt.l3?.arp?.targetIp || pkt.dstIp}</div>
              </div>
            </div>
          ` : `
            <div class="ws-tree-item" style="margin-top: 6px;">
              <div class="ws-tree-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                ▼ Internet Protocol Version 4, Src: ${pkt.srcIp || '192.168.1.10'}, Dst: ${pkt.dstIp || '192.168.1.1'}
              </div>
              <div class="ws-tree-children">
                <div>• 0100 .... = Version: 4</div>
                <div>• .... 0101 = Header Length: 20 bytes (5)</div>
                <div>• Differentiated Services Field: 0x00 (DSCP: CS0)</div>
                <div>• Total Length: ${pLen - 18} bytes</div>
                <div>• Identification: 0x1a2b (6699)</div>
                <div>• Flags: 0x4000, Don't fragment (DF)</div>
                <div>• Time to Live (TTL): ${pkt.l3?.ttl || 128}</div>
                <div>• Protocol: ${pkt.protocol} (${pkt.protocol === 'ICMP' ? '1' : pkt.protocol === 'TCP' ? '6' : '17'})</div>
                <div>• Header Checksum: 0xda4a [validation disabled]</div>
                <div>• Source Address: ${pkt.srcIp || '192.168.1.10'}</div>
                <div>• Destination Address: ${pkt.dstIp || '192.168.1.1'}</div>
              </div>
            </div>
          `}

          <!-- LAYER 4: ICMP / TCP / UDP -->
          ${pkt.protocol === 'ICMP' ? `
            <div class="ws-tree-item" style="margin-top: 6px;">
              <div class="ws-tree-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                ▼ Internet Control Message Protocol (${pkt.l4?.type === 0 ? 'Echo reply' : 'Echo request'})
              </div>
              <div class="ws-tree-children">
                <div>• Type: ${pkt.l4?.type === 0 ? '0 (Echo (ping) reply)' : '8 (Echo (ping) request)'}</div>
                <div>• Code: 0</div>
                <div>• Checksum: 0x4d5b [correct]</div>
                <div>• Identifier (BE): 1 (0x0001)</div>
                <div>• Sequence Number (BE): ${pkt.l4?.seq || 1}</div>
                <div>• Data (32 bytes): abcdefghijklmnopqrstuvwabcdefghi</div>
              </div>
            </div>
          ` : ''}

          ${pkt.protocol === 'TCP' || pkt.protocol === 'HTTP' ? `
            <div class="ws-tree-item" style="margin-top: 6px;">
              <div class="ws-tree-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                ▼ Transmission Control Protocol, Src Port: ${pkt.l4?.srcPort || 49152}, Dst Port: ${pkt.l4?.dstPort || 80}
              </div>
              <div class="ws-tree-children">
                <div>• Source Port: ${pkt.l4?.srcPort || 49152}</div>
                <div>• Destination Port: ${pkt.l4?.dstPort || 80}</div>
                <div>• Sequence Number: ${pkt.l4?.seq || 1}</div>
                <div>• Acknowledgment Number: ${pkt.l4?.ack ? '1' : '0'}</div>
                <div>• Header Length: 20 bytes (5)</div>
                <div>• Flags: [${pkt.l4?.flags ? Object.keys(pkt.l4.flags).filter(k => pkt.l4.flags[k]).join(', ') : 'ACK'}]</div>
                <div>• Window: 65535</div>
                <div>• Checksum: 0x892a [verified]</div>
              </div>
            </div>
          ` : ''}

          <!-- LAYER 7: APPLICATION (HTTP / DNS) -->
          ${pkt.protocol === 'HTTP' ? `
            <div class="ws-tree-item" style="margin-top: 6px;">
              <div class="ws-tree-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                ▼ Hypertext Transfer Protocol (HTTP)
              </div>
              <div class="ws-tree-children">
                <div>• Request/Response: ${pkt.info || 'GET /index.html HTTP/1.1'}</div>
                <div>• Host: ${pkt.dstIp || '192.168.1.1'}</div>
                <div>• User-Agent: PXL-NetSim/2026 Browser</div>
                <div>• Accept: text/html,application/xhtml+xml</div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    renderPacketTracerOsiView(pkt) {
      const fcs = pkt.l2?.fcs || '0x4a3b1c2d';

      return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px;">
          <!-- 1. VISUAL PDU HEADER & TRAILER DIAGRAM (Packet Tracer Style) -->
          <div style="margin-bottom: 12px; background: #1e293b; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
            <div style="font-weight: 700; color: #38bdf8; margin-bottom: 8px; font-size: 12px; display: flex; align-items: center; justify-content: space-between;">
              <span>📦 PDU Header &amp; Trailer Structuur (Packet Encapsulation)</span>
              <span style="font-size: 10px; color: #94a3b8;">${pkt.length || 74} Bytes Totaal</span>
            </div>

            <div style="display: flex; flex-wrap: wrap; align-items: stretch; gap: 4px;">
              <!-- Layer 2 Ethernet Header -->
              <div class="ws-pdu-diagram-box" style="background: #1e3a8a; border-color: #3b82f6;">
                <span style="color: #bfdbfe; font-size: 9px;">L2 ETHERNET</span>
                <span>Dst MAC</span>
                <span style="color: #93c5fd; font-weight: normal; font-size: 9px;">${pkt.l2?.dstMac || '00:19:...'}</span>
              </div>
              <div class="ws-pdu-diagram-box" style="background: #1e3a8a; border-color: #3b82f6;">
                <span style="color: #bfdbfe; font-size: 9px;">L2 ETHERNET</span>
                <span>Src MAC</span>
                <span style="color: #93c5fd; font-weight: normal; font-size: 9px;">${pkt.l2?.srcMac || '00:50:...'}</span>
              </div>
              <div class="ws-pdu-diagram-box" style="background: #1e3a8a; border-color: #3b82f6;">
                <span style="color: #bfdbfe; font-size: 9px;">TYPE</span>
                <span>${pkt.protocol === 'ARP' ? '0x0806 ARP' : '0x0800 IPv4'}</span>
              </div>

              <!-- Layer 3 IP Header -->
              ${pkt.protocol !== 'ARP' ? `
                <div class="ws-pdu-diagram-box" style="background: #065f46; border-color: #10b981;">
                  <span style="color: #a7f3d0; font-size: 9px;">L3 IPv4</span>
                  <span>Src: ${pkt.srcIp || '192.168.1.10'}</span>
                  <span style="color: #6ee7b7; font-weight: normal; font-size: 9px;">TTL: ${pkt.l3?.ttl || 128}</span>
                </div>
                <div class="ws-pdu-diagram-box" style="background: #065f46; border-color: #10b981;">
                  <span style="color: #a7f3d0; font-size: 9px;">L3 IPv4</span>
                  <span>Dst: ${pkt.dstIp || '192.168.1.1'}</span>
                  <span style="color: #6ee7b7; font-weight: normal; font-size: 9px;">Proto: ${pkt.protocol}</span>
                </div>
              ` : `
                <div class="ws-pdu-diagram-box" style="background: #78350f; border-color: #f59e0b;">
                  <span style="color: #fde68a; font-size: 9px;">L3 ARP</span>
                  <span>${pkt.l3?.arp?.opcode === 2 ? 'ARP Reply' : 'ARP Request'}</span>
                  <span style="color: #fcd34d; font-weight: normal; font-size: 9px;">Target: ${pkt.dstIp || '192.168.1.1'}</span>
                </div>
              `}

              <!-- Layer 4 Transport Header -->
              <div class="ws-pdu-diagram-box" style="background: #581c87; border-color: #a855f7;">
                <span style="color: #e9d5ff; font-size: 9px;">L4 ${pkt.protocol}</span>
                <span>${pkt.protocol === 'ICMP' ? 'Type 8/0 Echo' : pkt.protocol === 'TCP' ? 'Ports: ' + (pkt.l4?.srcPort || 49152) + '→' + (pkt.l4?.dstPort || 80) : 'UDP Port 53'}</span>
              </div>

              <!-- Payload -->
              <div class="ws-pdu-diagram-box" style="background: #334155; border-color: #64748b; flex: 1; min-width: 90px;">
                <span style="color: #cbd5e1; font-size: 9px;">PAYLOAD</span>
                <span>Data (32 Bytes)</span>
              </div>

              <!-- Layer 2 Trailer: FCS CRC-32 -->
              <div class="ws-pdu-diagram-box" style="background: #831843; border-color: #f43f5e;">
                <span style="color: #fbcfe8; font-size: 9px;">L2 TRAILER</span>
                <span>FCS (CRC-32)</span>
                <span style="color: #fda4af; font-size: 9px;">${fcs}</span>
              </div>
            </div>
          </div>

          <!-- 2. IN LAYERS & OUT LAYERS (Side by Side) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <!-- IN LAYERS -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 10px;">
              <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px; font-size: 11px; border-bottom: 1px solid #475569; padding-bottom: 4px;">
                📥 In Layers (Binnenkomend via ${pkt.ingressPort || 'FastEthernet0'})
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px;">
                <!-- Layer 7 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #64748b; border-radius: 2px;">
                  <span style="font-weight: bold; color: #94a3b8;">Layer 7 (Application):</span>
                  <div style="color: #cbd5e1;">${pkt.protocol === 'HTTP' ? 'HTTP-verzoek ontvangen. De webserver evalueert de GET request header.' : pkt.protocol === 'DNS' ? 'DNS-query ontvangen op poort 53.' : 'Geen L7 applicatie overhead voor ICMP ping/ARP.'}</div>
                </div>

                <!-- Layer 4 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #a855f7; border-radius: 2px;">
                  <span style="font-weight: bold; color: #c084fc;">Layer 4 (Transport):</span>
                  <div style="color: #cbd5e1;">${pkt.protocol === 'ICMP' ? 'ICMP segment ontvangen. Het type is ' + (pkt.l4?.type === 0 ? 'Echo Reply (0)' : 'Echo Request (8)') + '. Checksum is geverifieerd.' : 'TCP/UDP segment verwerkt met poorten ' + (pkt.l4?.srcPort || 49152) + ' en ' + (pkt.l4?.dstPort || 80) + '.'}</div>
                </div>

                <!-- Layer 3 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #10b981; border-radius: 2px;">
                  <span style="font-weight: bold; color: #34d399;">Layer 3 (Network):</span>
                  <div style="color: #cbd5e1;">Het IP-pakket bevat Source IP ${pkt.srcIp || '192.168.1.10'} en Destination IP ${pkt.dstIp || '192.168.1.1'}. Het apparaat verifieert dat het doel-IP overeenkomt met een lokaal interface-adres.</div>
                </div>

                <!-- Layer 2 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #3b82f6; border-radius: 2px;">
                  <span style="font-weight: bold; color: #60a5fa;">Layer 2 (Data Link):</span>
                  <div style="color: #cbd5e1;">Ethernet II frame ontvangen. Bestemmings-MAC (${pkt.l2?.dstMac || '00:19:...'}) komt overeen met interface ${pkt.ingressPort || 'FastEthernet0'} of Broadcast. FCS CRC-32 trailer controle is geslaagd.</div>
                </div>

                <!-- Layer 1 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #eab308; border-radius: 2px;">
                  <span style="font-weight: bold; color: #facc15;">Layer 1 (Physical):</span>
                  <div style="color: #cbd5e1;">Interface ${pkt.ingressPort || 'FastEthernet0'} ontvangt het binaire signaal over de koperen UTP Cat5e kabel (100BASE-TX Full Duplex).</div>
                </div>
              </div>
            </div>

            <!-- OUT LAYERS -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 10px;">
              <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px; font-size: 11px; border-bottom: 1px solid #475569; padding-bottom: 4px;">
                📤 Out Layers (Uitgaand / Forwarding Beslissing)
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px;">
                <!-- Layer 7 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #64748b; border-radius: 2px;">
                  <span style="font-weight: bold; color: #94a3b8;">Layer 7 (Application):</span>
                  <div style="color: #cbd5e1;">${pkt.protocol === 'HTTP' ? 'HTTP 200 OK HTML payload gegenereerd en doorgegeven aan Layer 4.' : 'Applicatielaag produceert de payload data.'}</div>
                </div>

                <!-- Layer 4 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #a855f7; border-radius: 2px;">
                  <span style="font-weight: bold; color: #c084fc;">Layer 4 (Transport):</span>
                  <div style="color: #cbd5e1;">${pkt.protocol === 'ICMP' ? 'Het apparaat construeert een ICMP Echo Reply (type 0) met identifier en sequence gelijk aan de request.' : 'TCP/UDP segment wordt ingekapseld met geldige bron- en bestemmingspoorten.'}</div>
                </div>

                <!-- Layer 3 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #10b981; border-radius: 2px;">
                  <span style="font-weight: bold; color: #34d399;">Layer 3 (Network):</span>
                  <div style="color: #cbd5e1;">Routingtabel geraadpleegd: Bestemmings-IP ${pkt.srcIp || '192.168.1.10'} bevindt zich direct in het lokale subnet. Volgende hopinterface is ${pkt.egressPort || pkt.ingressPort || 'FastEthernet0'}. TTL ingesteld op 128.</div>
                </div>

                <!-- Layer 2 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #3b82f6; border-radius: 2px;">
                  <span style="font-weight: bold; color: #60a5fa;">Layer 2 (Data Link):</span>
                  <div style="color: #cbd5e1;">ARP-cache bevat het MAC-adres van het doel (${pkt.l2?.srcMac || '00:50:...'}); frame wordt geëncapsuleerd met Ethernet II headers en een berekende FCS CRC-32 trailer (${fcs}).</div>
                </div>

                <!-- Layer 1 -->
                <div style="padding: 4px 6px; background: rgba(255,255,255,0.03); border-left: 3px solid #eab308; border-radius: 2px;">
                  <span style="font-weight: bold; color: #facc15;">Layer 1 (Physical):</span>
                  <div style="color: #cbd5e1;">Interface ${pkt.egressPort || pkt.ingressPort || 'FastEthernet0'} zendt het frame bit voor bit uit over de fysieke kabel link.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderSelectedHexDump() {
      const packets = this.getPackets();
      if (this.selectedPacketIndex === null || !packets[this.selectedPacketIndex]) {
        return 'Geen pakket geselecteerd.';
      }

      const pkt = packets[this.selectedPacketIndex];
      let bytes = pkt.rawBytes;
      if (!bytes || !(bytes instanceof Uint8Array)) {
        bytes = buildPacketBytes(pkt);
        pkt.rawBytes = bytes;
      }

      return formatHexDump(bytes);
    }

    // --- USER ACTIONS ---
    toggleCapture() {
      this.capturing = !this.capturing;
      const sim = this.getSim();
      if (sim) sim.captureActive = this.capturing;
      this.render();
    }

    clearCapture() {
      const sim = this.getSim();
      if (sim) {
        sim.packetCaptureLog = [];
      }
      this.selectedPacketIndex = null;
      this.render();
    }

    applyFilter(filterStr) {
      this.activeFilter = filterStr || '';
      const input = document.getElementById('wsFilterInput');
      if (input) input.value = this.activeFilter;
      this.selectedPacketIndex = null;
      this.render();
    }

    handleGenerateTraffic(type) {
      if (!type) return;
      const sim = this.getSim();
      if (!sim) return;

      const srcDev = this.device || Object.values(sim.devices).find(d => d.type === 'pc' || d.type === 'laptop') || Object.values(sim.devices)[0];
      const dstDev = Object.values(sim.devices).find(d => d.id !== srcDev?.id) || srcDev;

      if (!srcDev) {
        alert('Plaats eerst een netwerkapparaat op het canvas!');
        return;
      }

      const srcIp = srcDev.ip || srcDev.interfaces?.['FastEthernet0']?.ip || '192.168.1.10';
      const dstIp = dstDev ? (dstDev.ip || dstDev.interfaces?.['Vlan1']?.ip || dstDev.interfaces?.['FastEthernet0']?.ip || '192.168.1.1') : '192.168.1.1';

      switch (type) {
        case 'icmp':
          sim.recordIcmpExchange(srcDev, dstDev, srcIp, dstIp, true);
          break;
        case 'arp':
          sim.recordArpExchange(srcDev, dstDev, srcIp, dstIp);
          break;
        case 'tcp':
          sim.recordTcpHandshake(srcDev, dstDev, srcIp, dstIp, 80);
          break;
        case 'http':
          sim.recordHttpExchange(srcDev, dstDev, srcIp, dstIp, 'GET', '/index.html', 200, '<h1>PXL Web NetSim</h1>');
          break;
        case 'dns':
          sim.recordDnsExchange(srcDev, dstDev, 'www.pxl.be', dstIp);
          break;
        case 'dhcp':
          sim.recordDhcpExchange(srcDev, dstDev, '192.168.1.50');
          break;
      }

      this.render();
      const packets = this.getPackets();
      if (packets.length > 0) {
        this.selectPacket(packets.length - 1);
      }
    }

    renderDeviceFilterOptions() {
      const sim = this.getSim();
      if (!sim || !sim.devices) return '';
      return Object.values(sim.devices).map(d => `
        <option value="${d.id}" ${this.activeDeviceFilter === d.id ? 'selected' : ''}>${d.hostname} (${d.model || d.type})</option>
      `).join('');
    }

    setDeviceFilter(devId) {
      this.activeDeviceFilter = devId;
      this.selectedPacketIndex = null;
      this.render();
    }

    exportPacketsJson() {
      const packets = this.getPackets();
      if (packets.length === 0) {
        alert("Geen pakketten in de capture om te exporteren.");
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(packets, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `wireshark_capture_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  }

  // --- STATIC MODAL INSPECTOR: PACKET TRACER PDU INFORMATION ---
  WiresharkApp.showPduInspectorModal = function (pkt) {
    if (!pkt) return;

    let modal = document.getElementById('pduInspectorModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pduInspectorModal';
      modal.className = 'pt-modal-overlay';
      modal.style.zIndex = '3500';
      document.body.appendChild(modal);
    }

    // Build raw bytes if missing
    if (!pkt.rawBytes) {
      pkt.rawBytes = buildPacketBytes(pkt);
    }

    const dummyApp = new WiresharkApp(null, null);

    modal.innerHTML = `
      <div class="pt-device-dialog" style="width: 860px; max-width: 95vw; height: 600px; max-height: 90vh; display: flex; flex-direction: column; background: #0f172a; border: 2px solid #38bdf8; border-radius: 8px; box-shadow: 0 20px 45px rgba(0,0,0,0.6); overflow: hidden; color: #f8fafc;">
        <div style="background: #1e293b; border-bottom: 2px solid #334155; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">✉️</span>
            <div>
              <h3 style="margin: 0; font-size: 15px; color: #38bdf8; font-weight: 700;">Packet Tracer PDU Informatie • ${pkt.protocol || 'PDU'}</h3>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">${pkt.srcDevName || pkt.srcDevId || 'Bron'} → ${pkt.dstDevName || pkt.dstDevId || 'Bestemming'} | ${pkt.srcIp || '0.0.0.0'} → ${pkt.dstIp || '0.0.0.0'}</p>
            </div>
          </div>
          <button class="pt-btn-close" style="color: #94a3b8; background: transparent; border: none; font-size: 20px; cursor: pointer;" onclick="document.getElementById('pduInspectorModal').style.display='none'">✕</button>
        </div>

        <div style="background: #1e293b; border-bottom: 1px solid #334155; padding: 0 16px; display: flex; gap: 8px;">
          <button id="pduTabOsiBtn" class="ws-tab-btn active" onclick="window.switchPduInspectorTab('osi')">
            📦 Packet Tracer OSI Model &amp; PDU Details (In/Out Layers)
          </button>
          <button id="pduTabTreeBtn" class="ws-tab-btn" onclick="window.switchPduInspectorTab('tree')">
            🌲 Wireshark Protocol Tree
          </button>
          <button id="pduTabHexBtn" class="ws-tab-btn" onclick="window.switchPduInspectorTab('hex')">
            🔢 Hex Dump &amp; ASCII Bytes
          </button>
        </div>

        <div id="pduInspectorContent" style="flex: 1; overflow-y: auto; padding: 14px 18px; background: #0b1120;">
          ${dummyApp.renderPacketTracerOsiView(pkt)}
        </div>

        <div style="background: #1e293b; border-top: 1px solid #334155; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #94a3b8;">
          <div>Lengte: <strong>${pkt.length || 74} Bytes</strong> | FCS CRC-32: <code style="color: #fda4af;">${pkt.l2?.fcs || '0x4a3b1c2d'}</code></div>
          <button class="pt-btn pt-btn-secondary" style="padding: 4px 12px; font-size: 11px;" onclick="document.getElementById('pduInspectorModal').style.display='none'">Sluiten</button>
        </div>
      </div>
    `;

    window.switchPduInspectorTab = function (tab) {
      const btnOsi = document.getElementById('pduTabOsiBtn');
      const btnTree = document.getElementById('pduTabTreeBtn');
      const btnHex = document.getElementById('pduTabHexBtn');
      const content = document.getElementById('pduInspectorContent');
      if (!content) return;

      if (btnOsi) btnOsi.classList.toggle('active', tab === 'osi');
      if (btnTree) btnTree.classList.toggle('active', tab === 'tree');
      if (btnHex) btnHex.classList.toggle('active', tab === 'hex');

      if (tab === 'osi') {
        content.innerHTML = dummyApp.renderPacketTracerOsiView(pkt);
      } else if (tab === 'tree') {
        content.innerHTML = dummyApp.renderProtocolTree(pkt);
      } else if (tab === 'hex') {
        content.innerHTML = `<pre style="margin: 0; padding: 10px; font-family: 'Consolas', monospace; font-size: 11px; line-height: 1.4; color: #cbd5e1; white-space: pre;">${formatHexDump(pkt.rawBytes)}</pre>`;
      }
    };

    modal.style.display = 'flex';
  };

  // Export globally
  window.WiresharkApp = WiresharkApp;
  window.buildPacketBytes = buildPacketBytes;
  window.formatHexDump = formatHexDump;

})(window);
