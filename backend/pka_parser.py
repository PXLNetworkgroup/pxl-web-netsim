"""
pka_parser.py - Robust Converter for Cisco Packet Tracer (.pka / .pkt) to PXL Web NetSim JSON
Decodes Twofish encrypted container, extracts devices, connections/cables, coordinates, and grading rubric.
Part of PXL Web NetSim (Hogeschool PXL)
© Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks
"""

import os
import re
import xml.etree.ElementTree as ET
from . import ptcrypto


def clean_pt_xml(raw_text: str) -> str:
    """
    Sanitizes Packet Tracer XML by stripping characters forbidden by XML 1.0 specifications,
    raw binary attribute values (e.g. Cisco's obfuscated VALUE attributes), and naked ampersands.
    """
    # Keep only legal XML 1.0 characters
    clean = re.sub(r'[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]', '', raw_text)
    # Remove binary data inside VALUE="..." attributes
    clean = re.sub(r'VALUE="[^"]*"', 'VALUE=""', clean)
    # Escape unescaped ampersands that appear inside HTML instructions
    clean = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)', '&amp;', clean)
    return clean


def convert_pka_to_netsim(file_bytes: bytes, filename: str = "activity.pka") -> dict:
    """
    Decodes a Packet Tracer .pka/.pkt file and converts it into a WebNetSim exam dict
    with authentic device names, accurate connections, scaled canvas coordinates, and
    the full dynamic assessment rubric.
    """
    decoded = ptcrypto.decode_packet_tracer(file_bytes)
    xml_text = decoded[0] if isinstance(decoded, tuple) else decoded
    clean_xml = clean_pt_xml(xml_text)

    try:
        root = ET.fromstring(clean_xml)
    except Exception as e:
        # Fallback regex or partial parse if XML parsing still encounters an edge case
        clean_xml_lenient = re.sub(r'<([a-zA-Z0-9_\-]+)[^>]*\x00[^>]*>', r'<\1>', clean_xml)
        root = ET.fromstring(clean_xml_lenient)

    exam_id = os.path.splitext(os.path.basename(filename))[0].lower().replace(" ", "_")
    base_title = os.path.splitext(os.path.basename(filename))[0].replace("_", " ")

    # 1. Activity Instructions & Title
    instructions = ""
    for page in root.findall('.//INSTRUCTIONS//PAGE'):
        if page.text:
            instructions += page.text.strip() + "\n"
    if not instructions.strip():
        instructions = "Voer de netwerkconfiguratie en bekabeling uit volgens de Packet Tracer examenopgave."

    # 2. Extract Topology (Initial Student Network)
    # Packet Tracer structure:
    # PACKETTRACER5[0] = Answer Network (golden solution)
    # PACKETTRACER5[1] = Initial Network (starting point given to students)
    # PACKETTRACER5[2+] = Student work / saved state if submitted
    pt_blocks = root.findall('.//PACKETTRACER5')
    active_block = pt_blocks[1] if len(pt_blocks) > 1 else (pt_blocks[0] if pt_blocks else root)

    raw_devices = active_block.findall('.//DEVICE')
    if not raw_devices and pt_blocks:
        raw_devices = pt_blocks[0].findall('.//DEVICE')
        active_block = pt_blocks[0]

    devices = []
    ref_to_device = {}

    for dev_el in raw_devices:
        name = dev_el.findtext('.//ENGINE/NAME') or dev_el.findtext('.//NAME') or ""
        name = name.strip()
        # Filter out non-network power strip / distribution devices
        if not name or "Power" in name or "Distribution" in name:
            continue

        ref = dev_el.findtext('.//SAVE_REF_ID') or dev_el.findtext('SAVE_REF_ID') or ""

        # Determine device type & model
        engine_type = (dev_el.findtext('.//ENGINE/TYPE') or "pc").lower()
        type_el = dev_el.find('.//ENGINE/TYPE')
        model = type_el.attrib.get('model', type_el.attrib.get('customModel', 'Standard')) if type_el is not None else 'Standard'

        dev_type = "pc"
        if "router" in engine_type or any(m in model.lower() for m in ["2911", "4331", "1941", "router", "isr"]):
            dev_type = "router"
            if model == "Standard":
                model = "4331"
        elif "switch" in engine_type or any(m in model.lower() for m in ["2960", "3560", "3650", "switch", "catalyst"]):
            dev_type = "switch"
            if model == "Standard":
                model = "2960-24TT"
        elif "laptop" in engine_type or "laptop" in model.lower():
            dev_type = "laptop"
        elif "server" in engine_type or "server" in model.lower():
            dev_type = "server"
        elif "accesspoint" in engine_type or "wireless" in engine_type:
            dev_type = "wireless_ap"
            model = "WRT300N"

        # Coordinates from Logical Workspace
        ws = dev_el.find('.//WORKSPACE/LOGICAL')
        raw_x = float(ws.findtext('X')) if ws is not None and ws.findtext('X') else 150.0
        raw_y = float(ws.findtext('Y')) if ws is not None and ws.findtext('Y') else 150.0

        dev_obj = {
            "id": name,
            "name": name,
            "hostname": name,
            "type": dev_type,
            "model": model,
            "raw_x": raw_x,
            "raw_y": raw_y,
            "interfaces": {}
        }

        # Extract Ports & Interfaces
        for port in dev_el.findall('.//PORT'):
            pname = port.findtext('NAME')
            if not pname:
                continue
            ip = port.findtext('IP') or port.findtext('.//IP') or ""
            mask = port.findtext('SUBNET_MASK') or port.findtext('.//SUBNET_MASK') or ""
            shut = port.findtext('STATUS') == '0'
            dev_obj["interfaces"][pname] = {
                "ip": ip if ip and ip != '0.0.0.0' else "",
                "mask": mask if mask and mask != '0.0.0.0' else "",
                "shutdown": shut,
                "description": port.findtext('DESCRIPTION') or ""
            }

        devices.append(dev_obj)
        if ref:
            ref_to_device[ref] = dev_obj

    # Scale & Center Canvas Coordinates to Fit Nicely on WebNetSim Viewport (140 to 950 x, 120 to 520 y)
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

    # 3. Extract Links / Cables
    cables = []
    cable_idx = 1
    for link in active_block.findall('.//LINK'):
        cable = link.find('.//CABLE')
        if cable is None:
            cable = link

        from_ref = cable.findtext('FROM') or ""
        to_ref = cable.findtext('TO') or ""
        ports = cable.findall('PORT')
        from_port = ports[0].text.strip() if len(ports) > 0 and ports[0].text else "FastEthernet0"
        to_port = ports[1].text.strip() if len(ports) > 1 and ports[1].text else "FastEthernet0"

        raw_cable_type = (cable.findtext('TYPE') or "").lower()
        cable_type = "straight"
        if "crossover" in raw_cable_type:
            cable_type = "crossover"
        elif "console" in raw_cable_type:
            cable_type = "console"
        elif "serial" in raw_cable_type:
            cable_type = "serial"
        elif "fiber" in raw_cable_type:
            cable_type = "fiber"

        from_dev = ref_to_device.get(from_ref, {}).get("name")
        to_dev = ref_to_device.get(to_ref, {}).get("name")

        if from_dev and to_dev:
            cables.append({
                "id": f"cable_{cable_idx}",
                "fromDevice": from_dev,
                "fromPort": from_port,
                "toDevice": to_dev,
                "toPort": to_port,
                "type": cable_type
            })
            cable_idx += 1

    # 4. Extract Assessment Rubric (<COMPARISONS>)
    rubric = []
    comps = root.find('.//COMPARISONS')
    if comps is not None:
        raw_items = []

        def walk_comps(node, path):
            name_el = node.find('NAME')
            pts_el = node.find('POINTS')
            c_name = name_el.text.strip() if name_el is not None and name_el.text else ""
            c_type = name_el.attrib.get('checkType', '0') if name_el is not None else '0'
            val = name_el.attrib.get('nodeValue', '').strip() if name_el is not None else ''
            p_str = pts_el.text.strip() if pts_el is not None and pts_el.text else '0'
            pts = int(p_str) if p_str.isdigit() else 0

            new_path = path + [c_name] if c_name else path
            # In Cisco Packet Tracer Answer Trees, checkType == "2" indicates an active graded item!
            if c_type == '2':
                raw_items.append({
                    "name": c_name,
                    "val": val,
                    "pts": pts if pts > 0 else 5,
                    "path": new_path
                })
            for ch in node.findall('NODE'):
                walk_comps(ch, new_path)

        for top_node in comps.findall('NODE'):
            walk_comps(top_node, [])

        seen_keys = set()
        for idx, item in enumerate(raw_items):
            path_list = item["path"]
            val = item["val"]
            pts = item["pts"]
            dev_name = path_list[1] if len(path_list) > 1 else "Device"
            leaf = path_list[-1] if path_list else "Config"
            p_join = " > ".join(path_list).lower()

            obj_id = f"pka_check_{idx+1}"
            category = "general"
            title = f"{dev_name}: {leaf}"
            desc = f"Configureer {leaf} op {dev_name}"
            check_type = "general"
            condition = {"deviceId": dev_name, "targetDevice": dev_name}

            # Map to Web NetSim check types
            if "hostname" in p_join:
                # Extract clean hostname if formatted as 'hostname PE1'
                host_val = re.sub(r'^hostname\s+', '', val, flags=re.IGNORECASE).strip() or dev_name
                category = "hostname"
                check_type = "hostname"
                title = f"{dev_name}: Hostname ({host_val})"
                desc = f"Stel hostname in op '{host_val}'"
                condition = {"targetDevice": dev_name, "expected": host_val}

            elif "enable secret" in p_join:
                category = "security"
                check_type = "enable_secret"
                title = f"{dev_name}: Enable Secret Wachtwoord"
                desc = "Beveilig privileged EXEC modus met een enable secret"
                condition = {"targetDevice": dev_name}

            elif "console line" in p_join or "console" in p_join or "081  password" in p_join:
                category = "security"
                check_type = "console_password"
                title = f"{dev_name}: Console Beveiliging & Login"
                desc = f"Stel het console wachtwoord in ({val}) en activeer 'login'"
                condition = {"targetDevice": dev_name, "expected": val}

            elif "banner motd" in p_join or "banner" in p_join:
                banner_val = re.sub(r'^banner\s+motd\s+["\']?|["\']?$', '', val, flags=re.IGNORECASE).strip()
                category = "banner"
                check_type = "banner_motd"
                title = f"{dev_name}: Banner MOTD"
                desc = f"Configureer de waarschuwingsbanner (MOTD): '{banner_val}'"
                condition = {"targetDevice": dev_name, "expected": banner_val}

            elif "service password-encryption" in p_join or "password encryption" in p_join:
                category = "security"
                check_type = "password_encryption"
                title = f"{dev_name}: Wachtwoord Versleuteling (service password-encryption)"
                desc = "Activeer 'service password-encryption' voor platte-tekst wachtwoorden"
                condition = {"targetDevice": dev_name}

            elif "vlan1" in p_join or "svi" in p_join:
                category = "management"
                check_type = "switch_svi"
                ip_match = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', val)
                expected_ip = ip_match.group(0) if ip_match else ""
                title = f"{dev_name}: Management SVI (Vlan1) Status & IP"
                desc = f"Stel interface Vlan1 in met IP {expected_ip} en zet deze 'no shutdown'"
                condition = {"switchId": dev_name, "expectedIp": expected_ip}

            elif "default gateway" in p_join or "default-gateway" in p_join:
                gw_match = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', val)
                gw_ip = gw_match.group(0) if gw_match else val
                category = "ip"
                check_type = "default_gateway"
                title = f"{dev_name}: Default Gateway ({gw_ip})"
                desc = f"Configureer de default gateway naar {gw_ip}"
                condition = {"deviceId": dev_name, "targetDevice": dev_name, "expected": gw_ip}

            elif "ip address" in p_join or "subnet mask" in p_join or "port up" in p_join or "ports" in p_join:
                category = "ip"
                check_type = "interface_ip"
                port_match = re.search(r'ports > ([^>]+) >', " > ".join(path_list), re.IGNORECASE)
                port_name = port_match.group(1).strip() if port_match else "FastEthernet0"

                if "ip address" in leaf.lower():
                    ip_match = re.search(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', val)
                    clean_ip = ip_match.group(0) if ip_match else val
                    title = f"{dev_name}: IP-adres {port_name} ({clean_ip})"
                    condition = {"deviceId": dev_name, "portName": port_name, "expectedIp": clean_ip}
                elif "subnet mask" in leaf.lower():
                    title = f"{dev_name}: Subnet Mask {port_name} ({val})"
                    condition = {"deviceId": dev_name, "portName": port_name, "expectedMask": val}
                else:
                    title = f"{dev_name}: Interface {port_name} Status (No Shutdown)"
                    condition = {"deviceId": dev_name, "portName": port_name, "checkNoShutdown": True}
                desc = f"Configureer {port_name} op {dev_name}"

            dedup_key = f"{dev_name}_{check_type}_{title}"
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            rubric.append({
                "id": obj_id,
                "category": category,
                "title": title,
                "desc": desc,
                "points": pts,
                "enabled": True,
                "checkType": check_type,
                "condition": condition
            })

    # Fallback rubric if COMPARISONS contained no explicit checkType 2 items
    if not rubric and devices:
        for idx, dev in enumerate(devices):
            if dev["type"] in ("router", "switch"):
                rubric.append({
                    "id": f"fb_host_{idx}",
                    "category": "hostname",
                    "title": f"{dev['name']}: Hostname",
                    "desc": f"Stel een unieke hostname in op {dev['name']}",
                    "points": 5,
                    "enabled": True,
                    "checkType": "hostname",
                    "condition": {"targetDevice": dev["name"], "expected": dev["name"]}
                })

    topo_bundle = {
        "devices": devices,
        "cables": cables
    }

    return {
        "id": exam_id,
        "title": f"Cisco Lab: {base_title}",
        "instructions": instructions,
        "timeLimit": 80,
        "timeLimitMinutes": 80,
        "initialTopology": topo_bundle,
        "topology": topo_bundle,
        "rubric": rubric
    }
