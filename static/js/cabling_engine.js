/**
 * cabling_engine.js - Interactive Cable Drawing, Port Selection, and Link LEDs
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class CablingEngine {
  constructor(canvasWorkspace) {
    this.workspace = canvasWorkspace;
    this.activeCableType = null; // 'straight', 'crossover', 'serial', 'console', 'auto'
    this.pendingConnection = null; // { fromDevId, fromPortName }
    this.popoverEl = null;
  }

  setCableType(type) {
    this.activeCableType = type;
    this.cancelPending();
    const canvas = document.getElementById('networkCanvas');
    if (canvas) {
      canvas.style.cursor = type ? 'crosshair' : 'default';
    }
  }

  cancelPending() {
    this.pendingConnection = null;
    this.closePortPopover();
    this.workspace.render();
  }

  /**
   * Handles user click on a device while a cable tool is active
   */
  handleDeviceClick(dev, clickX, clickY) {
    if (!this.activeCableType) return;

    if (!this.pendingConnection) {
      // First endpoint: open port picker for Device A
      this.showPortPopover(dev, clickX, clickY, (chosenPort) => {
        this.pendingConnection = {
          fromDevId: dev.id,
          fromPortName: chosenPort,
          type: this.activeCableType
        };
        this.closePortPopover();
        this.workspace.render();
      });
    } else {
      // Second endpoint: open port picker for Device B
      if (this.pendingConnection.fromDevId === dev.id) {
        this.cancelPending();
        return;
      }

      this.showPortPopover(dev, clickX, clickY, (chosenPort) => {
        const fromDevId = this.pendingConnection.fromDevId;
        const fromPortName = this.pendingConnection.fromPortName;
        const cableType = this.pendingConnection.type;

        // Create the cable
        const cableId = `cable_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const newCable = {
          id: cableId,
          fromDevice: fromDevId,
          fromPort: fromPortName,
          toDevice: dev.id,
          toPort: chosenPort,
          type: cableType === 'auto' ? this.autoDetermineCableType(fromDevId, dev.id) : cableType
        };

        window.PXLNetworkSim.addCable(newCable);
        this.cancelPending();
        this.workspace.render();
        if (window.PXLApp) window.PXLApp.triggerScoreUpdate();
      });
    }
  }

  autoDetermineCableType(devAId, devBId) {
    const sim = window.PXLNetworkSim;
    const devA = sim.devices[devAId];
    const devB = sim.devices[devBId];
    if (!devA || !devB) return 'straight';
    const isLikeRouterOrHost = (t) => t === 'router' || t === 'pc' || t === 'laptop' || t === 'server';
    if (isLikeRouterOrHost(devA.type) && isLikeRouterOrHost(devB.type)) {
      return 'crossover';
    }
    return 'straight';
  }

  showPortPopover(dev, x, y, onSelect) {
    this.closePortPopover();
    const pop = document.createElement('div');
    pop.className = 'pt-port-popover';
    pop.style.left = `${x + 10}px`;
    pop.style.top = `${y - 20}px`;

    const title = document.createElement('div');
    title.className = 'pt-popover-title';
    title.innerText = `Kies poort op ${dev.hostname}:`;
    pop.appendChild(title);

    if (this.activeCableType === 'console') {
      const tip = document.createElement('div');
      tip.style.fontSize = '10px';
      tip.style.color = '#0284c7';
      tip.style.padding = '4px 8px';
      tip.style.background = '#e0f2fe';
      tip.style.borderRadius = '3px';
      tip.style.marginBottom = '6px';
      tip.innerText = '💡 Console kabel: kies RS 232 of USB op PC, en Console op router/switch';
      pop.appendChild(tip);
    }

    const list = document.createElement('div');
    list.className = 'pt-popover-list';

    const sim = window.PXLNetworkSim;
    let ports = Object.keys(dev.interfaces).filter(p => {
      const lower = p.toLowerCase();
      if (lower.startsWith('vlan') || lower.startsWith('loopback') || lower.startsWith('null')) return false;
      const isConsoleType = (p === 'Console' || p === 'Aux' || p === 'RS 232' || p === 'USB0');
      if (this.activeCableType === 'console') {
        return isConsoleType;
      } else {
        return !isConsoleType;
      }
    });

    if (this.activeCableType === 'console') {
      const isConsoleType = (p) => p === 'Console' || p === 'Aux' || p === 'RS 232' || p === 'USB0';
      ports.sort((a, b) => (isConsoleType(b) ? 1 : 0) - (isConsoleType(a) ? 1 : 0));
    }

    ports.forEach(pName => {
      const isUsed = sim.getCableOnPort(dev.id, pName);
      const isConsolePreferred = (this.activeCableType === 'console') && (pName === 'Console' || pName === 'Aux' || pName === 'RS 232' || pName === 'USB0');
      const item = document.createElement('button');
      item.className = `pt-port-item ${isUsed ? 'disabled' : ''}`;
      if (isConsolePreferred) {
        item.style.fontWeight = 'bold';
        item.style.color = '#0284c7';
        item.style.borderColor = '#38bdf8';
      }
      
      let displayLabel = pName;
      if (pName === 'RS 232') displayLabel = 'RS 232 (Serial COM1)';
      else if (pName === 'USB0') displayLabel = 'USB0 (USB Console)';
      else if (pName === 'Console') displayLabel = 'Console (RJ-45 / USB Console)';

      item.innerText = `${displayLabel} ${isUsed ? '(in gebruik)' : ''}`;
      if (!isUsed) {
        item.onclick = (e) => {
          e.stopPropagation();
          onSelect(pName);
        };
      } else {
        item.disabled = true;
      }
      list.appendChild(item);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'pt-port-cancel';
    cancelBtn.innerText = 'Annuleren';
    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      this.cancelPending();
    };
    pop.appendChild(list);
    pop.appendChild(cancelBtn);

    document.body.appendChild(pop);
    this.popoverEl = pop;
  }

  closePortPopover() {
    if (this.popoverEl) {
      this.popoverEl.remove();
      this.popoverEl = null;
    }
  }

  /**
   * Detaches one end of a cable and initiates interactive rubberband reconnection
   * to any other device/port on the workspace canvas.
   */
  detachAndReconnect(cableId, side) {
    const sim = window.PXLNetworkSim;
    if (!sim) return;
    const cable = sim.cables.find(c => c.id === cableId);
    if (!cable) return;

    this.closePortPopover();

    // Determine the fixed anchor end and the detached end
    const fixedDevId = (side === 'from') ? cable.toDevice : cable.fromDevice;
    const fixedPortName = (side === 'from') ? cable.toPort : cable.fromPort;
    const detachedDevId = (side === 'from') ? cable.fromDevice : cable.toDevice;
    const detachedPortName = (side === 'from') ? cable.fromPort : cable.toPort;
    const cableType = cable.type || 'straight';

    // Remove the existing cable
    sim.removeCable(cableId);

    // Anchor the connection from the fixed side
    this.pendingConnection = {
      fromDevId: fixedDevId,
      fromPortName: fixedPortName,
      type: cableType
    };
    this.activeCableType = cableType;
    if (this.workspace) {
      this.workspace.activeTool = 'cable';
      if (this.workspace.canvas) {
        this.workspace.canvas.style.cursor = 'crosshair';
      }
      this.workspace.render();
    }

    const fixedDev = sim.devices[fixedDevId];
    const detachedDev = sim.devices[detachedDevId];
    if (window.PXLApp) {
      window.PXLApp.showToast(`🔌 Kabel losgemaakt van ${detachedDev?.hostname || detachedDevId} [${detachedPortName}]! Klik op een apparaat om opnieuw aan te sluiten.`);
      window.PXLApp.triggerScoreUpdate();
    }
  }

  /**
   * Shows an interactive action popover for a cable endpoint or cable body,
   * allowing direct port switching, detaching, or disconnecting.
   */
  showCableActionPopover(cable, side = 'from', screenX = 200, screenY = 200) {
    this.closePortPopover();
    const sim = window.PXLNetworkSim;
    if (!sim || !cable) return;

    const dev = (side === 'from') ? sim.devices[cable.fromDevice] : sim.devices[cable.toDevice];
    const peerDev = (side === 'from') ? sim.devices[cable.toDevice] : sim.devices[cable.fromDevice];
    const curPort = (side === 'from') ? cable.fromPort : cable.toPort;
    const peerPort = (side === 'from') ? cable.toPort : cable.fromPort;

    if (!dev || !peerDev) return;

    // Available ports on this device matching the cable type (excluding current port)
    const availablePorts = sim.getAvailablePorts(dev.id, null, cable.type).filter(p => p !== curPort);

    const pop = document.createElement('div');
    pop.className = 'pt-cable-popover';

    // Position within viewport
    const popW = 290;
    const popH = 260;
    let posX = screenX + 12;
    let posY = screenY - 20;
    if (posX + popW > window.innerWidth - 12) posX = Math.max(12, screenX - popW - 12);
    if (posY + popH > window.innerHeight - 12) posY = Math.max(12, window.innerHeight - popH - 12);

    pop.style.left = `${posX}px`;
    pop.style.top = `${posY}px`;

    pop.innerHTML = `
      <div class="pt-cable-popover-header">
        <span class="pt-cable-popover-title">🔌 Kabelverbinding Beheren</span>
        <button class="pt-cable-popover-close" title="Sluiten">&times;</button>
      </div>

      <div class="pt-cable-popover-info">
        <div><strong>Geselecteerd:</strong> <span style="color:#0284c7; font-weight:bold;">${dev.hostname}</span> [${curPort}]</div>
        <div><strong>Verbonden met:</strong> <span style="color:#10b981; font-weight:bold;">${peerDev.hostname}</span> [${peerPort}]</div>
        <div style="font-size:10px; color:#64748b; margin-top:2px;">Type: <strong>${cable.type.toUpperCase()}</strong> | Status: <strong>${sim.isLinkUp(dev.id, curPort) ? '🟢 UP' : '🔴 DOWN'}</strong></div>
      </div>

      <div class="pt-cable-popover-section" style="display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:11px; font-weight:600; color:#334155;">Wissel poort op ${dev.hostname}:</label>
        ${availablePorts.length > 0 ? `
          <div style="display:flex; gap:6px;">
            <select class="pt-input pt-cable-port-select" style="flex:1; font-size:11px; padding:4px 6px;">
              ${availablePorts.map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
            <button class="pt-btn pt-btn-primary pt-btn-sm pt-btn-reconnect" style="white-space:nowrap;">
              Wissel
            </button>
          </div>
        ` : `
          <div style="font-size:11px; color:#94a3b8; font-style:italic;">Geen andere vrije poorten op dit toestel</div>
        `}
      </div>

      <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px; border-top:1px solid #f1f5f9; padding-top:8px;">
        <button class="pt-btn pt-btn-secondary pt-btn-sm pt-btn-move" style="width:100%; justify-content:center; font-size:11px;">
          🔀 Verplaats naar ander toestel...
        </button>
        <button class="pt-btn pt-btn-secondary pt-btn-sm pt-btn-disconnect" style="width:100%; justify-content:center; color:#ef4444; border-color:#fca5a5; font-size:11px;">
          ✂️ Kabel loskoppelen (verwijderen)
        </button>
      </div>
    `;

    // Bind event handlers
    const closeBtn = pop.querySelector('.pt-cable-popover-close');
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); this.closePortPopover(); };

    const reconnectBtn = pop.querySelector('.pt-btn-reconnect');
    if (reconnectBtn) {
      reconnectBtn.onclick = (e) => {
        e.stopPropagation();
        const select = pop.querySelector('.pt-cable-port-select');
        const newPort = select ? select.value : null;
        if (newPort) {
          sim.reconnectCableEndpoint(cable.id, side, newPort);
          this.closePortPopover();
          if (this.workspace) this.workspace.render();
          if (window.PXLApp) {
            window.PXLApp.showToast(`✅ Kabel op ${dev.hostname} verplaatst naar ${newPort}`);
            window.PXLApp.triggerScoreUpdate();
          }
        }
      };
    }

    const moveBtn = pop.querySelector('.pt-btn-move');
    if (moveBtn) {
      moveBtn.onclick = (e) => {
        e.stopPropagation();
        this.detachAndReconnect(cable.id, side);
      };
    }

    const disconnectBtn = pop.querySelector('.pt-btn-disconnect');
    if (disconnectBtn) {
      disconnectBtn.onclick = (e) => {
        e.stopPropagation();
        sim.removeCable(cable.id);
        this.closePortPopover();
        if (this.workspace) this.workspace.render();
        if (window.PXLApp) {
          window.PXLApp.showToast(`✂️ Kabel losgekoppeld tussen ${dev.hostname} en ${peerDev.hostname}`);
          window.PXLApp.triggerScoreUpdate();
        }
      };
    }

    // Dismiss popover when clicking anywhere else outside
    const outsideClickListener = (e) => {
      if (!pop.contains(e.target)) {
        this.closePortPopover();
        document.removeEventListener('mousedown', outsideClickListener);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', outsideClickListener);
    }, 50);

    document.body.appendChild(pop);
    this.popoverEl = pop;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CablingEngine };
}

