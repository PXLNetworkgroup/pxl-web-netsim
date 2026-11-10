"""
ptgrader.py - Extracts student info, time spent, an automatic score and
plagiarism fingerprints from a decoded Packet Tracer activity (.pka / .pkt) XML.

Structure of a PT 8.x / 9.0.x activity (verified on PT 9.0.1.0858 files):

  <PACKETTRACER5_ACTIVITY>
     <VERSION>9.0.1.0858</VERSION>
     <PACKETTRACER5> ... </PACKETTRACER5>   [0] = network as saved by the student
     <PACKETTRACER5> ... </PACKETTRACER5>   [1] = initial network (start situation)
     <PACKETTRACER5> ... </PACKETTRACER5>   [2] = answer network (teacher solution)
     <COMPARISONS> NODE tree </COMPARISONS> assessment tree
                   NAME@checkType: 0 = not graded, 1 = partially (folder), 2 = graded
                   NAME@nodeValue: expected value, POINTS: weight
     <ACTIVITY ELAPSED="ms" .../>           time spent (milliseconds)
     <START_TIMESTAMP>yyyy-mm-dd hh:mm:ss</START_TIMESTAMP>

Packet Tracer does NOT store the completion percentage in the file; it is
recalculated live.  This module recalculates it: for every graded item the
student's value is resolved and compared with the expected value.  Each
resolver is first validated against the answer network: if the resolver does
not reproduce the expected value from the answer network, the item is marked
"not automatically checkable" instead of risking a wrong grade.
"""

from __future__ import annotations

import hashlib
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]")


def parse_xml(xml_text: str) -> ET.Element:
    """Parse PT XML; strips binary garbage (e.g. ACTIVITY@VALUE) that breaks XML parsers."""
    try:
        return ET.fromstring(xml_text)
    except ET.ParseError:
        return ET.fromstring(_CTRL.sub("", xml_text))


# --------------------------------------------------------------------------- #
#  Cisco helpers                                                              #
# --------------------------------------------------------------------------- #
_XLAT = "dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87"


def decrypt_type7(enc: str) -> str:
    try:
        seed = int(enc[:2])
        out = []
        for i in range(2, len(enc), 2):
            out.append(chr(int(enc[i : i + 2], 16) ^ ord(_XLAT[(seed + (i - 2) // 2) % len(_XLAT)])))
        return "".join(out)
    except (ValueError, IndexError):
        return enc


def mask_to_prefix(mask: str) -> int:
    try:
        return sum(bin(int(x)).count("1") for x in mask.split("."))
    except ValueError:
        return 0


class IOSConfig:
    """IOS running/startup configuration model."""

    def __init__(self, lines: list[str]):
        self.lines = [l.rstrip() for l in lines if l is not None]
        self.top: list[str] = []
        self.blocks: dict[str, list[str]] = {}
        cur = None
        for l in self.lines:
            if not l or l.strip() == "!":
                cur = None
                continue
            if l[0] in " \t":
                if cur is not None:
                    self.blocks.setdefault(cur, []).append(l.strip())
                continue
            self.top.append(l.strip())
            cur = l.strip()
            self.blocks.setdefault(cur, [])

    def top_value(self, prefix: str):
        for l in self.top:
            if l.startswith(prefix):
                return l[len(prefix) :].strip()
        return None

    def block(self, header: str) -> list[str] | None:
        h = _norm(header)
        for k, v in self.blocks.items():
            if _norm(k) == h:
                return v
        return None

    def has_line(self, context: str, line: str) -> bool:
        line_n = _norm(line)
        if not context:
            return any(_norm(l) == line_n for l in self.top)
        b = self.block(context)
        return b is not None and any(_norm(l) == line_n for l in b)

    def interface(self, name: str) -> list[str] | None:
        return self.block("interface " + name)

    def line_block(self, kind: str) -> list[str] | None:
        for k, v in self.blocks.items():
            if _norm(k).startswith(_norm("line " + kind)):
                return v
        return None

    def static_routes_v4(self) -> set[str]:
        routes: set[str] = set()
        for l in self.top:
            if not l.startswith("ip route "):
                continue
            parts = l.split()
            if len(parts) < 5:
                continue
            net, mask, nh = parts[2], parts[3], parts[4]
            ad = parts[5] if len(parts) >= 6 and parts[5].isdigit() else "1"
            pfx = mask_to_prefix(mask)
            routes.add(_norm(f"{net}-{pfx}-{nh}-0-{ad}"))
        return routes


def _norm(s: str) -> str:
    return " ".join((s or "").split()).lower()


def _banner_text(raw: str | None) -> str:
    if raw is None:
        return ""
    raw = raw.strip()
    if raw.startswith("^C"):
        d = "^C"
    else:
        d = raw[:1]
    body = raw[len(d) :]
    end = body.find(d)
    return (body[:end] if end >= 0 else body).strip()


# --------------------------------------------------------------------------- #
#  Device wrappers                                                            #
# --------------------------------------------------------------------------- #
class Device:
    def __init__(self, el: ET.Element):
        self.el = el
        self.eng = el.find("ENGINE")
        self.name = (self.eng.findtext("NAME") or "").strip() if self.eng is not None else ""
        rc = self.eng.find("RUNNINGCONFIG") if self.eng is not None else None
        sc = self.eng.find("STARTUPCONFIG") if self.eng is not None else None
        self.is_ios = rc is not None and len(rc) > 0
        self.running = IOSConfig([x.text or "" for x in rc]) if rc is not None else IOSConfig([])
        self.startup = IOSConfig([x.text or "" for x in sc]) if sc is not None else IOSConfig([])
        self._ports = None

    def coords(self) -> tuple[float, float] | None:
        ws = self.el.find("WORKSPACE/LOGICAL")
        if ws is None:
            ws = self.el.find("WORKSPACE")
        if ws is not None:
            x = ws.findtext("X") or ws.findtext("POS_X") or ws.attrib.get("x") or ws.attrib.get("pos_x")
            y = ws.findtext("Y") or ws.findtext("POS_Y") or ws.attrib.get("y") or ws.attrib.get("pos_y")
            if x is not None and y is not None:
                try:
                    return (round(float(x), 1), round(float(y), 1))
                except ValueError:
                    pass
        return None

    _PT_NAMES = {
        "eCopperFastEthernet": "FastEthernet",
        "eCopperGigabitEthernet": "GigabitEthernet",
        "eFiberFastEthernet": "FastEthernet",
        "eFiberGigabitEthernet": "GigabitEthernet",
        "eHostWireless": "Wireless",
        "eBluetooth": "Bluetooth",
        "eSerial": "Serial",
        "eCopperEthernet": "Ethernet",
        "eCopperTenGigabitEthernet": "TenGigabitEthernet",
    }

    def ports(self) -> dict[str, ET.Element]:
        if self._ports is None:
            self._ports = {}
            counters: dict[str, int] = {}
            if self.eng is not None:
                for p in self.eng.iter("PORT"):
                    t = p.findtext("TYPE") or ""
                    base = self._PT_NAMES.get(t)
                    if not base:
                        continue
                    n = counters.get(base, 0)
                    counters[base] = n + 1
                    self._ports.setdefault(f"{base}{n}", p)
        return self._ports


def devices_of(net: ET.Element | None) -> list[Device]:
    if net is None:
        return []
    devs = net.find("NETWORK/DEVICES")
    return [Device(d) for d in devs.findall("DEVICE")] if devs is not None else []


# --------------------------------------------------------------------------- #
#  Value resolvers                                                            #
# --------------------------------------------------------------------------- #
_HOST_PORT_HINTS = {
    "ip address": "IP",
    "subnet mask": "SUBNET",
    "mac address": "MACADDRESS",
    "description": "DESCRIPTION",
    "dhcp": "PORT_DHCP_ENABLE",
    "link local": "IPV6_LINK_LOCAL",
}


def _ios_port_field(cfg: IOSConfig, port: str, rel_tail: list[str]):
    blk = cfg.interface(port)
    if blk is None:
        blk = []
    f = rel_tail[-1].lower()
    sub = " > ".join(x.lower() for x in rel_tail)
    ip = next((l.split() for l in blk if l.startswith("ip address ") and "secondary" not in l), None)
    if "ipv6 addresses" in sub:
        v6 = next(
            (l.split()[2] for l in blk if l.startswith("ipv6 address ") and not l.endswith("link-local") and "/" in l),
            "",
        )
        if f == "ip address":
            return v6.split("/")[0] if "/" in v6 else v6
        if f == "prefix":
            return v6.split("/")[1] if "/" in v6 else ""
    if "port security" in sub:
        if f == "enabled":
            return "1" if "switchport port-security" in blk else "0"
        if f == "sticky enabled":
            return "1" if any(l.startswith("switchport port-security mac-address sticky") for l in blk) else "0"
        if f == "max secure mac":
            m = next((l.split()[-1] for l in blk if l.startswith("switchport port-security maximum ")), None)
            return m if m else ("1" if "switchport port-security" in blk else "0")
    if f == "ip address":
        return ip[2] if ip and len(ip) >= 4 else ""
    if f == "subnet mask":
        return ip[3] if ip and len(ip) >= 4 else ""
    if f in ("port up", "power"):
        return "0" if "shutdown" in blk else "1"
    if f == "description":
        d = next((l for l in blk if l.startswith("description ")), None)
        return d[len("description ") :] if d else ""
    if f == "access vlan":
        v = next((l for l in blk if l.startswith("switchport access vlan ")), None)
        return v.split()[-1] if v else "1"
    if f == "native vlan":
        v = next((l for l in blk if l.startswith("switchport trunk native vlan ")), None)
        return v.split()[-1] if v else "1"
    if f == "portfast":
        return "1" if any(l.startswith("spanning-tree portfast") for l in blk) else "0"
    if f == "link local":
        v = next((l.split()[2] for l in blk if l.startswith("ipv6 address ") and "link-local" in l), "")
        return v
    if f == "ipv6 address":
        v = next((l for l in blk if l.startswith("ipv6 address ") and "link-local" not in l), None)
        return v.split()[2] if v else ""
    return None


def _ios_line_field(cfg: IOSConfig, kind: str, fieldname: str):
    blk = cfg.line_block(kind)
    if blk is None:
        blk = []
    f = fieldname.lower()
    if f == "password":
        pw = next((l for l in blk if l.startswith("password ")), None)
        if not pw:
            return ""
        parts = pw.split()
        if len(parts) >= 3 and parts[1] == "7":
            return decrypt_type7(parts[2])
        return pw[len("password ") :]
    if f == "login":
        if "login local" in blk:
            return "2"
        return "1" if "login" in blk else "0"
    if f == "transport input":
        ti = next((l.split()[2:] for l in blk if l.startswith("transport input ")), None)
        if not ti:
            return "0"
        s = set(x.lower() for x in ti)
        if s == {"ssh"}:
            return "2"
        if s == {"telnet"}:
            return "1"
        if "all" in s or ("ssh" in s and "telnet" in s):
            return "3"
        if "none" in s:
            return "4"
    if f == "exec-timeout":
        et = next((l.split() for l in blk if l.startswith("exec-timeout ")), None)
        if et and len(et) >= 3 and et[1].isdigit() and et[2].isdigit():
            return str((int(et[1]) * 60 + int(et[2])) * 1000)
        return "600000"
    return None


def resolve_ios(dev: Device, rel: list[str], expected: str):
    cfg = dev.running
    if not rel:
        return None
    head = rel[0]
    hl = head.lower()
    if hl == "ios configuration" and len(rel) >= 3:
        c = dev.startup if "startup" in rel[1].lower() else dev.running
        ident = rel[-1]
        val = expected or ""
        if ident.endswith(val) and val:
            context = ident[: len(ident) - len(val)].strip()
        else:
            context = ""
        if c.has_line(context, val):
            return val
        if val.startswith("banner motd "):
            exp_txt = _banner_text(val[len("banner motd ") :])
            cur_raw = c.top_value("banner motd ")
            if cur_raw is not None and _eq(_banner_text(cur_raw), exp_txt):
                return val
        return "<ontbreekt>"
    if hl == "ports" and len(rel) >= 3:
        return _ios_port_field(cfg, rel[1], rel[2:])
    if hl in ("host name", "hostname", "display name"):
        return cfg.top_value("hostname ") or ""
    if hl == "enable secret":
        v = cfg.top_value("enable secret ")
        if not v:
            return ""
        p = v.split()
        return p[-1]
    if hl == "enable password":
        v = cfg.top_value("enable password ")
        if not v:
            return ""
        p = v.split()
        return decrypt_type7(p[1]) if len(p) >= 2 and p[0] == "7" else p[-1]
    if hl in ("banner motd", "banner"):
        return _banner_text(cfg.top_value("banner motd "))
    if hl == "service password encryption":
        return "1" if "service password-encryption" in cfg.top else "0"
    if hl == "default gateway":
        return cfg.top_value("ip default-gateway ") or ""
    if hl in ("domain name", "ip domain name"):
        return cfg.top_value("ip domain-name ") or cfg.top_value("ip domain name ") or ""
    if hl == "console line" and len(rel) >= 2:
        return _ios_line_field(cfg, "con 0", rel[-1])
    if (hl.startswith("vty") or hl.startswith("line vty")) and len(rel) >= 2:
        return _ios_line_field(cfg, "vty", rel[-1])
    if hl == "user names" and len(rel) >= 2:
        uname = rel[1]
        for l in cfg.top:
            if l.startswith(f"username {uname} "):
                parts = l.split()
                if "secret" in parts:
                    return f"{uname} {parts[-1]}"
                if "password" in parts:
                    idx = parts.index("password")
                    pw = (
                        decrypt_type7(parts[idx + 2])
                        if idx + 2 < len(parts) and parts[idx + 1] == "7"
                        else parts[-1]
                    )
                    return f"{uname} {pw}"
        return ""
    if hl == "security" and len(rel) >= 2 and dev.eng is not None:
        sec = dev.eng.find("SECURITY")
        if sec is not None:
            f = rel[-1].lower()
            if f == "crypto key":
                return (sec.findtext("ENABLED") or "0").strip()
            if f == "modulus bits":
                return (sec.findtext("MODULUS_BITS") or "0").strip()
    if hl == "ssh server" and len(rel) >= 2:
        if rel[-1].lower() == "ssh server version":
            return cfg.top_value("ip ssh version ") or ""
    if hl == "routesv6" and len(rel) >= 2:
        if rel[-1].lower() == "ipv6 unicast routing":
            return "1" if "ipv6 unicast-routing" in cfg.top else "0"
    if hl == "routes" and len(rel) >= 3 and "static" in rel[1].lower():
        return expected if _norm(expected) in cfg.static_routes_v4() else ""
    return None


def resolve_host(dev: Device, rel: list[str], expected: str):
    if dev.eng is None or not rel:
        return None
    hl = rel[0].lower()
    if hl == "ports" and len(rel) >= 3:
        port = dev.ports().get(rel[1])
        if port is None:
            return None
        sub = " > ".join(x.lower() for x in rel[2:])
        f = rel[-1].lower()
        if "ipv6 addresses" in sub:
            if f == "ip address":
                return (port.findtext("IPV6_ADDRESSES/IPV6_ADDRESS/ADDRESS") or "").strip()
            if f == "prefix":
                return (port.findtext("IPV6_ADDRESSES/IPV6_ADDRESS/PREFIX") or "").strip()
        tag = _HOST_PORT_HINTS.get(f)
        if tag is None:
            return None
        v = port.findtext(tag)
        return (v or "").strip()
    if hl == "default gateway":
        return (dev.eng.findtext("GATEWAY") or "").strip()
    if hl == "default gateway ipv6":
        return (dev.eng.findtext("GATEWAYV6") or "").strip()
    if hl in ("dns server", "dns server ip"):
        return (dev.eng.findtext("DNS_CLIENT/SERVER_IP") or "").strip()
    return None


def _paths_with_value(el: ET.Element, value: str, base=""):
    out = []
    counts: dict[str, int] = {}
    for c in el:
        i = counts.get(c.tag, 0)
        counts[c.tag] = i + 1
        p = f"{base}/{c.tag}[{i}]"
        if (c.text or "").strip() == value:
            out.append(p)
        out.extend(_paths_with_value(c, value, p))
    return out


def _value_at(el: ET.Element, path: str):
    cur = el
    for part in path.strip("/").split("/"):
        m = re.match(r"(.+)\[(\d+)\]$", part)
        tag, idx = m.group(1), int(m.group(2))
        kids = [c for c in cur if c.tag == tag]
        if idx >= len(kids):
            return ""
        cur = kids[idx]
    return (cur.text or "").strip()


def resolve(dev: Device, ans: Device, rel: list[str], expected: str):
    """Return (user_value, ok_resolver).  ok_resolver False = not checkable."""
    for fn in ((resolve_ios,) if ans.is_ios else (resolve_host,)):
        a = fn(ans, rel, expected)
        if a is not None and _eq(a, expected):
            u = fn(dev, rel, expected)
            return (u if u is not None else ""), True
    if expected and len(expected) >= 3:
        paths = _paths_with_value(ans.el, expected)
        if len(paths) == 1:
            return _value_at(dev.el, paths[0]), True
    return None, False


def _eq(a: str, b: str) -> bool:
    return _norm(a) == _norm(b)


# --------------------------------------------------------------------------- #
#  Blackboard / Toledo sidecar metadata (.txt)                                #
# --------------------------------------------------------------------------- #
def parse_sidecar_metadata(filepath: str) -> tuple[str, str]:
    """Extract (student_name, student_id_or_class) from Blackboard/Toledo .txt sidecar or filename."""
    folder = os.path.dirname(filepath)
    bname = os.path.basename(filepath)
    if "_poging_" in bname:
        prefix = bname.split("_poging_")[0]
        parts = bname.split("_poging_", 1)[1]
        ts_part = parts[:19]  # YYYY-MM-DD-HH-MM-SS
        candidate_txt = os.path.join(folder, f"{prefix}_poging_{ts_part}.txt")
        if os.path.exists(candidate_txt):
            try:
                txt = open(candidate_txt, encoding="utf-8", errors="replace").read()
                m = re.search(r"^Naam:\s*(.+)$", txt, re.M)
                if m:
                    raw_name = m.group(1).strip()
                    # e.g. "Joris Falagiarda (2026-27 - GRSNE - 1SNEa) (12600545)"
                    m2 = re.match(r"^([^(]+)\(([^)]+)\)\s*(?:\(([^)]+)\))?", raw_name)
                    if m2:
                        name = m2.group(1).strip()
                        klas = m2.group(2).split("-")[-1].strip()
                        sid = (m2.group(3) or "").strip()
                        extra = f"{sid} ({klas})" if sid else klas
                        return name, extra
                    return raw_name, ""
            except OSError:
                pass
    return "", ""


# --------------------------------------------------------------------------- #
#  Result                                                                     #
# --------------------------------------------------------------------------- #
@dataclass
class GradeResult:
    pt_version: str = ""
    is_activity: bool = False
    user_name: str = ""
    user_email: str = ""
    elapsed_ms: int | None = None
    start_timestamp: str = ""
    points_earned: int = 0
    points_total: int = 0
    items_total: int = 0
    items_checkable: int = 0
    stored_score: float | None = None
    failed_items: list[str] = field(default_factory=list)
    unchecked_items: list[str] = field(default_factory=list)
    coords_sequence: tuple[tuple[float, float], ...] = ()
    layout_fp: str = ""
    layout_changed: bool = False
    session_fp: str = ""
    config_fp: str = ""
    network_fp: str = ""

    @property
    def score(self) -> float | None:
        if self.stored_score is not None:
            return self.stored_score
        if self.points_total == 0:
            return None
        return 100.0 * self.points_earned / self.points_total


def _leaves(node: ET.Element, path: list[str], out: list):
    nm = node.find("NAME")
    ident = node.findtext("ID") or (nm.text if nm is not None else "")
    kids = node.findall("NODE")
    p = path + [ident]
    if not kids and nm is not None and nm.attrib.get("checkType") == "2":
        try:
            pts = int(float(node.findtext("POINTS") or "1"))
        except ValueError:
            pts = 1
        out.append((p, nm.attrib.get("nodeValue", ""), pts))
    for k in kids:
        _leaves(k, p, out)


_PROFILE_PLACEHOLDERS = {"", "guest", "gast"}


def analyse(root: ET.Element, filepath: str = "") -> GradeResult:
    r = GradeResult()
    r.pt_version = (root.findtext("VERSION") or "").strip()
    nets = root.findall("PACKETTRACER5") if root.tag == "PACKETTRACER5_ACTIVITY" else [root]
    user_net = nets[0] if nets else None
    init_net = nets[1] if len(nets) > 1 else None
    ans_net = nets[2] if len(nets) > 2 else None
    r.is_activity = root.tag == "PACKETTRACER5_ACTIVITY"

    # ---- student profile (<USER_PROFILE>, <userName>, <userEmail>) ----
    if user_net is not None:
        prof = user_net.find("USER_PROFILE")
        if prof is not None:
            n = (prof.findtext("NAME") or "").strip()
            e = (prof.findtext("EMAIL") or "").strip()
            r.user_name = "" if n.lower() in _PROFILE_PLACEHOLDERS else n
            r.user_email = e
    for tag in ("userName", "USERNAME", "username"):
        if not r.user_name:
            v = root.findtext(f".//{tag}") or root.attrib.get(tag, "")
            if v and v.strip().lower() not in _PROFILE_PLACEHOLDERS:
                r.user_name = v.strip()
    for tag in ("userEmail", "USEREMAIL", "email"):
        if not r.user_email:
            v = root.findtext(f".//{tag}") or root.attrib.get(tag, "")
            if v:
                r.user_email = v.strip()

    # Fallback to Blackboard/Toledo sidecar .txt if student left Guest profile
    if filepath and (not r.user_name or not r.user_email):
        sc_name, sc_extra = parse_sidecar_metadata(filepath)
        if not r.user_name and sc_name:
            r.user_name = f"{sc_name} [Gast-profiel]"
        if not r.user_email and sc_extra:
            r.user_email = sc_extra

    # ---- time (ELAPSED / elapsedTime / elapsed_time) ----
    act = root.find("ACTIVITY")
    for src in ([act.attrib] if act is not None else []):
        for k in ("ELAPSED", "elapsedTime", "elapsed_time"):
            if src.get(k, "").strip().isdigit():
                r.elapsed_ms = int(src[k])
                break
    if r.elapsed_ms is None:
        for k in ("elapsedTime", "elapsed_time", "ELAPSED_TIME"):
            v = root.findtext(f".//{k}")
            if v and v.strip().isdigit():
                r.elapsed_ms = int(v.strip())
                break
    r.start_timestamp = (root.findtext("START_TIMESTAMP") or "").strip()

    # ---- explicitly stored score (<DYNAMICFEEDBACK>, <score>, <percentage>) ----
    for k in ("score", "percentage", "SCORE", "PERCENTAGE", "COMPLETION"):
        v = act.attrib.get(k) if act is not None else None
        v = v or root.findtext(k)
        if v:
            try:
                r.stored_score = float(str(v).strip().rstrip("%").replace(",", "."))
                break
            except ValueError:
                pass
    if r.stored_score is None:
        for tag in ("DYNAMICFEEDBACK", "DYNAMIC_PERCENTAGE_FEEDBACK"):
            el = root.find(f".//{tag}")
            if el is not None:
                for k in ("score", "percentage", "SCORE", "PERCENTAGE"):
                    if k in el.attrib:
                        try:
                            r.stored_score = float(el.attrib[k].strip().rstrip("%").replace(",", "."))
                            break
                        except ValueError:
                            pass

    # ---- grading ----
    comp = root.find("COMPARISONS")
    if comp is not None and ans_net is not None and user_net is not None:
        user_devs = devices_of(user_net)
        ans_devs = devices_of(ans_net)
        by_name_u = {d.name: d for d in user_devs}
        by_name_a = {d.name: d for d in ans_devs}
        leaves: list = []
        for n in comp.findall("NODE"):
            _leaves(n, [], leaves)
        for path, expected, pts in leaves:
            r.items_total += 1
            label = " > ".join(path[1:])
            if len(path) < 3:
                r.unchecked_items.append(label)
                continue
            devname, rel = path[1], path[2:]
            a = by_name_a.get(devname)
            u = by_name_u.get(devname)
            if u is None and a is not None and a in ans_devs:
                idx = ans_devs.index(a)
                u = user_devs[idx] if idx < len(user_devs) else None
            if a is None:
                r.unchecked_items.append(label)
                continue
            if u is None:
                r.items_checkable += 1
                r.points_total += pts
                r.failed_items.append(f"{label} (toestel ontbreekt)")
                continue
            uval, ok = resolve(u, a, rel, expected)
            if not ok:
                r.unchecked_items.append(label)
                continue
            r.items_checkable += 1
            r.points_total += pts
            if _eq(uval, expected):
                r.points_earned += pts
            else:
                r.failed_items.append(_short_label(path, rel))

    # ---- fingerprints for plagiarism detection ----
    if user_net is not None:
        udevs = devices_of(user_net)
        idevs = devices_of(init_net) if init_net is not None else []
        u_coords = [d.coords() for d in udevs if d.coords() and "Power Distribution" not in d.name]
        i_coords = [d.coords() for d in idevs if d.coords() and "Power Distribution" not in d.name]
        r.coords_sequence = tuple(u_coords)
        if not i_coords:
            r.layout_changed = bool(u_coords)
        else:
            r.layout_changed = len(u_coords) != len(i_coords) or any(
                abs(a[0] - b[0]) > 3.0 or abs(a[1] - b[1]) > 3.0 for a, b in zip(u_coords, i_coords)
            )
        r.layout_fp = _h(repr(u_coords)) if u_coords else ""
        mem = sorted(x.text for x in user_net.iter("MEM_ADDR") if x.text)
        r.session_fp = _h("|".join(mem)) if mem else ""
        ref = set()
        for net in (init_net, ans_net):
            for d in devices_of(net):
                ref.update((d.name, _norm(l)) for l in d.running.lines)
        own = sorted({(d.name, _norm(l)) for d in udevs for l in d.running.lines} - ref)
        own = [x for x in own if x[1] not in ("", "!", "end")]
        r.config_fp = _h(repr(own)) if len(own) >= 3 else ""
        r.network_fp = (
            _h(ET.tostring(user_net.find("NETWORK"), encoding="unicode"))
            if user_net.find("NETWORK") is not None
            else ""
        )
    return r


def _short_label(path, rel):
    if rel and rel[0].lower() == "ios configuration":
        return f"{path[1]}: config '{path[-1].strip()}'"
    return f"{path[1]}: {' > '.join(rel)}"


def _h(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="replace")).hexdigest()[:16]
