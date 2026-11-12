import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def test_mikrotik():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080")
        page.wait_for_selector("#toolSelect")

        eval_code = """
        () => {
            const sim = window.PXLNetworkSim;
            sim.clear();

            // 1. Create PC
            const pc = new CiscoDevice('pc_1', 'pc', 'PC-1', { ip: '192.168.88.10', mask: '255.255.255.0', gateway: '192.168.88.1' });
            pc.interfaces['FastEthernet0'].ip = '192.168.88.10';
            pc.interfaces['FastEthernet0'].mask = '255.255.255.0';
            pc.interfaces['FastEthernet0'].shutdown = false;
            sim.addDevice(pc);

            // 2. Create Switch
            const sw = new CiscoDevice('sw_1', 'switch', 'SW-1', { model: '2960-24TT' });
            sim.addDevice(sw);

            // 3. Create MikroTik
            const mt = new CiscoDevice('mt_1', 'mikrotik', 'MikroTik-1', { model: 'hEX lite (RB750r2)' });
            // By default ether1 has ip="", ether2 has ip="192.168.88.1"
            // Let's set ether1 to 192.168.88.1 but mask empty as happens in GUI if user only enters IP:
            mt.interfaces['ether1'].ip = '192.168.88.1';
            mt.interfaces['ether1'].mask = '';
            mt.interfaces['ether1'].shutdown = false;
            sim.addDevice(mt);

            // 4. Connect PC (FastEthernet0) to Switch (FastEthernet0/1)
            sim.connectCable('pc_1', 'FastEthernet0', 'sw_1', 'FastEthernet0/1', 'straight');

            // 5. Connect MikroTik (ether1) to Switch (FastEthernet0/2)
            sim.connectCable('mt_1', 'ether1', 'sw_1', 'FastEthernet0/2', 'straight');

            // 6. Test ping from PC to MikroTik
            const pingRes = sim.executePing('pc_1', '192.168.88.1');

            // 7. Test WebFig HTTP fetch from PC to MikroTik
            const httpRes = sim.fetchHttp('pc_1', '192.168.88.1');

            // 8. Test reverse ping from MikroTik to PC
            const revPing = sim.executePing('mt_1', '192.168.88.10');

            return {
                pingSuccess: pingRes.success,
                pingReason: pingRes.reason,
                pingHops: pingRes.hops,
                httpSuccess: httpRes.success,
                httpReason: httpRes.reason,
                hasWebFigHtml: typeof httpRes.html === 'string' && httpRes.html.includes('WebFig'),
                revPingSuccess: revPing.success,
                revPingReason: revPing.reason
            };
        }
        """
        res = page.evaluate(eval_code)
        print("RESULT:", res)
        browser.close()

if __name__ == '__main__':
    test_mikrotik()
