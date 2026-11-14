import os
import sys
import json
import subprocess

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database import init_db, save_exam, get_exam_by_id, list_labs_catalog


def test_database_locked_features_persistence():
    """Verifies that locked_features are properly stored, updated and retrieved in SQLite."""
    init_db()
    test_id = "test_locking_exam_001"
    title = "Test Labo met Feature Locking"
    locked = ["disable_config_tab", "gui_ip_config", "desktop_ip_config"]

    # 1. Save exam with locked features
    saved_id = save_exam(
        exam_id=test_id,
        title=title,
        instructions="Configureer de router uitsluitend via de CLI!",
        topology={"devices": [{"id": "R1", "type": "router"}]},
        rubric=[{"type": "interface_ip", "device": "R1", "port": "g0/0", "expected": "10.0.0.1", "points": 50}],
        category="custom",
        locked_features=locked
    )
    assert saved_id == test_id

    # 2. Retrieve exam
    exam = get_exam_by_id(test_id)
    assert exam is not None
    assert exam["title"] == title
    assert "lockedFeatures" in exam
    assert exam["lockedFeatures"] == locked

    # 3. Check list_labs_catalog
    catalog = list_labs_catalog()
    catalog_item = next((item for item in catalog if item["id"] == test_id), None)
    assert catalog_item is not None
    assert "lockedFeatures" in catalog_item
    assert catalog_item["lockedFeatures"] == locked


def test_js_mikrotik_dns_and_feature_locking():
    """Runs a Node.js test harness verifying MikroTik RouterOS CLI, DNS FLZ/RLZ and feature locking."""
    node_test_script = """
    const path = require('path');
    const assert = require('assert');

    // 1. Require modules
    const { CiscoDevice } = require(path.resolve('static/js/cisco_device.js'));
    const { MikroTikCLIParser } = require(path.resolve('static/js/mikrotik_cli.js'));
    const { OpenWrtCLIParser } = require(path.resolve('static/js/openwrt_cli.js'));

    // Test 1: MikroTik RouterOS hierarchical navigation & commands
    const mtDev = new CiscoDevice('mt1', 'mikrotik', 'MikroTik-Core', {
      name: 'MikroTik-Core',
      displayName: 'MikroTik-Core',
      interfaces: {
        'ether1': { name: 'ether1', ip: '', mask: '', shutdown: false },
        'ether2': { name: 'ether2', ip: '', mask: '', shutdown: false }
      }
    });

    let lastPrompt = '';
    let screenOutput = [];
    const mtParser = new MikroTikCLIParser(
      mtDev,
      (text) => screenOutput.push(text),
      () => { lastPrompt = mtParser.getPrompt(); },
      () => {}
    );

    // Initial prompt
    assert.strictEqual(mtParser.getPrompt(), '[admin@MikroTik-Core] > ');

    // Navigate to /ip address
    mtParser.handleCommand('ip address');
    assert.strictEqual(mtParser.getPrompt(), '[admin@MikroTik-Core] /ip address> ');

    // Add address in context
    mtParser.handleCommand('add address=192.168.1.1/24 interface=ether1');
    assert.strictEqual(mtDev.interfaces['ether1'].ip, '192.168.1.1');
    assert.strictEqual(mtDev.interfaces['ether1'].mask, '255.255.255.0');

    // Root navigation and route adding
    mtParser.handleCommand('/ip route add dst-address=10.0.0.0/8 gateway=192.168.1.254');
    assert(mtDev.staticRoutes.some(r => r.network === '10.0.0.0' && r.nextHop === '192.168.1.254'));

    // Check system telemetry
    screenOutput = [];
    mtParser.handleCommand('/system resource print');
    const resOutput = screenOutput.join('\\n');
    assert(resOutput.includes('7.14.1'));
    assert(resOutput.includes('cpu-load:'));

    // Check export
    screenOutput = [];
    mtParser.handleCommand('/export');
    const expOutput = screenOutput.join('\\n');
    assert(expOutput.includes('RouterOS 7.14.1'));
    assert(expOutput.includes('/ip address'));
    assert(expOutput.includes('192.168.1.1/24'));

    // Test 2: Feature Locking on CiscoDevice
    const lockedDev = new CiscoDevice('r1', 'router', 'R1', {
      lockedFeatures: ['disable_config_tab', 'gui_ip_config']
    });
    assert.strictEqual(lockedDev.isFeatureLocked('disable_config_tab'), true);
    assert.strictEqual(lockedDev.isFeatureLocked('gui_ip_config'), true);
    assert.strictEqual(lockedDev.isFeatureLocked('desktop_ip_config'), false);

    // Test 3: DNS Server Forward & Reverse Zones
    const srvDev = new CiscoDevice('srv1', 'server', 'DNS-Server', {
      name: 'DNS-Server',
      interfaces: {
        'FastEthernet0': { name: 'FastEthernet0', ip: '172.16.1.10', mask: '255.255.255.0', shutdown: false }
      }
    });

    const flz = srvDev.services.dns.forwardZones.find(z => z.name === 'pxl.local');
    const rlz = srvDev.services.dns.reverseZones.find(z => z.name === '1.16.172.in-addr.arpa');
    assert(flz, 'Forward zone pxl.local should exist');
    assert(rlz, 'Reverse zone 1.16.172.in-addr.arpa should exist');

    // Add A-record and PTR record
    flz.records.push({
      name: 'web',
      type: 'A',
      data: '172.16.1.50',
      ttl: 3600
    });
    rlz.records.push({
      name: '50',
      type: 'PTR',
      data: 'web.pxl.local',
      ttl: 3600
    });

    // Test 4: OpenWrt CLI diagnostics
    const owDev = new CiscoDevice('ow1', 'openwrt', 'OpenWrt', {});
    const owOutput = [];
    const owParser = new OpenWrtCLIParser(
      owDev,
      (text) => owOutput.push(text),
      () => {},
      () => {}
    );
    owParser.handleCommand('uname -a');
    assert(owOutput.some(line => line.includes('Linux OpenWrt')));
    owParser.handleCommand('uptime');
    assert(owOutput.some(line => line.includes('load average')));
    owParser.handleCommand('free');
    assert(owOutput.some(line => line.includes('Mem:')));

    console.log('ALL NODE JS TESTS PASSED SUCCESSFULLY!');
    """

    res = subprocess.run(['node', '-e', node_test_script], capture_output=True, text=True)
    if res.returncode != 0:
        print("STDOUT:", res.stdout)
        print("STDERR:", res.stderr)
    assert res.returncode == 0
    assert "ALL NODE JS TESTS PASSED SUCCESSFULLY!" in res.stdout


if __name__ == "__main__":
    print("Testing database locked features...")
    test_database_locked_features_persistence()
    print("Database locked features passed.")

    print("Testing MikroTik CLI, DNS zones, and Feature Locking via Node.js...")
    test_js_mikrotik_dns_and_feature_locking()
    print("ALL TESTS PASSED!")
