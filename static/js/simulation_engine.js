/**
 * simulation_engine.js - Cisco Packet Tracer Simulation Mode & Event List Engine
 * Part of PXL Web NetSim (Hogeschool PXL)
 *
 * Provides:
 * 1. Toggle between Realtime Mode (instant execution) and Simulation Mode (step-by-step PDU flow)
 * 2. Event List Dock (Time, Last Device, At Device, Type, Info, and PDU inspector ✉️)
 * 3. Step Forward (Capture / Forward), Auto Play/Pause, Reset, and Speed Slider (0.5x, 1.0x, 2.0x)
 * 4. Interactive OSI Layer 1-7 PDU Inspector modal integration
 */

(function (window) {
  'use strict';

  class SimulationEngine {
    constructor(networkSim, canvasWorkspace) {
      this.sim = networkSim;
      this.workspace = canvasWorkspace;
      this.mode = 'realtime'; // 'realtime' | 'simulation'
      this.isPlaying = false;
      this.playInterval = null;
      this.speed = 1.0; // 0.5, 1.0, 2.0
      this.simTime = 0.000;
      this.events = [];
      this.currentEventIndex = -1;
      this.isPanelOpen = true;
      this.filters = {
        ICMP: true,
        ARP: true,
        TCP: true,
        HTTP: true,
        DNS: true,
        DHCP: true
      };

      this.initUi();
    }

    initUi() {
      // Build floating / docked Simulation Event List panel
      const existing = document.getElementById('ptSimulationPanel');
      if (existing) existing.remove();

      const panel = document.createElement('div');
      panel.id = 'ptSimulationPanel';
      panel.className = 'pt-sim-dock';
      panel.style.display = 'none';

      panel.innerHTML = `
        <div class="pt-sim-dock-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🎬</span>
            <strong>Simulatie &amp; Event List</strong>
            <span class="pt-sim-time-badge" id="simTimeBadge">0.000s</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button class="pt-sim-btn-icon" onclick="window.PXLApp.simulationEngine.togglePanel()" title="Minimaliseer paneel">_</button>
            <button class="pt-sim-btn-icon" onclick="window.PXLApp.setSimulationMode('realtime')" title="Sluiten & terug naar Realtime">✕</button>
          </div>
        </div>

        <div id="ptSimDockBody" class="pt-sim-dock-body">
          <!-- PLAYBACK CONTROLS -->
          <div class="pt-sim-controls-bar">
            <button id="simBtnPlay" class="pt-sim-ctrl-btn pt-sim-btn-play" onclick="window.PXLApp.simulationEngine.togglePlay()" title="Automatisch afspelen">
              ▶ Play
            </button>
            <button id="simBtnStep" class="pt-sim-ctrl-btn pt-sim-btn-step" onclick="window.PXLApp.simulationEngine.stepForward()" title="Eén hop vooruit (Capture / Forward)">
              ⏭️ Stap Vooruit
            </button>
            <button id="simBtnReset" class="pt-sim-ctrl-btn pt-sim-btn-reset" onclick="window.PXLApp.simulationEngine.resetSimulation()" title="Simulatie resetten">
              ⏮️ Reset
            </button>

            <div class="pt-sim-speed-box">
              <span>Snelheid:</span>
              <select id="simSpeedSelect" class="pt-sim-select" onchange="window.PXLApp.simulationEngine.setSpeed(this.value)">
                <option value="0.5">0.5x</option>
                <option value="1.0" selected>1.0x</option>
                <option value="2.0">2.0x</option>
              </select>
            </div>
          </div>

          <!-- PROTOCOL FILTER CHIPS -->
          <div class="pt-sim-filters-bar">
            <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">Filters:</span>
            <label class="pt-sim-filter-lbl"><input type="checkbox" id="simFltrIcmp" checked onchange="window.PXLApp.simulationEngine.toggleFilter('ICMP', this.checked)"> ICMP</label>
            <label class="pt-sim-filter-lbl"><input type="checkbox" id="simFltrArp" checked onchange="window.PXLApp.simulationEngine.toggleFilter('ARP', this.checked)"> ARP</label>
            <label class="pt-sim-filter-lbl"><input type="checkbox" id="simFltrTcp" checked onchange="window.PXLApp.simulationEngine.toggleFilter('TCP', this.checked)"> TCP</label>
            <label class="pt-sim-filter-lbl"><input type="checkbox" id="simFltrHttp" checked onchange="window.PXLApp.simulationEngine.toggleFilter('HTTP', this.checked)"> HTTP</label>
            <label class="pt-sim-filter-lbl"><input type="checkbox" id="simFltrDns" checked onchange="window.PXLApp.simulationEngine.toggleFilter('DNS', this.checked)"> DNS</label>
            <label class="pt-sim-filter-lbl"><input type="checkbox" id="simFltrDhcp" checked onchange="window.PXLApp.simulationEngine.toggleFilter('DHCP', this.checked)"> DHCP</label>
          </div>

          <!-- EVENT LIST TABLE -->
          <div class="pt-sim-table-wrap">
            <table class="pt-sim-table">
              <thead>
                <tr>
                  <th style="width: 38px; text-align: center;">PDU</th>
                  <th style="width: 52px;">Tijd</th>
                  <th style="width: 75px;">Van</th>
                  <th style="width: 75px;">Naar</th>
                  <th style="width: 55px;">Type</th>
                  <th>Informatie / Gebeurtenis</th>
                </tr>
              </thead>
              <tbody id="simEventListTbody">
                <tr>
                  <td colspan="6" style="text-align: center; color: #64748b; padding: 24px 10px;">
                    Geen actieve simulatie-events.<br>
                    Voer een <code>ping</code> uit in de terminal of kies testverkeer in Wireshark.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- FOOTER / HINT -->
          <div class="pt-sim-dock-footer">
            <span>💡 Klik op een <strong>✉️</strong> om de OSI lagen (1-7) &amp; PDU headers te inspecteren.</span>
            <span id="simEventCountBadge" style="font-weight: 700; color: #38bdf8;">0 events</span>
          </div>
        </div>
      `;

      const container = document.getElementById('canvasContainer') || document.body;
      container.appendChild(panel);
    }

    setMode(mode) {
      this.mode = mode;
      const btnRealtime = document.getElementById('btnModeRealtime');
      const btnSimulation = document.getElementById('btnModeSimulation');
      const panel = document.getElementById('ptSimulationPanel');

      if (mode === 'simulation') {
        if (btnRealtime) btnRealtime.classList.remove('active');
        if (btnSimulation) btnSimulation.classList.add('active');
        if (panel) panel.style.display = 'flex';
        if (window.PXLApp && window.PXLApp.showToast) {
          window.PXLApp.showToast('🎬 Simulatiemodus geactiveerd (Stap-voor-stap PDU flow)');
        }
      } else {
        this.pause();
        if (btnRealtime) btnRealtime.classList.add('active');
        if (btnSimulation) btnSimulation.classList.remove('active');
        if (panel) panel.style.display = 'none';
        if (window.PXLApp && window.PXLApp.showToast) {
          window.PXLApp.showToast('⏱️ Realtime modus geactiveerd');
        }
      }
    }

    togglePanel() {
      this.isPanelOpen = !this.isPanelOpen;
      const body = document.getElementById('ptSimDockBody');
      if (body) {
        body.style.display = this.isPanelOpen ? 'flex' : 'none';
      }
    }

    setSpeed(speedVal) {
      this.speed = parseFloat(speedVal) || 1.0;
      if (this.isPlaying) {
        this.pause();
        this.play();
      }
    }

    toggleFilter(proto, enabled) {
      this.filters[proto] = Boolean(enabled);
      this.renderEventList();
    }

    /**
     * Records a packet from network_simulator into the simulation event list
     */
    addPacketEvent(packet) {
      const evtId = this.events.length + 1;
      const timeVal = (this.events.length * 0.005).toFixed(3);

      const evt = {
        id: evtId,
        time: timeVal,
        srcDev: packet.srcDevName || packet.srcDevId || 'Host',
        dstDev: packet.dstDevName || packet.dstDevId || 'Host',
        srcDevId: packet.srcDevId,
        dstDevId: packet.dstDevId,
        protocol: packet.protocol || 'PDU',
        info: packet.info || packet.summary || 'PDU Transmission',
        packet: packet,
        status: 'pending' // 'pending' | 'in_flight' | 'completed'
      };

      this.events.push(evt);
      this.renderEventList();

      // If in simulation mode, keep time badge updated
      const timeBadge = document.getElementById('simTimeBadge');
      if (timeBadge) timeBadge.textContent = `${this.simTime.toFixed(3)}s`;

      const countBadge = document.getElementById('simEventCountBadge');
      if (countBadge) countBadge.textContent = `${this.events.length} events`;
    }

    stepForward() {
      // Find next pending event
      let nextIdx = -1;
      for (let i = 0; i < this.events.length; i++) {
        if (this.events[i].status === 'pending') {
          nextIdx = i;
          break;
        }
      }

      if (nextIdx === -1) {
        if (this.isPlaying) {
          this.pause();
          if (window.PXLApp && window.PXLApp.showToast) {
            window.PXLApp.showToast('✅ Simulatie voltooid: alle pakketten zijn afgeleverd');
          }
        }
        return false;
      }

      const evt = this.events[nextIdx];
      evt.status = 'completed';
      this.currentEventIndex = nextIdx;
      this.simTime += 0.005;

      const timeBadge = document.getElementById('simTimeBadge');
      if (timeBadge) timeBadge.textContent = `${this.simTime.toFixed(3)}s`;

      // Trigger visual envelope animation on canvas between the endpoints
      const cw = window.PXLApp?.canvasWorkspace || this.workspace;
      if (cw && evt.srcDevId) {
        if (evt.dstDevId === 'broadcast') {
          for (const cable of this.sim.cables) {
            if (cable.fromDevice === evt.srcDevId) {
              cw.enqueueFlyingPacket(evt.srcDevId, cable.toDevice, evt.protocol, evt.protocol);
            } else if (cable.toDevice === evt.srcDevId) {
              cw.enqueueFlyingPacket(evt.srcDevId, cable.fromDevice, evt.protocol, evt.protocol);
            }
          }
        } else if (evt.dstDevId && evt.dstDevId !== evt.srcDevId && this.sim.devices[evt.dstDevId]) {
          cw.enqueueFlyingPacket(evt.srcDevId, evt.dstDevId, evt.protocol, evt.protocol);
        }
      }

      this.renderEventList();
      this.scrollToEvent(nextIdx);
      return true;
    }

    togglePlay() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    }

    play() {
      this.isPlaying = true;
      const btn = document.getElementById('simBtnPlay');
      if (btn) {
        btn.innerHTML = '⏸️ Pauze';
        btn.classList.add('playing');
      }

      const delay = Math.max(300, 1100 / this.speed);
      this.playInterval = setInterval(() => {
        const hasMore = this.stepForward();
        if (!hasMore) {
          this.pause();
        }
      }, delay);
    }

    pause() {
      this.isPlaying = false;
      if (this.playInterval) {
        clearInterval(this.playInterval);
        this.playInterval = null;
      }
      const btn = document.getElementById('simBtnPlay');
      if (btn) {
        btn.innerHTML = '▶ Play';
        btn.classList.remove('playing');
      }
    }

    resetSimulation() {
      this.pause();
      this.events = [];
      this.currentEventIndex = -1;
      this.simTime = 0.000;

      const cw = window.PXLApp?.canvasWorkspace || this.workspace;
      if (cw) {
        cw.flyingPackets = [];
        cw.render();
      }

      const timeBadge = document.getElementById('simTimeBadge');
      if (timeBadge) timeBadge.textContent = '0.000s';

      const countBadge = document.getElementById('simEventCountBadge');
      if (countBadge) countBadge.textContent = '0 events';

      this.renderEventList();
    }

    renderEventList() {
      const tbody = document.getElementById('simEventListTbody');
      if (!tbody) return;

      if (this.events.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: #64748b; padding: 24px 10px;">
              Geen actieve simulatie-events.<br>
              Voer een <code>ping</code> uit in de terminal of kies testverkeer in Wireshark.
            </td>
          </tr>
        `;
        return;
      }

      const visibleEvents = this.events.filter(e => this.filters[e.protocol] !== false);

      tbody.innerHTML = visibleEvents.map((evt, idx) => {
        const originalIndex = this.events.indexOf(evt);
        const isCurrent = originalIndex === this.currentEventIndex;
        const isCompleted = evt.status === 'completed';

        let protoBadgeClass = 'sim-badge-default';
        if (evt.protocol === 'ICMP') protoBadgeClass = 'sim-badge-icmp';
        else if (evt.protocol === 'ARP') protoBadgeClass = 'sim-badge-arp';
        else if (evt.protocol === 'TCP') protoBadgeClass = 'sim-badge-tcp';
        else if (evt.protocol === 'HTTP') protoBadgeClass = 'sim-badge-http';
        else if (evt.protocol === 'DNS') protoBadgeClass = 'sim-badge-dns';
        else if (evt.protocol === 'DHCP') protoBadgeClass = 'sim-badge-dhcp';

        return `
          <tr id="simEvtRow_${originalIndex}" class="pt-sim-row ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}" onclick="window.PXLApp.simulationEngine.selectEvent(${originalIndex})">
            <td style="text-align: center;">
              <button class="pt-sim-pdu-btn" onclick="event.stopPropagation(); window.PXLApp.simulationEngine.inspectPdu(${originalIndex})" title="Inspecteer OSI Lagen &amp; PDU Headers">
                ✉️
              </button>
            </td>
            <td style="font-family: Consolas, monospace; font-size: 11px; color: #94a3b8;">${evt.time}s</td>
            <td><strong>${evt.srcDev}</strong></td>
            <td><strong>${evt.dstDev}</strong></td>
            <td><span class="pt-sim-badge ${protoBadgeClass}">${evt.protocol}</span></td>
            <td class="pt-sim-info-cell" title="${evt.info}">${evt.info}</td>
          </tr>
        `;
      }).join('');
    }

    scrollToEvent(index) {
      const row = document.getElementById(`simEvtRow_${index}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    selectEvent(index) {
      this.currentEventIndex = index;
      this.renderEventList();
    }

    inspectPdu(index) {
      const evt = this.events[index];
      if (!evt || !evt.packet) return;

      if (window.WiresharkApp && typeof window.WiresharkApp.showPduInspectorModal === 'function') {
        window.WiresharkApp.showPduInspectorModal(evt.packet);
      }
    }
  }

  // Export globally
  window.SimulationEngine = SimulationEngine;

})(window);
