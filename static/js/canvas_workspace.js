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
    this.activeTool = 'select'; // 'select', 'cable', 'delete', 'note'
    this.selectedDevice = null;
    this.draggedDevice = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.mouseCanvasPos = { x: 0, y: 0 };

    // Cabling Engine
    this.cabling = new CablingEngine(this);

    // Cached SVG image elements for high performance rendering
    this.iconCache = {};

    this.initEventListeners();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = this.container.clientWidth || 1200;
    this.canvas.height = this.container.clientHeight || 700;
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
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
  }

  handleMouseDown(e) {
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    const clickedDev = this.getDeviceAt(pos.x, pos.y);

    if (this.activeTool === 'delete') {
      if (clickedDev) {
        window.PXLNetworkSim.removeDevice(clickedDev.id);
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

    if (this.activeTool === 'cable') {
      if (clickedDev) {
        const screenPos = this.canvasToScreen(clickedDev.x + 35, clickedDev.y + 35);
        this.cabling.handleDeviceClick(clickedDev, screenPos.x, screenPos.y);
      } else {
        this.cabling.cancelPending();
      }
      return;
    }

    // Select Tool
    if (clickedDev) {
      this.selectedDevice = clickedDev;
      this.draggedDevice = clickedDev;
      this.dragOffsetX = pos.x - clickedDev.x;
      this.dragOffsetY = pos.y - clickedDev.y;
    } else {
      this.selectedDevice = null;
      // Start canvas panning
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
    }
    this.render();
  }

  handleMouseMove(e) {
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    this.mouseCanvasPos = pos;

    if (this.draggedDevice) {
      this.draggedDevice.x = Math.round(pos.x - this.dragOffsetX);
      this.draggedDevice.y = Math.round(pos.y - this.dragOffsetY);
      this.render();
    } else if (this.isPanning) {
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      this.render();
    } else if (this.cabling.pendingConnection) {
      this.render();
    }
  }

  handleMouseUp(e) {
    this.draggedDevice = null;
    this.isPanning = false;
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
      if (x >= d.x && x <= d.x + 70 && y >= d.y && y <= d.y + 70) {
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
      // Distance from point to line segment
      const dist = this.distToSegment({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 });
      if (dist < 8) return cable;
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

    // 4. Draw Pending Rubber-band Cable
    this.drawPendingCable(ctx);

    // 5. Draw Devices
    this.drawDevices(ctx);

    ctx.restore();
  }

  drawGrid(ctx, screenW, screenH) {
    // Subtle fine grid dots (Packet Tracer style)
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

  drawWirelessWaves(ctx) {
    const sim = window.PXLNetworkSim;
    if (!sim) return;
    sim.updateWirelessAssociations();

    for (const [clientId, apId] of Object.entries(sim.wirelessAssociations)) {
      const client = sim.devices[clientId];
      const ap = sim.devices[apId];
      if (!client || !ap || !client.powerOn || !ap.powerOn) continue;

      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(ap.x + 35, ap.y + 35);
      ctx.lineTo(client.x + 35, client.y + 35);
      ctx.stroke();

      // Radiating wave icon at midpoint
      const midX = (ap.x + client.x + 70) / 2;
      const midY = (ap.y + client.y + 70) / 2;
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.arc(midX, midY, 4, 0, Math.PI * 2);
      ctx.fill();

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

      // Cable style by type
      if (cable.type === 'crossover') {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
      } else if (cable.type === 'serial') {
        ctx.strokeStyle = '#dc2626'; // Cisco Serial red
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      } else if (cable.type === 'console') {
        ctx.strokeStyle = '#0284c7'; // Cisco Console light blue
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      } else {
        // Straight-through
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      }

      // Draw wire
      ctx.beginPath();
      if (cable.type === 'serial') {
        // Draw zigzag lightning pattern for serial
        this.drawSerialLightning(ctx, x1, y1, x2, y2);
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Draw Link Status LEDs at both ends
      const isUpA = sim.isLinkUp(devA.id, cable.fromPort);
      const isUpB = sim.isLinkUp(devB.id, cable.toPort);

      const intfA = devA.interfaces[cable.fromPort];
      const intfB = devB.interfaces[cable.toPort];

      const colorA = (!devA.powerOn || (intfA && intfA.shutdown)) ? '#ef4444' : (isUpA ? '#22c55e' : '#f59e0b');
      const colorB = (!devB.powerOn || (intfB && intfB.shutdown)) ? '#ef4444' : (isUpB ? '#22c55e' : '#f59e0b');

      this.drawLinkLed(ctx, x1, y1, x2, y2, 0.22, colorA, cable.fromPort);
      this.drawLinkLed(ctx, x2, y2, x1, y1, 0.22, colorB, cable.toPort);

      ctx.restore();
    }
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

  drawLinkLed(ctx, fromX, fromY, toX, toY, ratio, color, portLabel) {
    const x = fromX + (toX - fromX) * ratio;
    const y = fromY + (toY - fromY) * ratio;

    // Outer glow / shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fill();

    // Dark border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Port badge text
    if (this.scale >= 0.8) {
      ctx.font = '10px Inter, Arial, sans-serif';
      ctx.fillStyle = '#1e293b';
      const shortPort = portLabel.replace('GigabitEthernet', 'Gi').replace('FastEthernet', 'Fa').replace('Serial', 'Se');
      ctx.fillText(shortPort, x + 8, y + 3);
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

      // Selection box
      if (this.selectedDevice && this.selectedDevice.id === dev.id) {
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(dev.x - 6, dev.y - 6, 82, 82);
      }

      // Render Cisco Icon
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
    if (img && img.complete) {
      ctx.drawImage(img, dev.x, dev.y, 70, 70);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CanvasWorkspace };
}
