"""
pka_parser.py - Converter for Cisco Packet Tracer (.pka / .pkt) to PXL Web NetSim JSON
Decodes Twofish encrypted container, extracts topology, configs, and grading rubric.
Part of PXL Web NetSim (Hogeschool PXL)
"""

import os
import re
import xml.etree.ElementTree as ET
from . import ptcrypto


def convert_pka_to_netsim(file_bytes: bytes, filename: str = "activity.pka") -> dict:
    """
    Decodes a Packet Tracer .pka/.pkt file and converts it into a WebNetSim exam dict.
    """
    decoded = ptcrypto.decode_packet_tracer(file_bytes)
    xml_text = decoded[0] if isinstance(decoded, tuple) else decoded

    # Strip binary control characters that break XML parser
    cleaned_xml = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]", "", xml_text)

    try:
        root = ET.fromstring(cleaned_xml)
    except Exception:
        # Fallback regex parsing if XML is malformed
        root = None

    exam_id = os.path.splitext(os.path.basename(filename))[0].lower().replace(" ", "_")
    title = f"PXL Lab: {os.path.splitext(os.path.basename(filename))[0]}"
    instructions = "Voer de configuratie uit volgens de instructies in Packet Tracer."

    devices = []
    cables = []
    rubric = []

    if root is not None:
        # 1. Activity Instructions
        instr_el = root.find(".//INSTRUCTIONS")
        if instr_el is not None:
            cdata_match = re.search(r"<!\[CDATA\[(.*?)\]\]>", ET.tostring(instr_el, encoding="unicode"), re.DOTALL)
            if cdata_match:
                instructions = cdata_match.group(1).strip()
            else:
                instructions = instr_el.text or instructions

        # 2. Extract Networks (Start network [1] or current [0])
        pt_blocks = root.findall(".//PACKETTRACER5")
        active_block = pt_blocks[1] if len(pt_blocks) > 1 else (pt_blocks[0] if pt_blocks else root)

        dev_idx = 0
        for dev_el in active_block.findall(".//NETWORK/DEVICES/DEVICE"):
            name_el = dev_el.find("NAME")
            name = name_el.text.strip() if name_el is not None and name_el.text else f"Device{dev_idx}"
            type_el = dev_el.find(".//ENGINE/TYPE")
            raw_type = type_el.text.lower() if type_el is not None and type_el.text else "pc"

            dev_type = "pc"
            model = "Standard"
            if "router" in raw_type or "2911" in raw_type or "4331" in raw_type or "1941" in raw_type:
                dev_type = "router"
                model = "4331"
            elif "switch" in raw_type or "2960" in raw_type or "3560" in raw_type:
                dev_type = "switch"
                model = "2960-24TT"
            elif "laptop" in raw_type:
                dev_type = "laptop"
            elif "server" in raw_type:
                dev_type = "server"
            elif "accesspoint" in raw_type or "wireless" in raw_type:
                dev_type = "wireless_ap"
                model = "WRT300N"

            # Position
            x = 150 + (dev_idx % 4) * 220
            y = 150 + (dev_idx // 4) * 180
            pos_el = dev_el.find(".//CANVAS_POS")
            if pos_el is not None:
                try:
                    x = int(float(pos_el.attrib.get("x", x)))
                    y = int(float(pos_el.attrib.get("y", y)))
                except Exception:
                    pass

            # Extract basic interfaces
            interfaces = {}
            for port_el in dev_el.findall(".//PORTS/PORT"):
                pname = port_el.findtext("NAME") or ""
                if not pname:
                    continue
                ip = port_el.findtext("IP") or ""
                mask = port_el.findtext("SUBNET_MASK") or ""
                shut = port_el.findtext("STATUS") == "0"
                interfaces[pname] = {
                    "ip": ip,
                    "mask": mask,
                    "shutdown": shut,
                    "description": port_el.findtext("DESCRIPTION") or ""
                }

            devices.append({
                "id": name,
                "type": dev_type,
                "model": model,
                "hostname": name,
                "x": max(50, min(1100, x)),
                "y": max(50, min(650, y)),
                "interfaces": interfaces if interfaces else None
            })
            dev_idx += 1

        # 3. Extract Links / Cables
        link_idx = 0
        for link_el in active_block.findall(".//NETWORK/LINKS/LINK"):
            end1 = link_el.find("ENDPOINT1")
            end2 = link_el.find("ENDPOINT2")
            if end1 is not None and end2 is not None:
                cables.append({
                    "id": f"cable_{link_idx+1}",
                    "fromDevice": end1.attrib.get("device", ""),
                    "fromPort": end1.attrib.get("port", ""),
                    "toDevice": end2.attrib.get("device", ""),
                    "toPort": end2.attrib.get("port", ""),
                    "type": "straight"
                })
                link_idx += 1

        # 4. Extract Assessment Tree (<COMPARISONS>)
        comps = root.find(".//COMPARISONS")
        if comps is not None:
            r_idx = 1
            for node in comps.iter():
                name_attr = node.attrib.get("name", "")
                pts_attr = node.attrib.get("points", "")
                check_type = node.attrib.get("checkType", "0")

                if check_type == "2" and name_attr:
                    pts = int(pts_attr) if pts_attr.isdigit() else 5
                    rubric.append({
                        "id": f"pka_check_{r_idx}",
                        "category": "general",
                        "title": f"Cisco Evaluatie: {name_attr}",
                        "desc": f"Gecontroleerd criterium uit .pka ({name_attr})",
                        "points": pts,
                        "enabled": True,
                        "checkType": "general",
                        "condition": { "rule": name_attr }
                    })
                    r_idx += 1

    # Fallback default rubric if no explicit comparisons were found
    if not rubric:
        rubric.append({
            "id": "std_1",
            "category": "hostname",
            "title": "Hostnames instellen",
            "desc": "Geef apparaten een unieke naam",
            "points": 10,
            "enabled": True,
            "checkType": "hostname"
        })
        rubric.append({
            "id": "std_2",
            "category": "security",
            "title": "Enable Secret instellen",
            "desc": "Gehashed privilege exec wachtwoord",
            "points": 10,
            "enabled": True,
            "checkType": "enable_secret"
        })
        rubric.append({
            "id": "std_3",
            "category": "saving",
            "title": "Configuratie opslaan",
            "desc": "copy run start",
            "points": 10,
            "enabled": True,
            "checkType": "copy_run_start"
        })

    return {
        "id": exam_id,
        "title": title,
        "timeLimitMinutes": 80,
        "showLiveScore": True,
        "instructions": instructions,
        "initialTopology": {
            "devices": devices,
            "cables": cables
        },
        "rubric": rubric
    }

