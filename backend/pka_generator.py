"""
pka_generator.py - Cisco Packet Tracer (.pka / .pkt) Config Analyzer & Interactive Rubric Generator
Extracts all running-configurations, interfaces, hostnames, passwords, banners, SVIs, static routes,
and allows teachers to check/uncheck which settings receive points.
Selected settings are converted into rubric points and stripped from the student initial topology.
Unselected settings remain pre-configured for the student.
Part of PXL Web NetSim (Hogeschool PXL)
"""

import os
import re
import json
import xml.etree.ElementTree as ET
from . import ptcrypto
from .pka_parser import clean_pt_xml


def analyze_pka_finished_configs(file_bytes: bytes, filename: str = "activity.pka") -> dict:
    """
    Decodes a Packet Tracer .pka / .pkt file, analyzes both Answer Block (Block 0)
    and Student Block (Block 1), extracts all running-configs, interface settings,
    passwords, banners, and returns a structured list of configurable items for the teacher.
    """
    decoded = ptcrypto.decode_packet_tracer(file_bytes)
    xml_text = decoded[0] if isinstance(decoded, tuple) else decoded
    clean_xml = clean_pt_xml(xml_text)

    try:
        root = ET.fromstring(clean_xml)
    except Exception:
        clean_xml_lenient = re.sub(r'<([a-zA-Z0-9_\-]+)[^>]*\x00[^>]*>', r'<\1>', clean_xml)
        root = ET.fromstring(clean_xml_lenient)

    exam_id = os.path.splitext(os.path.basename(filename))[0].lower().replace(" ", "_")
    base_title = os.path.splitext(os.path.basename(filename))[0].replace("_", " ")

    pt_blocks = root.findall('.//PACKETTRACER5')
    answer_block = pt_blocks[0] if pt_blocks else root
    student_block = pt_blocks[1] if len(pt_blocks) > 1 else answer_block

    # 1. Parse devices from answer block (the finished/golden configuration)
    raw_devices = answer_block.findall('.//DEVICE')
    if not raw_devices and pt_blocks:
        raw_devices = pt_blocks[0].findall('.//DEVICE')

    devices = []
    ref_to_dev = {}

    for dev_el in raw_devices:
        name = dev_el.findtext('.//ENGINE/NAME') or dev_el.findtext('.//NAME') or ""
        name = name.strip()
        if not name or "Power" in name or "Distribution" in name:
            continue

        ref = dev_el.findtext('.//SAVE_REF_ID') or dev_el.findtext('SAVE_REF_ID') or ""
        engine_type = (dev_el.findtext('.//ENGINE/TYPE') or "pc").lower()
        type_el = dev_el.find('.//ENGINE/TYPE')
        model = type_el.attrib.get('model', type_el.attrib.get('customModel', 'Standard')) if type_el is not None else 'Standard'

        dev_type = "pc"
        if "router" in engine_type or any(m in model.lower() for m in ["2911", "4331", "1941", "router", "isr"]):
            dev_type = "router"
            if model == "Standard": model = "4331"
        elif "switch" in engine_type or any(m in model.lower() for m in ["2960", "3560", "3650", "switch", "catalyst"]):
            dev_type = "switch"
            if model == "Standard": model = "2960-24TT"
        elif "laptop" in engine_type or "laptop" in model.lower():
            dev_type = "laptop"
        elif "server" in engine_type or "server" in model.lower():
            dev_type = "server"
        elif "accesspoint" in engine_type or "wireless" in engine_type:
            dev_type = "wireless_ap"
            model = "WRT300N"

        ws = dev_el.find('.//WORKSPACE/LOGICAL')
        raw_x = float(ws.findtext('X')) if ws is not None and ws.findtext('X') else 150.0
        raw_y = float(ws.findtext('Y')) if ws is not None and ws.findtext('Y') else 150.0

        # Extract running config lines if available
        rc_lines = []
        rc_el = dev_el.find('.//RUNNINGCONFIG')
        if rc_el is not None:
            rc_lines = [l.text.strip() for l in rc_el.findall('LINE') if l.text and l.text.strip()]

        dev_obj = {
            "id": name,
            "name": name,
            "hostname": name,
            "type": dev_type,
            "model": model,
            "raw_x": raw_x,
            "raw_y": raw_y,
            "interfaces": {},
            "runningConfigLines": rc_lines,
            "defaultGateway": "",
            "enableSecret": False,
            "consolePassword": False,
            "bannerMotd": ""
        }

        # Inspect ports
        for port in dev_el.findall('.//PORT'):
            pname = port.findtext('NAME')
            if not pname:
                # Fallback for PCs
                pname = "FastEthernet0"
            ip = port.findtext('IP') or port.findtext('.//IP') or ""
            mask = port.findtext('SUBNET_MASK') or port.findtext('.//SUBNET_MASK') or ""
            shut = port.findtext('STATUS') == '0'
            gw = port.findtext('GATEWAY') or dev_el.findtext('.//DEFAULT_GATEWAY') or ""
            if gw and not dev_obj["defaultGateway"]:
                dev_obj["defaultGateway"] = gw

            if ip and ip != '0.0.0.0':
                dev_obj["interfaces"][pname] = {
                    "ip": ip,
                    "mask": mask if mask and mask != '0.0.0.0' else "255.255.255.0",
                    "shutdown": shut,
                    "description": port.findtext('DESCRIPTION') or ""
                }

        # Inspect running-config lines for router/switch specifics
        for line in rc_lines:
            if line.startswith('hostname '):
                dev_obj["hostname"] = line.split('hostname ')[-1].strip()
            elif line.startswith('enable secret'):
                dev_obj["enableSecret"] = True
            elif line.startswith('ip default-gateway '):
                dev_obj["defaultGateway"] = line.split('ip default-gateway ')[-1].strip()
            elif line.startswith('banner motd '):
                raw_b = line.split('banner motd ')[-1].strip(' "#\'')
                dev_obj["bannerMotd"] = raw_b
            elif line.startswith('password ') or 'password 7 ' in line:
                dev_obj["consolePassword"] = True

        devices.append(dev_obj)
        if ref:
            ref_to_dev[ref] = dev_obj

    # Scale canvas coordinates
    if devices:
        valid_xs = [d["raw_x"] for d in devices if d["raw_x"] < 2500]
        valid_ys = [d["raw_y"] for d in devices if d["raw_y"] < 2500]
        if valid_xs and valid_ys:
            min_x, max_x = min(valid_xs), max(valid_xs)
            min_y, max_y = min(valid_ys), max(valid_ys)
            range_x = max(1.0, max_x - min_x)
            range_y = max(1.0, max_y - min_y)
            for d in devices:
                if d["raw_x"] < 2500:
                    d["x"] = int(140 + ((d["raw_x"] - min_x) / range_x) * 700)
                    d["y"] = int(120 + ((d["raw_y"] - min_y) / range_y) * 380)
                else:
                    d["x"] = 250
                    d["y"] = 250
                del d["raw_x"]
                del d["raw_y"]
        else:
            for idx, d in enumerate(devices):
                d["x"] = int(180 + (idx % 3) * 280)
                d["y"] = int(150 + (idx // 3) * 190)
                del d["raw_x"]
                del d["raw_y"]

    # 2. Extract cables
    cables = []
    cable_idx = 1
    for link in answer_block.findall('.//LINK'):
        cable = link.find('.//CABLE') or link
        from_ref = cable.findtext('FROM') or ""
        to_ref = cable.findtext('TO') or ""
        ports = cable.findall('PORT')
        from_port = ports[0].text.strip() if len(ports) > 0 and ports[0].text else "FastEthernet0"
        to_port = ports[1].text.strip() if len(ports) > 1 and ports[1].text else "FastEthernet0"

        from_dev = ref_to_dev.get(from_ref, {}).get("name")
        to_dev = ref_to_dev.get(to_ref, {}).get("name")

        if from_dev and to_dev:
            cables.append({
                "id": f"cable_{cable_idx}",
                "fromDevice": from_dev,
                "fromPort": from_port,
                "toDevice": to_dev,
                "toPort": to_port,
                "type": "copper_straight"
            })
            cable_idx += 1

    # 3. Parse <COMPARISONS> if present to enrich grading parameters
    comps_checks = {}
    comps = root.find('.//COMPARISONS')
    if comps is not None:
        def walk(node, path):
            name_el = node.find('NAME')
            pts_el = node.find('POINTS')
            c_name = name_el.text.strip() if name_el is not None and name_el.text else ""
            val = name_el.attrib.get('nodeValue', '').strip() if name_el is not None else ''
            p_str = pts_el.text.strip() if pts_el is not None and pts_el.text else '0'
            pts = int(p_str) if p_str.isdigit() else 0
            new_path = path + [c_name] if c_name else path
            if name_el is not None and name_el.attrib.get('checkType') == '2':
                key = " > ".join(new_path).lower()
                comps_checks[key] = {
                    "val": val,
                    "pts": pts,
                    "path": new_path
                }
            for ch in node.findall('NODE'):
                walk(ch, new_path)
        for top_node in comps.findall('NODE'):
            walk(top_node, [])

    # 4. Synthesize Configurable Settings (afvinkbare settings voor punten)
    configurable_items = []
    seen_item_keys = set()

    for d in devices:
        dev_id = d["id"]
        dev_type = d["type"]
        hostname = d["hostname"]

        # A. Hostname
        if hostname and hostname != "Switch" and hostname != "Router" and hostname != "PC":
            item_id = f"cfg_{dev_id}_hostname"
            if item_id not in seen_item_keys:
                seen_item_keys.add(item_id)
                configurable_items.append({
                    "id": item_id,
                    "deviceId": dev_id,
                    "deviceType": dev_type,
                    "category": "hostname",
                    "title": f"{dev_id}: Hostname '{hostname}'",
                    "desc": f"Configureer hostname naar '{hostname}'",
                    "currentValue": hostname,
                    "points": 5,
                    "checkType": "hostname",
                    "condition": { "targetDevice": dev_id, "expected": hostname },
                    "checked": True,
                    "stripAction": { "type": "strip_hostname", "target": dev_id, "default": "Switch" if dev_type == "switch" else ("Router" if dev_type == "router" else "PC") }
                })

        # B. Privileged EXEC / Enable Secret
        has_secret = d.get("enableSecret")
        for k in comps_checks:
            if dev_id.lower() in k and "secret" in k:
                has_secret = True
                break
        if has_secret:
            item_id = f"cfg_{dev_id}_enable_secret"
            if item_id not in seen_item_keys:
                seen_item_keys.add(item_id)
                configurable_items.append({
                    "id": item_id,
                    "deviceId": dev_id,
                    "deviceType": dev_type,
                    "category": "security",
                    "title": f"{dev_id}: Enable Secret Beveiliging",
                    "desc": f"Beveilig privileged EXEC mode met een enable secret",
                    "currentValue": "Ingeschakeld (gehasht)",
                    "points": 5,
                    "checkType": "enable_secret",
                    "condition": { "targetDevice": dev_id },
                    "checked": True,
                    "stripAction": { "type": "strip_secret", "target": dev_id }
                })

        # C. Console Wachtwoord
        has_con = d.get("consolePassword")
        con_val = "cisco"
        for k, v in comps_checks.items():
            if dev_id.lower() in k and ("con" in k or "console" in k):
                has_con = True
                if v.get("val") and v["val"] != "1":
                    con_val = v["val"]
        if has_con:
            item_id = f"cfg_{dev_id}_console_pwd"
            if item_id not in seen_item_keys:
                seen_item_keys.add(item_id)
                configurable_items.append({
                    "id": item_id,
                    "deviceId": dev_id,
                    "deviceType": dev_type,
                    "category": "security",
                    "title": f"{dev_id}: Console Beveiliging & Login",
                    "desc": f"Configureer console wachtwoord en activeer login op line con 0",
                    "currentValue": f"password {con_val}",
                    "points": 5,
                    "checkType": "console_password",
                    "condition": { "targetDevice": dev_id, "expected": con_val },
                    "checked": True,
                    "stripAction": { "type": "strip_console", "target": dev_id }
                })

        # D. Banner MOTD
        banner_text = d.get("bannerMotd")
        for k, v in comps_checks.items():
            if dev_id.lower() in k and "banner" in k:
                banner_text = v.get("val") or banner_text
        if banner_text:
            item_id = f"cfg_{dev_id}_banner_motd"
            if item_id not in seen_item_keys:
                seen_item_keys.add(item_id)
                configurable_items.append({
                    "id": item_id,
                    "deviceId": dev_id,
                    "deviceType": dev_type,
                    "category": "security",
                    "title": f"{dev_id}: Banner MOTD",
                    "desc": f"Configureer banner motd met tekst '{banner_text}'",
                    "currentValue": banner_text,
                    "points": 5,
                    "checkType": "banner_motd",
                    "condition": { "targetDevice": dev_id, "expected": banner_text },
                    "checked": True,
                    "stripAction": { "type": "strip_banner", "target": dev_id }
                })

        # E. Service Password-Encryption
        has_enc = any("password-encryption" in l for l in d.get("runningConfigLines", [])) or any("encryption" in k and dev_id.lower() in k for k in comps_checks)
        if has_enc:
            item_id = f"cfg_{dev_id}_pwd_enc"
            if item_id not in seen_item_keys:
                seen_item_keys.add(item_id)
                configurable_items.append({
                    "id": item_id,
                    "deviceId": dev_id,
                    "deviceType": dev_type,
                    "category": "security",
                    "title": f"{dev_id}: Service Password-Encryption",
                    "desc": "Activeer 'service password-encryption' voor platte-tekst wachtwoorden",
                    "currentValue": "Actief",
                    "points": 5,
                    "checkType": "password_encryption",
                    "condition": { "targetDevice": dev_id },
                    "checked": True,
                    "stripAction": { "type": "strip_pwd_enc", "target": dev_id }
                })

        # F. Switch SVI / Management IP (Vlan1)
        if dev_type == "switch":
            svi_ip = ""
            svi_mask = "255.255.255.0"
            for line in d.get("runningConfigLines", []):
                ip_m = re.search(r'ip address\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)', line)
                if ip_m:
                    svi_ip = ip_m.group(1)
                    svi_mask = ip_m.group(2)
                    break
            # Fallback from comps
            if not svi_ip:
                for k, v in comps_checks.items():
                    if dev_id.lower() in k and ("vlan" in k or "svi" in k):
                        ip_m = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', v.get("val", ""))
                        if ip_m:
                            svi_ip = ip_m.group(0)
                            break
            if svi_ip:
                item_id = f"cfg_{dev_id}_svi_ip"
                if item_id not in seen_item_keys:
                    seen_item_keys.add(item_id)
                    configurable_items.append({
                        "id": item_id,
                        "deviceId": dev_id,
                        "deviceType": dev_type,
                        "category": "switch_svi",
                        "title": f"{dev_id}: Management IP Vlan1 ({svi_ip})",
                        "desc": f"Configureer IP {svi_ip} {svi_mask} en 'no shutdown' op interface Vlan1",
                        "currentValue": f"{svi_ip} {svi_mask}",
                        "points": 10,
                        "checkType": "switch_svi",
                        "condition": { "switchId": dev_id, "expectedIp": svi_ip, "expectedMask": svi_mask, "checkNoShutdown": True },
                        "checked": True,
                        "stripAction": { "type": "strip_svi", "target": dev_id }
                    })

        # G. Default Gateway (voor switches of PCs)
        gw_ip = d.get("defaultGateway")
        if not gw_ip:
            for k, v in comps_checks.items():
                if dev_id.lower() in k and "gateway" in k:
                    ip_m = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', v.get("val", ""))
                    if ip_m:
                        gw_ip = ip_m.group(0)
                        break
        if gw_ip:
            item_id = f"cfg_{dev_id}_default_gw"
            if item_id not in seen_item_keys:
                seen_item_keys.add(item_id)
                configurable_items.append({
                    "id": item_id,
                    "deviceId": dev_id,
                    "deviceType": dev_type,
                    "category": "default_gateway",
                    "title": f"{dev_id}: Default Gateway ({gw_ip})",
                    "desc": f"Stel default gateway in op {gw_ip}",
                    "currentValue": gw_ip,
                    "points": 5,
                    "checkType": "default_gateway",
                    "condition": { "deviceId": dev_id, "targetDevice": dev_id, "expected": gw_ip },
                    "checked": True,
                    "stripAction": { "type": "strip_gateway", "target": dev_id }
                })

        # H. Router & Host Interface IPs
        for port_name, intf in d.get("interfaces", {}).items():
            ip = intf.get("ip")
            mask = intf.get("mask", "255.255.255.0")
            if ip and ip != "0.0.0.0":
                item_id = f"cfg_{dev_id}_{port_name}_ip"
                if item_id not in seen_item_keys:
                    seen_item_keys.add(item_id)
                    pts = 10 if dev_type in ["router", "switch"] else 8
                    configurable_items.append({
                        "id": item_id,
                        "deviceId": dev_id,
                        "deviceType": dev_type,
                        "category": "interface_ip",
                        "title": f"{dev_id}: IP {port_name} ({ip})",
                        "desc": f"Configureer IP {ip} met masker {mask} op {dev_id} {port_name}",
                        "currentValue": f"{ip} {mask}",
                        "points": pts,
                        "checkType": "interface_ip",
                        "condition": { "deviceId": dev_id, "portName": port_name, "expectedIp": ip, "expectedMask": mask },
                        "checked": True,
                        "stripAction": { "type": "strip_ip", "target": dev_id, "port": port_name }
                    })

    # I. Check PC entries from COMPARISONS if they were not in port elements
    for k, v in comps_checks.items():
        ip_m = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', v.get("val", ""))
        if ip_m and ("pc" in k or "laptop" in k) and "ip address" in k:
            parts = v.get("path", [])
            dev_candidate = parts[1] if len(parts) > 1 else "PC1"
            item_id = f"cfg_{dev_candidate}_FastEthernet0_ip"
            if item_id not in seen_item_keys:
                seen_item_keys.add(item_id)
                ip = ip_m.group(0)
                configurable_items.append({
                    "id": item_id,
                    "deviceId": dev_candidate,
                    "deviceType": "pc",
                    "category": "interface_ip",
                    "title": f"{dev_candidate}: IP FastEthernet0 ({ip})",
                    "desc": f"Configureer IP {ip} op {dev_candidate}",
                    "currentValue": f"{ip} 255.255.255.0",
                    "points": 8,
                    "checkType": "interface_ip",
                    "condition": { "deviceId": dev_candidate, "portName": "FastEthernet0", "expectedIp": ip, "expectedMask": "255.255.255.0" },
                    "checked": True,
                    "stripAction": { "type": "strip_ip", "target": dev_candidate, "port": "FastEthernet0" }
                })

    # J. End-to-End Ping Test (if at least 2 hosts exist)
    pcs = [d["id"] for d in devices if d["type"] in ["pc", "laptop", "server"]]
    if len(pcs) >= 2:
        src_pc = pcs[0]
        dst_pc = pcs[1]
        dst_ip = ""
        for it in configurable_items:
            if it["deviceId"] == dst_pc and it["checkType"] == "interface_ip":
                dst_ip = it["condition"].get("expectedIp")
                break
        if dst_ip:
            item_id = f"cfg_ping_{src_pc}_{dst_pc}"
            configurable_items.append({
                "id": item_id,
                "deviceId": src_pc,
                "deviceType": "connectivity",
                "category": "connectivity",
                "title": f"Connectiviteit: Ping {src_pc} ➔ {dst_pc} ({dst_ip})",
                "desc": f"Verifieer end-to-end connectiviteit via een succesvolle ping van {src_pc} naar {dst_ip}",
                "currentValue": f"ICMP Ping naar {dst_ip}",
                "points": 10,
                "checkType": "ping_test",
                "condition": { "fromDevice": src_pc, "targetIp": dst_ip },
                "checked": True,
                "stripAction": None
            })

    # Synthesize instructions
    suggested_instructions = generate_instructions_markdown(base_title, devices, configurable_items)

    return {
        "success": True,
        "filename": filename,
        "title": f"Cisco Lab: {base_title}",
        "devices": devices,
        "cables": cables,
        "configurableItems": configurable_items,
        "suggestedInstructions": suggested_instructions
    }


def generate_instructions_markdown(title: str, devices: list, items: list) -> str:
    """
    Synthesizes a rich, complete Markdown instruction document containing
    Addressing Table, Hostnames, Passwords, and Step-by-Step tasks.
    """
    # 1. Addressing Table
    addr_rows = []
    seen_addr = set()

    for item in items:
        dev_id = item.get("deviceId")
        c_type = item.get("checkType")
        cond = item.get("condition", {})

        if c_type == "interface_ip":
            port = cond.get("portName", "Fa0")
            ip = cond.get("expectedIp", "-")
            mask = cond.get("expectedMask", "255.255.255.0")
            gw = "-"
            for it in items:
                if it.get("deviceId") == dev_id and it.get("checkType") == "default_gateway":
                    gw = it.get("condition", {}).get("expected", "-")
            key = f"{dev_id}_{port}"
            if key not in seen_addr:
                seen_addr.add(key)
                addr_rows.append(f"| **{dev_id}** | {port} | {ip} | {mask} | {gw} |")

        elif c_type == "switch_svi":
            ip = cond.get("expectedIp", "-")
            mask = cond.get("expectedMask", "255.255.255.0")
            gw = "-"
            for it in items:
                if it.get("deviceId") == dev_id and it.get("checkType") == "default_gateway":
                    gw = it.get("condition", {}).get("expected", "-")
            key = f"{dev_id}_Vlan1"
            if key not in seen_addr:
                seen_addr.add(key)
                addr_rows.append(f"| **{dev_id}** | Vlan1 (SVI) | {ip} | {mask} | {gw} |")

    if not addr_rows:
        for d in devices:
            addr_rows.append(f"| **{d['id']}** | Geconfigureerd volgens opgave | Zie netwerkschema | 255.255.255.0 | - |")

    addr_table = "\n".join(addr_rows)

    # 2. Hostnames overview
    host_rows = []
    for it in items:
        if it.get("checkType") == "hostname":
            host_rows.append(f"* **{it['deviceId']}**: Hostname instellen op `{it['condition'].get('expected')}`")
    hosts_md = "\n".join(host_rows) if host_rows else "* Alle apparaten behouden hun standaard hostnaam."

    # 3. Tasks grouped by device
    dev_tasks = {}
    for it in items:
        if it.get("checkType") == "ping_test":
            continue
        dev_id = it.get("deviceId", "Algemeen")
        if dev_id not in dev_tasks:
            dev_tasks[dev_id] = []
        dev_tasks[dev_id].append(it.get("desc") or it.get("title"))

    task_sections = []
    idx = 1
    for dev_id, tasks in dev_tasks.items():
        bullets = "\n".join([f"   * {t}" for t in tasks])
        task_sections.append(f"{idx}. **Configuratie voor {dev_id}:**\n{bullets}")
        idx += 1

    tasks_md = "\n\n".join(task_sections)

    return f"""### Opdracht: {title}

#### Doelstelling van het Lab
In dit praktijkexamen configureer je de netwerkapparatuur, IP-adressering en basisbeveiliging volgens de richtlijnen van Hogeschool PXL en Cisco Networking Academy.

#### Adresseringstabel
| Apparaat | Interface | IP-adres | Subnetmasker | Standaardgateway |
| :--- | :--- | :--- | :--- | :--- |
{addr_table}

#### Doelhostnames van Netwerkapparaten:
{hosts_md}

#### Configuratietaken per Apparaat:
{tasks_md}

#### Connectiviteit & Verificatie:
* Controleer dat alle fysieke switch- en routerpoorten groen zijn (`no shutdown`).
* Test de end-to-end verbinding met een **ping**-opdracht tussen alle pc's en netwerkapparaten.
* Sla je configuratie op in het NVRAM op alle switches en routers (`copy run start` of `write memory`).
"""


def generate_exam_from_pka_selection(
    analyzed_data: dict,
    selected_item_ids: list,
    custom_points: dict = None,
    assignment_type: str = "lab",
    test_password: str = "",
    time_limit_minutes: int = 80,
    title: str = "",
    custom_instructions: str = ""
) -> dict:
    """
    Transforms the analyzed PKA data based on the teacher's selections:
    - Checked items become the rubric criteria.
    - Checked items are stripped from the student initial topology.
    - Unchecked items stay pre-configured in the student initial topology.
    - Full instructions with Addressing Table are produced.
    """
    custom_points = custom_points or {}
    selected_set = set(selected_item_ids)

    devices = [dict(d) for d in analyzed_data.get("devices", [])]
    cables = [dict(c) for c in analyzed_data.get("cables", [])]
    configurable_items = analyzed_data.get("configurableItems", [])

    rubric = []
    items_by_id = {it["id"]: it for it in configurable_items}

    # Deep copy interfaces for initial topology
    for d in devices:
        d["interfaces"] = {k: dict(v) for k, v in d.get("interfaces", {}).items()}

    # 1. Process each selected item -> Add to rubric & Strip from initial topology
    for it_id in selected_item_ids:
        item = items_by_id.get(it_id)
        if not item:
            continue

        pts = custom_points.get(it_id, item.get("points", 5))

        # Add to rubric
        rubric.append({
            "id": item["id"],
            "category": item["category"],
            "title": item["title"],
            "desc": item["desc"],
            "points": pts,
            "enabled": True,
            "checkType": item["checkType"],
            "condition": item["condition"]
        })

        # Strip from initial topology
        strip = item.get("stripAction")
        if not strip:
            continue

        s_type = strip.get("type")
        target_dev_id = strip.get("target")

        target_dev = next((d for d in devices if d["id"] == target_dev_id), None)
        if not target_dev:
            continue

        if s_type == "strip_hostname":
            # Reset hostname to default
            default_host = strip.get("default", "Switch" if target_dev["type"] == "switch" else "Router")
            target_dev["hostname"] = default_host

        elif s_type == "strip_ip":
            port = strip.get("port")
            if port and port in target_dev["interfaces"]:
                target_dev["interfaces"][port]["ip"] = ""
                target_dev["interfaces"][port]["mask"] = ""
                target_dev["interfaces"][port]["shutdown"] = True
            elif target_dev["type"] in ["pc", "laptop"]:
                target_dev["ip"] = ""
                target_dev["mask"] = ""

        elif s_type == "strip_gateway":
            target_dev["defaultGateway"] = ""
            target_dev["gateway"] = ""

        elif s_type == "strip_svi":
            # Switch SVI stripped
            target_dev["interfaces"]["Vlan1"] = { "ip": "", "mask": "", "shutdown": True }
            target_dev["defaultGateway"] = ""

        elif s_type in ["strip_secret", "strip_console", "strip_banner", "strip_pwd_enc"]:
            # Clean from initial running-config lines
            if "runningConfigLines" in target_dev:
                cleaned_lines = []
                for line in target_dev["runningConfigLines"]:
                    if s_type == "strip_secret" and line.startswith("enable secret"):
                        continue
                    if s_type == "strip_console" and ("password " in line or line == "login"):
                        continue
                    if s_type == "strip_banner" and line.startswith("banner motd"):
                        continue
                    if s_type == "strip_pwd_enc" and "password-encryption" in line:
                        continue
                    cleaned_lines.append(line)
                target_dev["runningConfigLines"] = cleaned_lines

    # Instructions
    final_title = title.strip() or analyzed_data.get("title", "Cisco Lab")
    instructions = custom_instructions.strip()
    if not instructions:
        selected_items_list = [items_by_id[iid] for iid in selected_item_ids if iid in items_by_id]
        instructions = generate_instructions_markdown(final_title, devices, selected_items_list)

    exam_id = re.sub(r'[^a-zA-Z0-9_]', '_', final_title.lower()).strip('_')
    if not exam_id:
        exam_id = f"pka_{int(time.time())}"

    initial_topology = {
        "devices": devices,
        "cables": cables
    }

    return {
        "id": exam_id,
        "title": final_title,
        "assignment_type": assignment_type,
        "test_password": test_password if assignment_type == "test" else "",
        "timeLimit": time_limit_minutes,
        "timeLimitMinutes": time_limit_minutes,
        "instructions": instructions,
        "initialTopology": initial_topology,
        "topology": initial_topology,
        "rubric": rubric,
        "is_started": 1 if assignment_type == "lab" else 0
    }
