/**
 * canvas_workspace.js - Authentic Cisco Packet Tracer Logical Workspace Canvas
 * Grid dots, pan & zoom, Cisco SVG icons, dynamic cabling, and link LEDs
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class CanvasWorkspace {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'networkCanvas';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Pan & Zoom
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    // Interaction State
    this.activeTool = 'select'; // 'select', 'cable', 'delete', 'place'
    this.placingDeviceSpec = null; // { type, model }
    this.selectedDevice = null;
    this.draggedDevice = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.mouseCanvasPos = { x: 0, y: 0 };
    this.showPortLabels = true;
    this.showWifiSignals = true;
    this.flyingPackets = [];
    this.animating = false;
    this.hoveredDevice = null;
    this.hoveredEndpoint = null;

    // Cabling Engine
    this.cabling = new CablingEngine(this);

    // Cached SVG image elements for high performance rendering
    this.iconCache = {};

    this.initEventListeners();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width || window.innerWidth || 1200;
    this.canvas.height = rect.height || (window.innerHeight - 160) || 700;
    this.render();
  }

  screenToCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.panX) / this.scale;
    const y = (clientY - rect.top - this.panY) / this.scale;
    return { x, y };
  }

  canvasToScreen(canvasX, canvasY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (canvasX * this.scale) + this.panX + rect.left;
    const y = (canvasY * this.scale) + this.panY + rect.top;
    return { x, y };
  }

  initEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    // HTML5 Drag-and-Drop from Shelf onto Canvas (bound to container and canvas)
    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const handleDrop = (e) => {
      e.preventDefault();
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) {
          const spec = JSON.parse(raw);
          if (spec && spec.type) {
            const pos = this.screenToCanvas(e.clientX, e.clientY);
            this.placeDeviceAt(spec.type, spec.model, Math.round(pos.x - 35), Math.round(pos.y - 35));
          }
        }
      } catch (err) {
        console.error('Drop error:', err);
      }
    };
    this.container.addEventListener('dragover', handleDragOver);
    this.container.addEventListener('drop', handleDrop);
    this.canvas.addEventListener('dragover', handleDragOver);
    this.canvas.addEventListener('drop', handleDrop);

    // Keyboard shortcuts (Delete key removes selected device)
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedDevice) {
        // Only if not focused on an input
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        window.PXLNetworkSim.removeDevice(this.selectedDevice.id);
        this.selectedDevice = null;
        this.render();
        if (window.PXLApp) window.PXLApp.triggerScoreUpdate();
      }
    });
  }

  setPlacingDevice(type, model) {
    this.activeTool = 'place';
    this.placingDeviceSpec = { type, model };
    this.canvas.style.cursor = 'crosshair';
  }

  cancelPlacingDevice() {
    this.activeTool = 'select';
    this.placingDeviceSpec = null;
    this.canvas.style.cursor = 'default';
    if (window.PXLApp) window.PXLApp.highlightActiveShelfBtn(null);
  }

  placeDeviceAt(type, model, x, y) {
    const sim = window.PXLNetworkSim;
    const existing = Object.values(sim.devices).filter(d => d.type === type);
    const count = existing.length + 1;
    let prefix = 'Device';
    if (type === 'router') prefix = 'Router';
    if (type === 'switch') prefix = 'Switch';
    if (type === 'hpe_switch') prefix = 'Aruba';
    if (type === 'pc') prefix = 'PC';
    if (type === 'laptop') prefix = 'Laptop';
    if (type === 'server') prefix = 'Server';
    if (type === 'wireless_ap') prefix = 'WirelessRouter';
    if (type === 'mikrotik') prefix = 'MikroTik';
    if (type === 'openwrt') prefix = 'OpenWrt';
    if (type === 'internet_cloud' || type === 'internet_simulated') prefix = 'InetSim';
    if (type === 'internet_public') prefix = 'InetPublic';

    const id = `${prefix}${count}`;
    const newDev = new CiscoDevice(id, type, id, {
      model: model,
      x: x,
      y: y
    });

    sim.registerDevice(newDev);
    this.selectedDevice = newDev;
    this.render();
    if (window.PXLApp) {
      window.PXLApp.showToast(`✅ ${newDev.hostname} geplaatst op werkveld`);
      window.PXLApp.triggerScoreUpdate();
    }
  }

  handleMouseDown(e) {
    // Only left click
    if (e.button !== 0) return;

    const pos = this.screenToCanvas(e.clientX, e.clientY);

    // 0. CHECK FLYING ENVELOPES CLICK (Inspect PDU on Click)
    if (this.flyingPackets && this.flyingPackets.length > 0) {
      const sim = window.PXLNetworkSim;
      for (const fp of this.flyingPackets) {
        const devA = sim?.devices[fp.fromDevId];
        const devB = sim?.devices[fp.toDevId];
        if (!devA || !devB) continue;
        const curX = (devA.x + 35) + ((devB.x + 35) - (devA.x + 35)) * fp.progress;
        const curY = (devA.y + 35) + ((devB.y + 35) - (devA.y + 35)) * fp.progress;
        if (Math.hypot(pos.x - curX, pos.y - curY) <= 18) {
          if (window.WiresharkApp && typeof window.WiresharkApp.showPduInspectorModal === 'function') {
            window.WiresharkApp.showPduInspectorModal(fp.packet || {
              protocol: fp.protocol,
              srcDevName: devA.hostname,
              dstDevName: devB.hostname,
              srcIp: devA.ip || '192.168.1.10',
              dstIp: devB.ip || '192.168.1.1',
              info: `${fp.protocol} Packet Flow`,
              length: 74
            });
            return;
          }
        }
      }
    }

    const clickedDev = this.getDeviceAt(pos.x, pos.y);

    // 1. PLACE TOOL (User clicked a device in shelf and now clicks canvas)
    if (this.activeTool === 'place' && this.placingDeviceSpec) {
      this.placeDeviceAt(
        this.placingDeviceSpec.type,
        this.placingDeviceSpec.model,
        Math.round(pos.x - 35),
        Math.round(pos.y - 35)
      );
      this.cancelPlacingDevice();
      return;
    }

    // 2. DELETE TOOL
    if (this.activeTool === 'delete') {
      if (clickedDev) {
        window.PXLNetworkSim.removeDevice(clickedDev.id);
        this.selectedDevice = null;
        this.render();
        if (window.PXLApp) window.PXLApp.triggerScoreUpdate();
        return;
      }
      const clickedCable = this.getCableAt(pos.x, pos.y);
      if (clickedCable) {
        window.PXLNetworkSim.removeCable(clickedCable.id);
        this.render();
        if (window.PXLApp) window.PXLApp.triggerScoreUpdate();
        return;
      }
    }

    // 3. CABLE TOOL
    if (this.activeTool === 'cable') {
      if (clickedDev) {
        const screenPos = this.canvasToScreen(clickedDev.x + 35, clickedDev.y + 35);
        this.cabling.handleDeviceClick(clickedDev, screenPos.x, screenPos.y);
      } else {
        this.cabling.cancelPending();
      }
      return;
    }

    // 4. SELECT / MOVE TOOL
    if (this.activeTool === 'select') {
      const clickedEndpoint = this.getCableEndpointAt(pos.x, pos.y);
      if (clickedEndpoint) {
        if (this.cabling) {
          this.cabling.showCableActionPopover(clickedEndpoint.cable, clickedEndpoint.side, e.clientX, e.clientY);
        }
        return;
      }

      const clickedCable = this.getCableAt(pos.x, pos.y);
      if (clickedCable && !clickedDev) {
        if (this.cabling) {
          const sim = window.PXLNetworkSim;
          const devA = sim?.devices[clickedCable.fromDevice];
          const devB = sim?.devices[clickedCable.toDevice];
          let closerSide = 'from';
          if (devA && devB) {
            const distA = Math.hypot(pos.x - (devA.x + 35), pos.y - (devA.y + 35));
            const distB = Math.hypot(pos.x - (devB.x + 35), pos.y - (devB.y + 35));
            if (distB < distA) closerSide = 'to';
          }
          this.cabling.showCableActionPopover(clickedCable, closerSide, e.clientX, e.clientY);
        }
        return;
      }
    }

    if (clickedDev) {
      e.preventDefault();
      this.selectedDevice = clickedDev;
      this.draggedDevice = clickedDev;
      this.dragOffsetX = pos.x - clickedDev.x;
      this.dragOffsetY = pos.y - clickedDev.y;
      this.canvas.style.cursor = 'grabbing';
      this.dragStartScreenX = e.clientX;
      this.dragStartScreenY = e.clientY;
      this.hasMovedDevice = false;
    } else {
      this.selectedDevice = null;
      // Start canvas panning
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
      this.canvas.style.cursor = 'grab';
    }
    this.render();
  }

  handleContextMenu(e) {
    e.preventDefault();
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    const clickedEndpoint = this.getCableEndpointAt(pos.x, pos.y);
    if (clickedEndpoint && this.cabling) {
      this.cabling.showCableActionPopover(clickedEndpoint.cable, clickedEndpoint.side, e.clientX, e.clientY);
      return;
    }
    const clickedCable = this.getCableAt(pos.x, pos.y);
    if (clickedCable && this.cabling) {
      const sim = window.PXLNetworkSim;
      const devA = sim?.devices[clickedCable.fromDevice];
      const devB = sim?.devices[clickedCable.toDevice];
      let closerSide = 'from';
      if (devA && devB) {
        const distA = Math.hypot(pos.x - (devA.x + 35), pos.y - (devA.y + 35));
        const distB = Math.hypot(pos.x - (devB.x + 35), pos.y - (devB.y + 35));
        if (distB < distA) closerSide = 'to';
      }
      this.cabling.showCableActionPopover(clickedCable, closerSide, e.clientX, e.clientY);
      return;
    }
    const clickedDev = this.getDeviceAt(pos.x, pos.y);
    if (clickedDev && window.PXLApp) {
      window.PXLApp.openDeviceModal(clickedDev);
      return;
    }
  }

  handleMouseMove(e) {
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    this.mouseCanvasPos = pos;

    if (this.draggedDevice) {
      if (Math.hypot(e.clientX - this.dragStartScreenX, e.clientY - this.dragStartScreenY) > 5) {
        this.hasMovedDevice = true;
      }
      this.draggedDevice.x = Math.round(pos.x - this.dragOffsetX);
      this.draggedDevice.y = Math.round(pos.y - this.dragOffsetY);
      this.render();
    } else if (this.isPanning) {
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      this.render();
    } else if (this.cabling && this.cabling.pendingConnection) {
      this.render();
    } else if (this.activeTool === 'select') {
      const hoverDev = this.getDeviceAt(pos.x, pos.y);
      const hoverEndpoint = this.getCableEndpointAt(pos.x, pos.y);
      const hoverCable = (!hoverDev && !hoverEndpoint) ? this.getCableAt(pos.x, pos.y) : null;

      // Check hover over flying envelope
      let hoverEnvelope = false;
      if (this.flyingPackets && this.flyingPackets.length > 0) {
        const sim = window.PXLNetworkSim;
        for (const fp of this.flyingPackets) {
          const devA = sim?.devices[fp.fromDevId];
          const devB = sim?.devices[fp.toDevId];
          if (!devA || !devB) continue;
          const curX = (devA.x + 35) + ((devB.x + 35) - (devA.x + 35)) * fp.progress;
          const curY = (devA.y + 35) + ((devB.y + 35) - (devA.y + 35)) * fp.progress;
          if (Math.hypot(pos.x - curX, pos.y - curY) <= 18) {
            hoverEnvelope = true;
            break;
          }
        }
      }

      if (hoverEnvelope || hoverEndpoint || hoverCable) {
        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = hoverDev ? 'grab' : 'default';
      }

      let needRender = false;
      if (this.hoveredEndpoint !== hoverEndpoint) {
        this.hoveredEndpoint = hoverEndpoint;
        needRender = true;
      }
      if (this.hoveredDevice !== hoverDev) {
        this.hoveredDevice = hoverDev;
        needRender = true;
      }
      if (needRender) {
        this.render();
      }
    }
  }

  handleMouseUp(e) {
    if (this.draggedDevice) {
      const dev = this.draggedDevice;
      this.draggedDevice = null;
      this.hoveredDevice = null;
      if (!this.hasMovedDevice) {
        // Single click without dragging opens device modal (Packet Tracer standard)
        if (window.PXLApp) {
          window.PXLApp.openDeviceModal(dev);
        }
      } else {
        if (window.PXLApp) window.PXLApp.triggerScoreUpdate();
      }
    }
    this.isPanning = false;
    if (this.activeTool === 'select') {
      this.canvas.style.cursor = 'default';
    }
  }

  handleDoubleClick(e) {
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    const clickedDev = this.getDeviceAt(pos.x, pos.y);
    if (clickedDev && window.PXLApp) {
      window.PXLApp.openDeviceModal(clickedDev);
    }
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.4, Math.min(2.5, this.scale * zoomFactor));

    const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
    const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;

    this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
    this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
    this.scale = newScale;

    this.render();
  }

  getDeviceAt(x, y) {
    const sim = window.PXLNetworkSim;
    if (!sim) return null;
    const devs = Object.values(sim.devices);
    // Search in reverse for top-most
    for (let i = devs.length - 1; i >= 0; i--) {
      const d = devs[i];
      // Target 70x70 device footprint + padding for easy grabbing
      if (x >= d.x - 5 && x <= d.x + 75 && y >= d.y - 5 && y <= d.y + 85) {
        return d;
      }
    }
    return null;
  }

  getCableAt(x, y) {
    const sim = window.PXLNetworkSim;
    if (!sim) return null;
    for (const cable of sim.cables) {
      const devA = sim.devices[cable.fromDevice];
      const devB = sim.devices[cable.toDevice];
      if (!devA || !devB) continue;
      const x1 = devA.x + 35, y1 = devA.y + 35;
      const x2 = devB.x + 35, y2 = devB.y + 35;
      const dist = this.distToSegment({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 });
      if (dist < 10) return cable;
    }
    return null;
  }

  /**
   * Detects if (x, y) is on or near either endpoint's Link LED or port pill badge.
   * Returns metadata including cable, side ('from'|'to'), device, and port name.
   */
  getCableEndpointAt(x, y) {
    const sim = window.PXLNetworkSim;
    if (!sim) return null;

    for (const cable of sim.cables) {
      const devA = sim.devices[cable.fromDevice];
      const devB = sim.devices[cable.toDevice];
      if (!devA || !devB) continue;

      const x1 = devA.x + 35, y1 = devA.y + 35;
      const x2 = devB.x + 35, y2 = devB.y + 35;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;

      // Endpoint A (fromDevice / fromPort)
      const ledAx = x1 + dx * 0.22;
      const ledAy = y1 + dy * 0.22;
      const badgeAx = ledAx + nx * 16;
      const badgeAy = ledAy + ny * 16;

      if (Math.hypot(x - ledAx, y - ledAy) <= 15 || Math.hypot(x - badgeAx, y - badgeAy) <= 18) {
        return {
          cable,
          side: 'from',
          device: devA,
          port: cable.fromPort,
          peerDevice: devB,
          peerPort: cable.toPort,
          x: ledAx,
          y: ledAy
        };
      }

      // Endpoint B (toDevice / toPort)
      const ledBx = x2 - dx * 0.22;
      const ledBy = y2 - dy * 0.22;
      const badgeBx = ledBx - nx * 16;
      const badgeBy = ledBy - ny * 16;

      if (Math.hypot(x - ledBx, y - ledBy) <= 15 || Math.hypot(x - badgeBx, y - badgeBy) <= 18) {
        return {
          cable,
          side: 'to',
          device: devB,
          port: cable.toPort,
          peerDevice: devA,
          peerPort: cable.fromPort,
          x: ledBx,
          y: ledBy
        };
      }
    }
    return null;
  }

  distToSegment(p, v, w) {
    const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  setTool(tool) {
    this.activeTool = tool;
    if (tool !== 'cable') {
      this.cabling.setCableType(null);
    }
    if (tool !== 'place') {
      this.placingDeviceSpec = null;
    }
    this.canvas.style.cursor = tool === 'delete' ? 'not-allowed' : 'default';
    this.render();
  }

  resetZoom() {
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.render();
  }

  // --- RENDERING PIPELINE ---

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Apply pan & zoom
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    // 1. Draw Grid Pattern
    this.drawGrid(ctx, w, h);

    // 2. Draw Wireless Associations
    this.drawWirelessWaves(ctx);

    // 3. Draw Cables & Link LEDs
    this.drawCables(ctx);

    // 4. Draw Flying Animated Packets (Packet Tracer envelope flow)
    this.drawFlyingPackets(ctx);

    // 5. Draw Pending Rubber-band Cable
    this.drawPendingCable(ctx);

    // 6. Draw Devices
    this.drawDevices(ctx);

    // 7. Draw Hover Tooltips (Device Summary / Port Details)
    this.drawHoverTooltip(ctx);

    ctx.restore();
  }

  drawGrid(ctx, screenW, screenH) {
    const gridSize = 30;
    const startX = Math.floor(-this.panX / this.scale / gridSize) * gridSize - gridSize;
    const endX = startX + (screenW / this.scale) + (gridSize * 2);
    const startY = Math.floor(-this.panY / this.scale / gridSize) * gridSize - gridSize;
    const endY = startY + (screenH / this.scale) + (gridSize * 2);

    ctx.fillStyle = "#cbd5e1";
    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  toggleWifiSignals() {
    this.showWifiSignals = !this.showWifiSignals;
    const txt = document.getElementById('wifiSignalsToggleText');
    if (txt) {
      txt.innerText = `📶 Wi-Fi Golven: ${this.showWifiSignals ? 'Aan' : 'Uit'}`;
    }
    this.render();
  }

  drawWirelessWaves(ctx) {
    if (!this.showWifiSignals) return;
    const sim = window.PXLNetworkSim;
    if (!sim) return;
    sim.updateWirelessAssociations();

    const aps = Object.values(sim.devices).filter(d => 
      (d.type === 'wireless_ap' || d.type === 'wireless_router' || d.type === 'wlc') && d.powerOn
    );

    // 1. Draw Concentric RF Propagation Zones around each active AP / Wireless Router
    for (const ap of aps) {
      const cx = ap.x + 35;
      const cy = ap.y + 35;

      ctx.save();

      // Zone 1: Direct High-Speed Core (< 100px / > -52 dBm)
      ctx.beginPath();
      ctx.arc(cx, cy, 100, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(16, 185, 129, 0.04)";
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      // Zone 2: Enterprise VoIP Norm Boundary (180px / -67 dBm)
      ctx.beginPath();
      ctx.arc(cx, cy, 180, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(14, 165, 233, 0.03)";
      ctx.fill();
      ctx.strokeStyle = "rgba(14, 165, 233, 0.50)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 4]);
      ctx.stroke();

      // Zone 2 Boundary Label
      ctx.fillStyle = "rgba(14, 165, 233, 0.85)";
      ctx.font = "bold 9px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("-67 dBm (VoIP Norm)", cx, cy - 184);

      // Zone 3: Roaming Warning Boundary (270px / -76 dBm)
      ctx.beginPath();
      ctx.arc(cx, cy, 270, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.fillStyle = "rgba(245, 158, 11, 0.70)";
      ctx.fillText("-76 dBm (Roaming)", cx, cy - 274);

      // Zone 4: Drop Threshold Outer Boundary (380px / -88 dBm)
      ctx.beginPath();
      ctx.arc(cx, cy, 380, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      ctx.fillStyle = "rgba(239, 68, 68, 0.60)";
      ctx.fillText("-88 dBm (Drop Drempel)", cx, cy - 384);

      // Subtle Pulsing Expanding Wave Animation
      const pulseTime = Date.now() / 35;
      const pulseR1 = (pulseTime % 360) + 15;
      const pulseR2 = ((pulseTime + 180) % 360) + 15;
      const alpha1 = Math.max(0, 0.28 * (1 - pulseR1 / 380));
      const alpha2 = Math.max(0, 0.28 * (1 - pulseR2 / 380));

      ctx.beginPath();
      ctx.arc(cx, cy, pulseR1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha1})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, pulseR2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha2})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }

    // 2. Draw Dynamic Rays Connecting Associated Clients & APs (Distance Attenuation)
    for (const [clientId, apId] of Object.entries(sim.wirelessAssociations)) {
      const client = sim.devices[clientId];
      const ap = sim.devices[apId];
      if (!client || !ap || !client.powerOn || !ap.powerOn) continue;

      const x1 = ap.x + 35, y1 = ap.y + 35;
      const x2 = client.x + 35, y2 = client.y + 35;
      const rssi = client.wireless?.rssi !== undefined ? client.wireless.rssi : -60;

      // Dynamic color, opacity and thickness based on real RSSI (User Request: signal lighter and worse as distance increases)
      let rayColor = '#10b981';
      let rayAlpha = 0.90;
      let rayWidth = 2.6;
      let dashPattern = [6, 4];

      if (rssi >= -55) {
        rayColor = '#10b981'; // Vibrant Emerald Green
        rayAlpha = 0.90;
        rayWidth = 2.6;
        dashPattern = [6, 4];
      } else if (rssi >= -68) {
        rayColor = '#0ea5e9'; // Sky Blue (VoIP compliant)
        rayAlpha = 0.75;
        rayWidth = 2.2;
        dashPattern = [5, 4];
      } else if (rssi >= -78) {
        rayColor = '#f59e0b'; // Amber / Yellow (Degrading)
        rayAlpha = 0.55;
        rayWidth = 1.8;
        dashPattern = [4, 5];
      } else if (rssi >= -85) {
        rayColor = '#ef4444'; // Light / Faded Red
        rayAlpha = 0.32;       // Lighter and poorer signal!
        rayWidth = 1.3;
        dashPattern = [3, 6];
      } else {
        rayColor = '#ef4444'; // Marginal / Barely connected
        rayAlpha = 0.16;       // Extremely faint!
        rayWidth = 1.0;
        dashPattern = [2, 8];
      }

      ctx.save();
      ctx.strokeStyle = rayColor;
      ctx.globalAlpha = rayAlpha;
      ctx.lineWidth = rayWidth;
      ctx.setLineDash(dashPattern);
      ctx.lineDashOffset = -((Date.now() / 40) % 12);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Midpoint glowing data packet dot
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.fillStyle = rayColor;
      ctx.globalAlpha = Math.min(1, rayAlpha + 0.2);
      ctx.beginPath();
      ctx.arc(midX, midY, rayWidth * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Floating Live Signal Badge right next to the wireless client
      const badgeX = client.x + 65;
      const badgeY = client.y + 12;
      const badgeText = `${rssi} dBm • ${client.wireless?.txRate || 0}M`;

      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.strokeStyle = rayColor;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = Math.max(0.4, rayAlpha);
      
      const textWidth = ctx.measureText(badgeText).width + 18;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY - 10, textWidth, 18, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`📶 ${badgeText}`, badgeX + 4, badgeY + 3);

      ctx.restore();
    }
  }

  drawCables(ctx) {
    const sim = window.PXLNetworkSim;
    if (!sim) return;

    for (const cable of sim.cables) {
      const devA = sim.devices[cable.fromDevice];
      const devB = sim.devices[cable.toDevice];
      if (!devA || !devB) continue;

      const x1 = devA.x + 35, y1 = devA.y + 35;
      const x2 = devB.x + 35, y2 = devB.y + 35;

      ctx.save();

      if (cable.type === 'crossover') {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
      } else if (cable.type === 'serial') {
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      } else if (cable.type === 'console') {
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      if (cable.type === 'serial') {
        this.drawSerialLightning(ctx, x1, y1, x2, y2);
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      const isUpA = sim.isLinkUp(devA.id, cable.fromPort);
      const isUpB = sim.isLinkUp(devB.id, cable.toPort);

      const intfA = devA.interfaces[cable.fromPort];
      const intfB = devB.interfaces[cable.toPort];

      const colorA = (!devA.powerOn || (intfA && intfA.shutdown)) ? '#ef4444' : (isUpA ? '#22c55e' : '#f59e0b');
      const colorB = (!devB.powerOn || (intfB && intfB.shutdown)) ? '#ef4444' : (isUpB ? '#22c55e' : '#f59e0b');

      this.drawLinkLed(ctx, x1, y1, x2, y2, 0.22, colorA, cable.fromPort);
      this.drawLinkLed(ctx, x2, y2, x1, y1, 0.22, colorB, cable.toPort);

      // Highlight hovered cable endpoint
      if (this.hoveredEndpoint && this.hoveredEndpoint.cable.id === cable.id) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.hoveredEndpoint.x, this.hoveredEndpoint.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Packet Tracer clock icon on DCE end of serial cable
      if (cable.type === 'serial') {
        const isDceA = Boolean(intfA && intfA.clockRate) || cable.dceDevice === devA.id || (!cable.dceDevice && !intfB?.clockRate);
        if (isDceA) {
          this.drawSerialClockIcon(ctx, x1, y1, x2, y2, 0.28);
        } else {
          this.drawSerialClockIcon(ctx, x2, y2, x1, y1, 0.28);
        }
      }

      ctx.restore();
    }
  }

  drawSerialClockIcon(ctx, fromX, fromY, toX, toY, ratio) {
    const x = fromX + (toX - fromX) * ratio;
    const y = fromY + (toY - fromY) * ratio;

    ctx.save();
    // Circular clock face
    ctx.beginPath();
    ctx.arc(x, y, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Center pivot dot
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Clock hands pointing at 3 o'clock (authentic Packet Tracer DCE clock)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 4); // 12 o'clock hand
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3.8, y); // 3 o'clock hand
    ctx.stroke();
    ctx.restore();
  }

  drawSerialLightning(ctx, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 20) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      return;
    }
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const perpX = -dy / dist * 10;
    const perpY = dx / dist * 10;

    ctx.moveTo(x1, y1);
    ctx.lineTo(midX - dx * 0.15 + perpX, midY - dy * 0.15 + perpY);
    ctx.lineTo(midX + dx * 0.15 - perpX, midY + dy * 0.15 - perpY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  togglePortLabels() {
    this.showPortLabels = !this.showPortLabels;
    this.render();
    const btnText = document.getElementById('portLabelsToggleText');
    if (btnText) {
      btnText.textContent = this.showPortLabels ? '🏷️ Poorten: Aan' : '🏷️ Poorten: Uit';
    }
    return this.showPortLabels;
  }

  drawLinkLed(ctx, fromX, fromY, toX, toY, ratio, color, portLabel) {
    const x = fromX + (toX - fromX) * ratio;
    const y = fromY + (toY - fromY) * ratio;

    ctx.save();

    // 1. Draw Link LED Circle directly on the wire
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // 2. Draw Crisp High-Contrast Port Pill Badge
    if (this.showPortLabels !== false && this.scale >= 0.35 && portLabel) {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const dist = Math.hypot(dx, dy) || 1;

      // Perpendicular unit vector (normal)
      const nx = -dy / dist;
      const ny = dx / dist;

      // Offset badge 16px orthogonally away from the cable to prevent overlapping
      const offsetDist = 16;
      const badgeX = x + nx * offsetDist;
      const badgeY = y + ny * offsetDist;

      // Professional short port naming
      const shortPort = portLabel
        .replace(/^GigabitEthernet/i, 'Gi')
        .replace(/^FastEthernet/i, 'Fa')
        .replace(/^Serial/i, 'Se')
        .replace(/^Ethernet/i, 'Eth')
        .replace(/^Wireless0/i, 'WLAN0')
        .replace(/^Console/i, 'Console')
        .replace(/^RS 232/i, 'RS-232');

      ctx.font = 'bold 10px Consolas, "Courier New", monospace';
      const textMetrics = ctx.measureText(shortPort);
      const textWidth = textMetrics.width;
      const padX = 5;
      const w = textWidth + padX * 2;
      const h = 16;
      const rx = badgeX - w / 2;
      const ry = badgeY - h / 2;

      // Crisp white pill badge with drop shadow
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(rx, ry, w, h, 4);
      } else {
        ctx.rect(rx, ry, w, h);
      }
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 4;
      ctx.fill();

      // Border matching link state (red if down) or crisp Packet Tracer cyan/blue
      ctx.shadowBlur = 0;
      ctx.strokeStyle = color === '#ef4444' ? '#ef4444' : '#0284c7';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // High-contrast dark text
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortPort, badgeX, badgeY + 0.5);
    }
    ctx.restore();
  }

  drawPendingCable(ctx) {
    const pending = this.cabling.pendingConnection;
    if (!pending) return;
    const sim = window.PXLNetworkSim;
    const dev = sim.devices[pending.fromDevId];
    if (!dev) return;

    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(dev.x + 35, dev.y + 35);
    ctx.lineTo(this.mouseCanvasPos.x, this.mouseCanvasPos.y);
    ctx.stroke();
    ctx.restore();
  }

  drawDevices(ctx) {
    const sim = window.PXLNetworkSim;
    if (!sim) return;

    for (const dev of Object.values(sim.devices)) {
      ctx.save();

      // Selection Highlight Glow
      if (this.selectedDevice && this.selectedDevice.id === dev.id) {
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(dev.x - 4, dev.y - 4, 78, 78);
        ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
        ctx.fillRect(dev.x - 4, dev.y - 4, 78, 78);
      }

      // Render Device (SVG Image or Native Canvas Fallback)
      this.drawDeviceIcon(ctx, dev);

      // Power Indicator LED
      ctx.beginPath();
      ctx.arc(dev.x + 62, dev.y + 10, 4, 0, Math.PI * 2);
      ctx.fillStyle = dev.powerOn ? '#22c55e' : '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Hostname Label (Packet Tracer styling)
      ctx.font = 'bold 12px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(dev.hostname, dev.x + 35, dev.y + 80);

      // Model sublabel
      ctx.font = '10px Inter, Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(dev.model || dev.type, dev.x + 35, dev.y + 93);

      ctx.restore();
    }
  }

  drawDeviceIcon(ctx, dev) {
    const key = `${dev.type}_${dev.model}`;

    if (!this.iconCache[key]) {
      const svgString = getCiscoDeviceIcon(dev.type, dev.model);
      const img = new Image();
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.src = url;
      img.onload = () => {
        this.render();
      };
      this.iconCache[key] = img;
    }

    const img = this.iconCache[key];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, dev.x, dev.y, 70, 70);
    } else {
      // Robust Native Canvas Fallback Vector Graphics
      this.drawNativeDeviceFallback(ctx, dev);
    }
  }

  drawNativeDeviceFallback(ctx, dev) {
    const x = dev.x;
    const y = dev.y;

    if (dev.type === 'router') {
      // Cylinder
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 35, y + 35, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Arrows
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x + 18, y + 35); ctx.lineTo(x + 28, y + 30); ctx.lineTo(x + 28, y + 40); ctx.fill();
      ctx.moveTo(x + 52, y + 35); ctx.lineTo(x + 42, y + 30); ctx.lineTo(x + 42, y + 40); ctx.fill();
      ctx.moveTo(x + 35, y + 18); ctx.lineTo(x + 30, y + 28); ctx.lineTo(x + 40, y + 28); ctx.fill();
      ctx.moveTo(x + 35, y + 52); ctx.lineTo(x + 30, y + 42); ctx.lineTo(x + 40, y + 42); ctx.fill();
    } else if (dev.type === 'switch') {
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 2;
      ctx.fillRect(x + 8, y + 15, 54, 40);
      ctx.strokeRect(x + 8, y + 15, 54, 40);

      // Opposing arrows
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x + 18, y + 25); ctx.lineTo(x + 36, y + 25); ctx.lineTo(x + 36, y + 22); ctx.lineTo(x + 42, y + 27); ctx.lineTo(x + 36, y + 32); ctx.lineTo(x + 36, y + 29); ctx.lineTo(x + 18, y + 29); ctx.fill();
      ctx.moveTo(x + 52, y + 42); ctx.lineTo(x + 34, y + 42); ctx.lineTo(x + 34, y + 39); ctx.lineTo(x + 28, y + 44); ctx.lineTo(x + 34, y + 49); ctx.lineTo(x + 34, y + 46); ctx.lineTo(x + 52, y + 46); ctx.fill();
    } else if (dev.type === 'mikrotik') {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(x + 6, y + 15, 58, 38);
      ctx.strokeRect(x + 6, y + 15, 58, 38);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x + 12, y + 22, 10, 10);
      for (let p = 0; p < 5; p++) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 28 + (p * 7), y + 24, 5, 8);
      }
    } else if (dev.type === 'openwrt') {
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.fillRect(x + 8, y + 18, 54, 34);
      ctx.strokeRect(x + 8, y + 18, 54, 34);
      // Antennas
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 18); ctx.lineTo(x + 12, y + 8);
      ctx.moveTo(x + 54, y + 18); ctx.lineTo(x + 58, y + 8);
      ctx.stroke();
    } else if (dev.type === 'internet_cloud' || dev.type === 'internet_simulated' || dev.type === 'internet_public') {
      const isPub = (dev.type === 'internet_public' || (dev.type === 'internet_cloud' && sim.liveInternetEnabled));
      // Cloud shape
      ctx.fillStyle = isPub ? '#059669' : '#38bdf8';
      ctx.strokeStyle = isPub ? '#10b981' : '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 26, y + 36, 14, 0, Math.PI * 2);
      ctx.arc(x + 42, y + 26, 16, 0, Math.PI * 2);
      ctx.arc(x + 56, y + 36, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Badge on cloud
      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(isPub ? 'LIVE' : 'SIM', x + 42, y + 39);
    } else if (dev.type === 'pc' || dev.type === 'server') {
      // Monitor + base
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(x + 10, y + 12, 40, 30);
      ctx.strokeRect(x + 10, y + 12, 40, 30);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x + 13, y + 15, 34, 24);
      // Stand
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 26, y + 42, 8, 8);
      ctx.fillRect(x + 18, y + 50, 24, 4);
    } else {
      // Laptop / Default
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 12, y + 15, 46, 30);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x + 15, y + 18, 40, 24);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 8, y + 45, 54, 8);
    }
  }

  // --- PACKET TRACER FLYING ENVELOPES ANIMATION ---

  enqueueFlyingPacket(fromDevId, toDevId, protocol = 'ICMP', label = 'ICMP', packet = null) {
    if (!this.flyingPackets) this.flyingPackets = [];
    let borderColor = '#0284c7';
    let bgColor = '#ffffff';
    let textColor = '#0284c7';

    if (protocol === 'ICMP') {
      borderColor = '#059669';
      bgColor = '#ecfdf5';
      textColor = '#047857';
    } else if (protocol === 'ARP') {
      borderColor = '#d97706';
      bgColor = '#fffbeb';
      textColor = '#b45309';
    } else if (protocol === 'TCP') {
      borderColor = '#2563eb';
      bgColor = '#eff6ff';
      textColor = '#1d4ed8';
    } else if (protocol === 'HTTP') {
      borderColor = '#16a34a';
      bgColor = '#f0fdf4';
      textColor = '#15803d';
    } else if (protocol === 'DNS') {
      borderColor = '#6366f1';
      bgColor = '#eef2ff';
      textColor = '#4f46e5';
    } else if (protocol === 'DHCP') {
      borderColor = '#db2777';
      bgColor = '#fdf2f8';
      textColor = '#be185d';
    }

    this.flyingPackets.push({
      fromDevId,
      toDevId,
      protocol,
      label,
      packet,
      progress: 0.0,
      speed: 0.022,
      borderColor,
      bgColor,
      textColor
    });

    if (!this.animating) {
      this.animating = true;
      requestAnimationFrame(() => {
        this.animating = false;
        this.render();
      });
    }
  }

  drawFlyingPackets(ctx) {
    if (!this.flyingPackets || this.flyingPackets.length === 0) return;
    const sim = window.PXLNetworkSim;
    if (!sim) return;

    for (let i = this.flyingPackets.length - 1; i >= 0; i--) {
      const fp = this.flyingPackets[i];
      const devA = sim.devices[fp.fromDevId];
      const devB = sim.devices[fp.toDevId];

      if (!devA || !devB) {
        this.flyingPackets.splice(i, 1);
        continue;
      }

      const x1 = devA.x + 35;
      const y1 = devA.y + 35;
      const x2 = devB.x + 35;
      const y2 = devB.y + 35;

      const curX = x1 + (x2 - x1) * fp.progress;
      const curY = y1 + (y2 - y1) * fp.progress;

      // Draw Packet Tracer envelope
      ctx.save();
      ctx.translate(curX, curY);

      // Drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;

      // Envelope body (20x14)
      ctx.fillStyle = fp.bgColor || '#ffffff';
      ctx.strokeStyle = fp.borderColor || '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-10, -7, 20, 14, 2);
      } else {
        ctx.rect(-10, -7, 20, 14);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Envelope flap lines
      ctx.strokeStyle = fp.borderColor || '#0284c7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-10, -7);
      ctx.lineTo(0, 1);
      ctx.lineTo(10, -7);
      ctx.stroke();

      // Protocol badge above envelope
      ctx.font = 'bold 8px Consolas, monospace';
      ctx.fillStyle = fp.textColor || '#0284c7';
      ctx.textAlign = 'center';
      ctx.fillText(fp.label || fp.protocol || 'PDU', 0, -10);

      ctx.restore();

      // Advance progress
      fp.progress += fp.speed || 0.022;
      if (fp.progress >= 1.0) {
        this.flyingPackets.splice(i, 1);
      }
    }

    // Continue animation loop while envelopes are flying
    if (this.flyingPackets.length > 0 && !this.animating) {
      this.animating = true;
      requestAnimationFrame(() => {
        this.animating = false;
        this.render();
      });
    }
  }

  // --- PACKET TRACER SUMMARY HOVER TOOLTIP ---

  drawHoverTooltip(ctx) {
    if (!this.hoveredDevice || this.isPanning || this.draggedDevice) return;
    const dev = this.hoveredDevice;
    const sim = window.PXLNetworkSim;
    if (!sim) return;

    // Collect active interface entries
    const intfRows = [];
    if (dev.interfaces) {
      for (const [pName, intf] of Object.entries(dev.interfaces)) {
        if (pName === 'Aux' || pName === 'USB0' || pName === 'RS 232') continue;
        const isUp = sim.isLinkUp(dev.id, pName);
        let ipDisp = (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server')
          ? (dev.ip || '--')
          : (intf.ip || (pName === 'Vlan1' && dev.ip) || '--');
        if (ipDisp !== '--' && (intf.mask || dev.mask)) {
          ipDisp += `/${IPUtils.maskToCidr ? IPUtils.maskToCidr(intf.mask || dev.mask) : '24'}`;
        }
        const macDisp = intf.mac || (dev.interfaces?.['FastEthernet0']?.mac) || '--';

        const cable = sim.getCableOnPort(dev.id, pName);
        if (cable || isUp || ipDisp !== '--' || pName === 'Vlan1' || pName === 'FastEthernet0/1' || pName === 'GigabitEthernet0/0/0') {
          const shortName = pName.replace('GigabitEthernet', 'Gi').replace('FastEthernet', 'Fa').replace('Serial', 'Se');
          intfRows.push({
            name: shortName,
            status: isUp ? 'Up' : 'Down',
            ip: ipDisp,
            mac: macDisp
          });
        }
      }
    }

    if (intfRows.length === 0) return;

    ctx.save();
    const tooltipX = dev.x + 85;
    const tooltipY = dev.y - 10;

    const rowH = 15;
    const headerH = 26;
    const tableHeaderH = 18;
    const totalH = headerH + tableHeaderH + (intfRows.length * rowH) + 8;
    const totalW = 320;

    // Shadow & background
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(tooltipX, tooltipY, totalW, totalH, 6);
    } else {
      ctx.rect(tooltipX, tooltipY, totalW, totalH);
    }
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${dev.hostname} (${dev.model || dev.type})`, tooltipX + 10, tooltipY + 17);

    // Separator line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tooltipX + 6, tooltipY + headerH);
    ctx.lineTo(tooltipX + totalW - 6, tooltipY + headerH);
    ctx.stroke();

    // Table Header
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px Consolas, monospace';
    let curY = tooltipY + headerH + 13;
    ctx.fillText('PORT', tooltipX + 10, curY);
    ctx.fillText('LINK', tooltipX + 65, curY);
    ctx.fillText('IP ADDRESS', tooltipX + 105, curY);
    ctx.fillText('MAC ADDRESS', tooltipX + 215, curY);

    // Table Rows
    ctx.font = '9px Consolas, monospace';
    curY += 6;
    for (const r of intfRows) {
      curY += rowH;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(r.name, tooltipX + 10, curY);

      ctx.fillStyle = r.status === 'Up' ? '#4ade80' : '#f87171';
      ctx.fillText(r.status, tooltipX + 65, curY);

      ctx.fillStyle = r.ip !== '--' ? '#38bdf8' : '#64748b';
      ctx.fillText(r.ip, tooltipX + 105, curY);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(r.mac, tooltipX + 215, curY);
    }

    // Wi-Fi Telemetry & Theory Badge in Tooltip
    if (dev.wireless && dev.wireless.installed && dev.wireless.enabled) {
      curY += 14;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(tooltipX + 6, curY - 6);
      ctx.lineTo(tooltipX + totalW - 6, curY - 6);
      ctx.stroke();

      if (dev.wireless.associatedAp) {
        ctx.fillStyle = dev.wireless.rssi >= -67 ? '#34d399' : dev.wireless.rssi >= -78 ? '#fbbf24' : '#f87171';
        ctx.font = 'bold 9px Consolas, monospace';
        ctx.fillText(`📶 Wi-Fi: ${dev.wireless.ssid} (${dev.wireless.rssi} dBm, SNR +${dev.wireless.snr}dB, ${dev.wireless.txRate}M)`, tooltipX + 10, curY + 4);
        ctx.fillStyle = dev.wireless.rssi >= -67 ? '#059669' : '#b45309';
        ctx.fillText(dev.wireless.rssi >= -67 ? '✅ Voldoet aan -67 dBm VoIP norm' : '⚠️ Zwakker dan VoIP norm (-67 dBm)', tooltipX + 10, curY + 16);
      } else if (dev.type === 'wireless_ap' || dev.type === 'wireless_router' || dev.type === 'wlc') {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px Consolas, monospace';
        const apSsid = dev.wireless.ssid || (dev.type === 'wireless_router' ? 'PXL-Wireless-Router' : 'PXL-Klas-AP');
        ctx.fillText(`📶 Radio: ${apSsid} | Ch ${dev.wireless.channel || 6} (20MHz) | ${dev.wireless.authMode || 'WPA2'}`, tooltipX + 10, curY + 4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Zendvermogen: 15 dBm | Ruisvloer: ${dev.wireless.noiseFloor || -90} dBm`, tooltipX + 10, curY + 16);
      }
    }

    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CanvasWorkspace };
}
