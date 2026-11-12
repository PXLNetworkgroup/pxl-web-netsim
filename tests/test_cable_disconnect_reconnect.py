import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def test_cable_disconnect_and_reconnect():
    print("[1/6] Launching Edge browser for Cable Disconnect & Reconnect Test...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=EDGE_PATH,
            headless=True
        )
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        print("[2/6] Navigating to http://localhost:8080 ...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        page.wait_for_selector("#networkCanvas")
        time.sleep(1)

        # 1. Verify initial topology and cables
        initial_cables = page.evaluate("() => window.PXLNetworkSim.cables.length")
        print(f"   Initial cables present: {initial_cables}")
        assert initial_cables > 0, "Expected at least 1 cable in standard topology"

        # 2. Test Cable Action Popover on Canvas
        print("[3/6] Testing Canvas Cable Endpoint Popover...")
        popover_result = page.evaluate("""() => {
            const sim = window.PXLNetworkSim;
            const ws = window.PXLApp.canvasWorkspace;
            const cabling = ws.cabling;
            const cable = sim.cables[0];
            if (!cable) return { error: 'No cable found' };

            // Show action popover for endpoint 'to'
            cabling.showCableActionPopover(cable, 'to', 350, 250);
            const popEl = document.querySelector('.pt-cable-popover');
            if (!popEl) return { error: 'Popover element not in DOM' };

            const text = popEl.innerText;
            const hasMoveBtn = !!popEl.querySelector('.pt-btn-move');
            const hasDisconnectBtn = !!popEl.querySelector('.pt-btn-disconnect');
            const hasSelect = !!popEl.querySelector('.pt-cable-port-select');

            return {
                visible: popEl.style.display !== 'none',
                text: text,
                hasMoveBtn,
                hasDisconnectBtn,
                hasSelect,
                cableId: cable.id,
                fromDev: cable.fromDevice,
                fromPort: cable.fromPort,
                toDev: cable.toDevice,
                toPort: cable.toPort
            };
        }""")

        assert 'error' not in popover_result, f"Popover error: {popover_result.get('error')}"
        assert popover_result['hasDisconnectBtn'], "Expected Disconnect button in popover"
        assert popover_result['hasMoveBtn'], "Expected Move button in popover"
        print(f"   Action popover verified successfully: {popover_result['toDev']} [{popover_result['toPort']}]")

        # 3. Test Reconnecting / Switching Port on the same device
        print("[4/6] Testing Port Switching (Move Cable to Different Port)...")
        switch_result = page.evaluate("""() => {
            const sim = window.PXLNetworkSim;
            const ws = window.PXLApp.canvasWorkspace;
            const cable = sim.cables[0];
            const toDevId = cable.toDevice;
            const oldPort = cable.toPort;
            
            // Find a free port on toDev
            const freePorts = sim.getAvailablePorts(toDevId, null, cable.type);
            if (freePorts.length === 0) return { error: 'No free ports' };
            const targetPort = freePorts[0];

            // Perform reconnect
            const success = sim.reconnectCableEndpoint(cable.id, 'to', targetPort);
            ws.render();

            return {
                success,
                toDevId,
                oldPort,
                targetPort,
                newCableToPort: cable.toPort,
                cableOnOldPort: !!sim.getCableOnPort(toDevId, oldPort),
                cableOnNewPort: !!sim.getCableOnPort(toDevId, targetPort)
            };
        }""")

        assert switch_result.get('success'), "reconnectCableEndpoint failed"
        assert switch_result['newCableToPort'] == switch_result['targetPort'], "Cable port was not updated"
        assert not switch_result['cableOnOldPort'], "Old port still shows cabled"
        assert switch_result['cableOnNewPort'], "New port does not show cabled"
        print(f"   Successfully moved cable on {switch_result['toDevId']} from {switch_result['oldPort']} to {switch_result['targetPort']}!")

        # 4. Test Device Modal Config Tab Port Management
        print("[5/6] Testing Device Modal Config Tab Cabling Section...")
        modal_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = window.PXLNetworkSim;
            const cable = sim.cables[0];
            const dev = sim.devices[cable.toDevice];

            // Open device modal and switch to config
            app.openDeviceModal(dev);
            app.switchDeviceModalTab('config');
            app.selectConfigPort(cable.toPort);

            const editor = document.getElementById('configPortEditor');
            const hasCablingBox = !!editor.querySelector('.pt-cable-interface-box');
            const boxText = editor.querySelector('.pt-cable-interface-box')?.innerText || '';

            // Test moving cable via PXLApp helper
            const freePorts = sim.getAvailablePorts(dev.id, null, cable.type).filter(p => p !== cable.toPort);
            let moveSuccess = false;
            let movedToPort = null;
            if (freePorts.length > 0) {
                movedToPort = freePorts[0];
                app.moveCableToPort(dev.id, cable.toPort, movedToPort);
                moveSuccess = (cable.toPort === movedToPort);
            }

            return {
                hasCablingBox,
                boxText,
                moveSuccess,
                movedToPort
            };
        }""")

        assert modal_result['hasCablingBox'], "Config tab interface editor missing cabling management box"
        print("   Device modal cabling box verified:", modal_result['boxText'][:80].strip())
        if modal_result['movedToPort']:
            assert modal_result['moveSuccess'], f"Failed moving cable via PXLApp to {modal_result['movedToPort']}"
            print(f"   Successfully moved cable via PXLApp GUI to {modal_result['movedToPort']}!")

        # 5. Test Disconnecting and Detaching Cable
        print("[6/6] Testing Disconnecting & Detach/Rubberband Reconnecting...")
        disconnect_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = window.PXLNetworkSim;
            const ws = window.PXLApp.canvasWorkspace;
            const cabling = ws.cabling;

            const cableBefore = sim.cables[0];
            const cableId = cableBefore.id;
            const devId = cableBefore.toDevice;
            const portName = cableBefore.toPort;
            const fixedDevId = cableBefore.fromDevice;
            const fixedPortName = cableBefore.fromPort;

            // Test Detach and Reconnect mode
            cabling.detachAndReconnect(cableId, 'to');

            const hasPending = !!cabling.pendingConnection;
            const pendingFromDev = cabling.pendingConnection?.fromDevId;
            const pendingFromPort = cabling.pendingConnection?.fromPortName;
            const oldCableStillExists = sim.cables.some(c => c.id === cableId);

            // Now plug it into a new target device
            const newTargetDev = sim.devices[devId];
            const freePorts = sim.getAvailablePorts(devId);
            const chosenPort = freePorts[0];

            sim.addCable({
                id: 'cable_reconnected_test',
                fromDevice: pendingFromDev,
                fromPort: pendingFromPort,
                toDevice: devId,
                toPort: chosenPort,
                type: 'straight'
            });
            cabling.cancelPending();

            // Finally test complete disconnection
            app.disconnectCableFromPort(devId, chosenPort);
            const isCompletelyRemoved = !sim.getCableOnPort(devId, chosenPort);

            return {
                hasPending,
                pendingFromDev,
                fixedDevId,
                oldCableStillExists,
                isCompletelyRemoved
            };
        }""")

        assert disconnect_result['hasPending'], "detachAndReconnect should create pendingConnection"
        assert disconnect_result['pendingFromDev'] == disconnect_result['fixedDevId'], "Pending connection should anchor from fixed side"
        assert not disconnect_result['oldCableStillExists'], "Old cable should be deleted upon detach"
        assert disconnect_result['isCompletelyRemoved'], "disconnectCableFromPort should remove the cable"
        print("   Cable successfully detached, reconnected, and disconnected cleanly!")

        print("\nALL 6 CABLE DISCONNECT & RECONNECT TESTS PASSED 100%! 🎉")
        browser.close()

if __name__ == '__main__':
    test_cable_disconnect_and_reconnect()
