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
    let ports = Object.keys(dev.interfaces);

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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CablingEngine };
}

