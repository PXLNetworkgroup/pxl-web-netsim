"""
enrich_course_labs.py - Automatically enriches all 18 PXL Network Essentials course labs
with complete Addressing Tables, Target Device Hostnames, Security Settings, and Step-by-Step Tasks.
Also syncs static/js/course_labs.js and updates SQLite exams table.
"""

import os
import sys
import re
import json
import sqlite3

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data', 'course_labs')
JS_FILE = os.path.join(BASE_DIR, 'static', 'js', 'course_labs.js')
DB_FILE = os.path.join(BASE_DIR, 'data', 'pxl_netsim.db')

def build_addressing_table(lab):
    topo = lab.get('initialTopology', {})
    devs = topo.get('devices', [])
    rubric = lab.get('rubric', [])
    rows = []
    seen = set()

    gw_map = {}
    for d in devs:
        gw = d.get('gateway') or d.get('defaultGateway')
        if gw:
            gw_map[d['id']] = gw
    for r in rubric:
        if r.get('checkType') == 'default_gateway':
            dev_id = r.get('condition', {}).get('deviceId') or r.get('condition', {}).get('targetDevice')
            if dev_id:
                gw_map[dev_id] = r.get('condition', {}).get('expected', '-')

    # 1. Inspect Devices
    for d in devs:
        d_id = d.get('id') or d.get('name')
        gw = gw_map.get(d_id, '-')
        if d.get('type') in ['pc', 'laptop', 'server']:
            ip = d.get('ip')
            mask = d.get('mask', '255.255.255.0')
            if not ip:
                for r in rubric:
                    if r.get('condition', {}).get('deviceId') == d_id and r.get('condition', {}).get('expectedIp'):
                        ip = r['condition']['expectedIp']
                        mask = r['condition'].get('expectedMask', '255.255.255.0')
            if ip:
                key = f"{d_id}_FastEthernet0"
                if key not in seen:
                    seen.add(key)
                    rows.append(f"| **{d_id}** | FastEthernet0 | {ip} | {mask} | {gw} |")

        intfs = d.get('interfaces', {})
        for pname, pcfg in intfs.items():
            ip = pcfg.get('ip')
            mask = pcfg.get('mask', '255.255.255.0')
            if ip and ip != '0.0.0.0':
                key = f"{d_id}_{pname}"
                if key not in seen:
                    seen.add(key)
                    rows.append(f"| **{d_id}** | {pname} | {ip} | {mask} | {gw} |")

    # 2. Inspect Rubric for missing SVIs or router ports
    for r in rubric:
        cond = r.get('condition', {})
        c_type = r.get('checkType')
        if c_type == 'switch_svi' and cond.get('expectedIp'):
            d_id = cond.get('switchId')
            ip = cond.get('expectedIp')
            mask = cond.get('expectedMask', '255.255.255.0')
            gw = gw_map.get(d_id, '-')
            key = f"{d_id}_Vlan1"
            if key not in seen:
                seen.add(key)
                rows.append(f"| **{d_id}** | Vlan1 (SVI) | {ip} | {mask} | {gw} |")
        elif c_type == 'interface_ip' and cond.get('expectedIp'):
            d_id = cond.get('deviceId')
            port = cond.get('portName', 'FastEthernet0')
            ip = cond.get('expectedIp')
            mask = cond.get('expectedMask', '255.255.255.0')
            gw = gw_map.get(d_id, '-')
            key = f"{d_id}_{port}"
            if key not in seen:
                seen.add(key)
                rows.append(f"| **{d_id}** | {port} | {ip} | {mask} | {gw} |")

    return "\n".join(rows) if rows else "| **Netwerkapparaten** | Geconfigureerd volgens opgave | Zie schema | 255.255.255.0 | - |"


def build_hostnames_md(lab):
    devs = lab.get('initialTopology', {}).get('devices', [])
    rubric = lab.get('rubric', [])
    hosts = []
    seen = set()

    for r in rubric:
        if r.get('checkType') == 'hostname':
            target = r.get('condition', {}).get('targetDevice')
            expected = r.get('condition', {}).get('expected')
            if target and expected and target not in seen:
                seen.add(target)
                hosts.append(f"* **{target}**: Doel Hostname instellen op `{expected}`")

    for d in devs:
        d_id = d.get('id')
        h = d.get('hostname')
        if h and h not in ['Switch', 'Router', 'PC'] and d_id not in seen:
            seen.add(d_id)
            hosts.append(f"* **{d_id}**: Hostname instellen op `{h}`")

    if not hosts:
        for d in devs:
            if d.get('type') in ['router', 'switch']:
                hosts.append(f"* **{d['id']}**: Hostname behouden of instellen op `{d['id']}`")

    return "\n".join(hosts) if hosts else "* Apparaten behouden hun standaard hostnaam."


def build_tasks_md(lab):
    rubric = lab.get('rubric', [])
    dev_tasks = {}

    for r in rubric:
        title = r.get('title', '')
        desc = r.get('desc') or title
        c_type = r.get('checkType', '')
        cond = r.get('condition', {})

        dev_id = cond.get('deviceId') or cond.get('switchId') or cond.get('routerId') or cond.get('targetDevice') or cond.get('fromDevice') or 'Algemeen'
        if dev_id not in dev_tasks:
            dev_tasks[dev_id] = []
        dev_tasks[dev_id].append(desc)

    task_sections = []
    idx = 1
    for dev_id, tasks in dev_tasks.items():
        bullets = "\n".join([f"   * {t}" for t in tasks])
        task_sections.append(f"{idx}. **Taken voor {dev_id}:**\n{bullets}")
        idx += 1

    return "\n\n".join(task_sections) if task_sections else "1. **Configuratietaken:**\n   * Voer alle netwerkconfiguraties uit volgens het bovenstaande adresseringsschema."


def enrich_lab(lab):
    code = lab.get('code', 'Lab')
    title = lab.get('title', 'Oefening')
    chapter = lab.get('chapter', 'PXL Network Essentials')
    existing_instr = lab.get('instructions', '').strip()

    # Extract source url if present
    url_m = re.search(r'\[([^\]]+)\]\((https?://[^\)]+)\)', existing_instr)
    source_url_md = f" • [{url_m.group(1)}]({url_m.group(2)})" if url_m else ""

    # Extract intro paragraph
    intro = ""
    lines = existing_instr.split('\n')
    intro_lines = []
    capture = False
    for l in lines:
        if 'Doel van' in l or 'Overzicht' in l or 'Opzet van' in l or 'In dit labo' in l:
            capture = True
        if capture:
            if l.startswith('### Opdrachten') or l.startswith('#### '):
                break
            intro_lines.append(l)
    intro = "\n".join(intro_lines).strip()
    if not intro:
        intro = f"### Overzicht van de Oefening:\nIn dit labo configureer je het netwerk volgens de officiële leerdoelen van {chapter}."

    addr_table = build_addressing_table(lab)
    hosts_md = build_hostnames_md(lab)
    tasks_md = build_tasks_md(lab)

    enriched_instr = f"""## {code}: {title}
**Cursus:** PXL Network Essentials (Gert Van Waeyenberg & David Parren){source_url_md}

{intro}

#### Adresseringstabel
| Apparaat | Interface | IP-adres | Subnetmasker | Standaardgateway |
| :--- | :--- | :--- | :--- | :--- |
{addr_table}

#### Doelhostnames van Netwerkapparaten:
{hosts_md}

#### Taken & Configuratie-eisen:
{tasks_md}

#### Verificatie & Connectiviteit:
* Controleer dat alle fysieke switch- en routerverbindingen groen zijn (`no shutdown`).
* Test de end-to-end connectiviteit tussen alle hosts en netwerkapparaten met `ping`.
* Sla je actieve configuratie op in het NVRAM (`copy run start` of `write memory`) waar van toepassing.
"""

    lab['instructions'] = enriched_instr
    return lab


def main():
    json_files = sorted([f for f in os.listdir(DATA_DIR) if f.endswith('.json')])
    all_labs = []

    print(f"Enriching {len(json_files)} course labs...")
    for fn in json_files:
        fpath = os.path.join(DATA_DIR, fn)
        with open(fpath, 'r', encoding='utf-8') as f:
            lab = json.load(f)

        enriched = enrich_lab(lab)
        all_labs.append(enriched)

        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(enriched, f, indent=2, ensure_ascii=False)
        print(f"✓ Enriched {fn}")

    # Sync static/js/course_labs.js
    js_content = f"""/**
 * course_labs.js - PXL Network Essentials Course Labs Repository
 * Sourced from https://vwgert.github.io/networksess/ (Gert Van Waeyenberg)
 * Hogeschool PXL (Toegepaste Informatica / SNE)
 * Fully enriched with complete Addressing Tables, Hostnames, and Verification Tasks.
 */

window.PXL_COURSE_LABS = {json.dumps(all_labs, indent=2, ensure_ascii=False)};
"""
    with open(JS_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print("✓ Synced static/js/course_labs.js")

    # Update SQLite database
    if os.path.exists(DB_FILE):
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        for lab in all_labs:
            lab_id = lab.get('id') or lab.get('code')
            code = lab.get('code', '')
            title = lab.get('title') or code
            display_title = f"{code}: {title}" if code and not title.startswith(code) else title
            c.execute("""
                UPDATE exams
                SET title = ?, instructions = ?, topology_json = ?, rubric_json = ?
                WHERE id = ?;
            """, (display_title, lab['instructions'], json.dumps(lab.get('initialTopology', {})), json.dumps(lab.get('rubric', [])), lab_id))
        conn.commit()
        conn.close()
        print("✓ Updated SQLite database exams table")

    print("\n🎉 ALL 18 COURSE LABS FULLY ENRICHED!")

if __name__ == '__main__':
    main()
