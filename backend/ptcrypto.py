"""
ptcrypto.py - Decoder for Cisco Packet Tracer .pkt / .pka / .pkz files (PT 5.x - 9.0.1+).

Supported container formats
---------------------------
1. Modern Packet Tracer 7.x, 8.x, 9.0.x (Twofish-128 EAX):
     stage 1  reverse bytes + positional XOR   out[i] = in[n-1-i] ^ ((n - i*n) & 0xFF)
     stage 2  Twofish-128 in EAX mode          key = 0x89 * 16, nonce = 0x10 * 16,
                                               last 16 bytes = EAX authentication tag
     stage 3  positional XOR                   out[i] = in[i] ^ ((m - i) & 0xFF)
     stage 4  Qt qUncompress                   4-byte big-endian size + zlib stream
2. Alternative / Spec Container (Twofish-128 CBC + IV[4:20] + positional XOR):
     - Fixed 128-bit key:
       0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
       0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c
     - Read IV from bytes [4:20]
     - Positional XOR unmask on ciphertext: byte[i] ^ ((i + key_offset) & 0xFF)
     - Twofish CBC decryption with extracted IV
     - Bypass Qt qCompress 4-byte uncompressed size header + zlib.decompress
3. Legacy Packet Tracer 5.x / 6.x:
     positional XOR out[i] = in[i] ^ ((n - i) & 0xFF) followed by qUncompress.
4. ZIP / .pkz containers (automatically extracts embedded .pka / .pkt).
5. Plain XML or plain (q)zlib deflate streams.
"""

from __future__ import annotations

import io
import struct
import zipfile
import zlib

__all__ = [
    "decode_packet_tracer",
    "PacketTracerDecodeError",
    "Twofish",
    "SPEC_TWOFISH_KEY",
    "PT_EAX_KEY",
    "PT_EAX_NONCE",
    "self_test",
]


class PacketTracerDecodeError(Exception):
    """Raised when a file cannot be decoded by any supported pipeline."""


# Fixed 128-bit keys
SPEC_TWOFISH_KEY = bytes([
    0x2B, 0x7E, 0x15, 0x16, 0x28, 0xAE, 0xD2, 0xA6,
    0xAB, 0xF7, 0x15, 0x88, 0x09, 0xCF, 0x4F, 0x3C,
])
PT_EAX_KEY = bytes([0x89] * 16)
PT_EAX_NONCE = bytes([0x10] * 16)


# --------------------------------------------------------------------------- #
#  Twofish (128-bit key, encrypt + decrypt)                                   #
# --------------------------------------------------------------------------- #
_Q0_T = (
    (8, 1, 7, 13, 6, 15, 3, 2, 0, 11, 5, 9, 14, 12, 10, 4),
    (14, 12, 11, 8, 1, 2, 3, 5, 15, 4, 10, 6, 7, 0, 9, 13),
    (11, 10, 5, 14, 6, 13, 9, 0, 12, 8, 15, 3, 2, 4, 7, 1),
    (13, 7, 15, 4, 1, 2, 6, 14, 9, 11, 3, 0, 8, 5, 12, 10),
)
_Q1_T = (
    (2, 8, 11, 13, 15, 7, 6, 14, 3, 1, 9, 4, 0, 10, 12, 5),
    (1, 14, 2, 11, 4, 12, 3, 7, 6, 13, 10, 5, 15, 9, 0, 8),
    (4, 12, 7, 5, 1, 6, 9, 10, 0, 14, 13, 8, 2, 11, 3, 15),
    (11, 9, 5, 1, 12, 3, 13, 14, 6, 4, 7, 15, 2, 0, 8, 10),
)


def _ror4(x: int, n: int) -> int:
    return ((x >> n) | (x << (4 - n))) & 0xF


def _make_q(t):
    out = []
    for x in range(256):
        a0, b0 = x >> 4, x & 0xF
        a1 = a0 ^ b0
        b1 = a0 ^ _ror4(b0, 1) ^ ((8 * a0) & 0xF)
        a2, b2 = t[0][a1], t[1][b1]
        a3 = a2 ^ b2
        b3 = a2 ^ _ror4(b2, 1) ^ ((8 * a2) & 0xF)
        a4, b4 = t[2][a3], t[3][b3]
        out.append((b4 << 4) | a4)
    return tuple(out)


Q0 = _make_q(_Q0_T)
Q1 = _make_q(_Q1_T)


def _gf_mul(a: int, b: int, poly: int) -> int:
    r = 0
    while b:
        if b & 1:
            r ^= a
        a <<= 1
        if a & 0x100:
            a ^= poly
        b >>= 1
    return r


_MDS = (
    (0x01, 0xEF, 0x5B, 0x5B),
    (0x5B, 0xEF, 0xEF, 0x01),
    (0xEF, 0x5B, 0x01, 0xEF),
    (0xEF, 0x01, 0xEF, 0x5B),
)
_RS = (
    (0x01, 0xA4, 0x55, 0x87, 0x5A, 0x58, 0xDB, 0x9E),
    (0xA4, 0x56, 0x82, 0xF3, 0x1E, 0xC6, 0x68, 0xE5),
    (0x02, 0xA1, 0xFC, 0xC1, 0x47, 0xAE, 0x3D, 0x19),
    (0xA4, 0x55, 0x87, 0x5A, 0x58, 0xDB, 0x9E, 0x03),
)
_M32 = 0xFFFFFFFF


def _rol(x: int, n: int) -> int:
    return ((x << n) | (x >> (32 - n))) & _M32


def _mds_col(j: int, v: int) -> int:
    return (
        _gf_mul(_MDS[0][j], v, 0x169)
        | (_gf_mul(_MDS[1][j], v, 0x169) << 8)
        | (_gf_mul(_MDS[2][j], v, 0x169) << 16)
        | (_gf_mul(_MDS[3][j], v, 0x169) << 24)
    )


def _h(x: int, L) -> int:
    y = [(x >> (8 * i)) & 0xFF for i in range(4)]
    l0 = [(L[0] >> (8 * i)) & 0xFF for i in range(4)]
    l1 = [(L[1] >> (8 * i)) & 0xFF for i in range(4)]
    y0 = Q1[Q0[Q0[y[0]] ^ l1[0]] ^ l0[0]]
    y1 = Q0[Q0[Q1[y[1]] ^ l1[1]] ^ l0[1]]
    y2 = Q1[Q1[Q0[y[2]] ^ l1[2]] ^ l0[2]]
    y3 = Q0[Q1[Q1[y[3]] ^ l1[3]] ^ l0[3]]
    return _mds_col(0, y0) ^ _mds_col(1, y1) ^ _mds_col(2, y2) ^ _mds_col(3, y3)


class Twofish:
    """Twofish 128-bit block cipher (ECB encrypt/decrypt + CBC decrypt)."""

    block_size = 16

    def __init__(self, key: bytes):
        if len(key) != 16:
            raise ValueError("Only 128-bit Twofish keys are supported")
        m = struct.unpack("<4I", key)
        me, mo = [m[0], m[2]], [m[1], m[3]]
        s = []
        for i in range(2):
            kb = key[8 * i : 8 * i + 8]
            w = 0
            for r in range(4):
                v = 0
                for c in range(8):
                    v ^= _gf_mul(_RS[r][c], kb[c], 0x14D)
                w |= v << (8 * r)
            s.append(w)
        sbox_key = [s[1], s[0]]
        rho = 0x01010101
        k = []
        for i in range(20):
            a = _h(2 * i * rho, me)
            b = _rol(_h((2 * i + 1) * rho, mo), 8)
            k.append((a + b) & _M32)
            k.append(_rol((a + 2 * b) & _M32, 9))
        self.K = k
        l0 = [(sbox_key[0] >> (8 * i)) & 0xFF for i in range(4)]
        l1 = [(sbox_key[1] >> (8 * i)) & 0xFF for i in range(4)]
        self.T0 = [_mds_col(0, Q1[Q0[Q0[v] ^ l1[0]] ^ l0[0]]) for v in range(256)]
        self.T1 = [_mds_col(1, Q0[Q0[Q1[v] ^ l1[1]] ^ l0[1]]) for v in range(256)]
        self.T2 = [_mds_col(2, Q1[Q1[Q0[v] ^ l1[2]] ^ l0[2]]) for v in range(256)]
        self.T3 = [_mds_col(3, Q0[Q1[Q1[v] ^ l1[3]] ^ l0[3]]) for v in range(256)]

    def encrypt_block(self, block: bytes) -> bytes:
        K, T0, T1, T2, T3 = self.K, self.T0, self.T1, self.T2, self.T3
        r0, r1, r2, r3 = struct.unpack("<4I", block)
        r0 ^= K[0]; r1 ^= K[1]; r2 ^= K[2]; r3 ^= K[3]
        for rnd in range(0, 16, 2):
            t0 = T0[r0 & 0xFF] ^ T1[(r0 >> 8) & 0xFF] ^ T2[(r0 >> 16) & 0xFF] ^ T3[r0 >> 24]
            t1 = T0[r1 >> 24] ^ T1[r1 & 0xFF] ^ T2[(r1 >> 8) & 0xFF] ^ T3[(r1 >> 16) & 0xFF]
            r2 ^= (t0 + t1 + K[2 * rnd + 8]) & _M32
            r2 = ((r2 >> 1) | (r2 << 31)) & _M32
            r3 = (((r3 << 1) | (r3 >> 31)) & _M32) ^ ((t0 + 2 * t1 + K[2 * rnd + 9]) & _M32)
            t0 = T0[r2 & 0xFF] ^ T1[(r2 >> 8) & 0xFF] ^ T2[(r2 >> 16) & 0xFF] ^ T3[r2 >> 24]
            t1 = T0[r3 >> 24] ^ T1[r3 & 0xFF] ^ T2[(r3 >> 8) & 0xFF] ^ T3[(r3 >> 16) & 0xFF]
            r0 ^= (t0 + t1 + K[2 * rnd + 10]) & _M32
            r0 = ((r0 >> 1) | (r0 << 31)) & _M32
            r1 = (((r1 << 1) | (r1 >> 31)) & _M32) ^ ((t0 + 2 * t1 + K[2 * rnd + 11]) & _M32)
        return struct.pack("<4I", r2 ^ K[4], r3 ^ K[5], r0 ^ K[6], r1 ^ K[7])

    def decrypt_block(self, block: bytes) -> bytes:
        K, T0, T1, T2, T3 = self.K, self.T0, self.T1, self.T2, self.T3
        r2, r3, r0, r1 = struct.unpack("<4I", block)
        r2 ^= K[4]; r3 ^= K[5]; r0 ^= K[6]; r1 ^= K[7]
        for rnd in range(14, -1, -2):
            t0 = T0[r2 & 0xFF] ^ T1[(r2 >> 8) & 0xFF] ^ T2[(r2 >> 16) & 0xFF] ^ T3[r2 >> 24]
            t1 = T0[r3 >> 24] ^ T1[r3 & 0xFF] ^ T2[(r3 >> 8) & 0xFF] ^ T3[(r3 >> 16) & 0xFF]
            r0 = (((r0 << 1) | (r0 >> 31)) & _M32) ^ ((t0 + t1 + K[2 * rnd + 10]) & _M32)
            r1 ^= (t0 + 2 * t1 + K[2 * rnd + 11]) & _M32
            r1 = ((r1 >> 1) | (r1 << 31)) & _M32
            t0 = T0[r0 & 0xFF] ^ T1[(r0 >> 8) & 0xFF] ^ T2[(r0 >> 16) & 0xFF] ^ T3[r0 >> 24]
            t1 = T0[r1 >> 24] ^ T1[r1 & 0xFF] ^ T2[(r1 >> 8) & 0xFF] ^ T3[(r1 >> 16) & 0xFF]
            r2 = (((r2 << 1) | (r2 >> 31)) & _M32) ^ ((t0 + t1 + K[2 * rnd + 8]) & _M32)
            r3 ^= (t0 + 2 * t1 + K[2 * rnd + 9]) & _M32
            r3 = ((r3 >> 1) | (r3 << 31)) & _M32
        return struct.pack("<4I", r0 ^ K[0], r1 ^ K[1], r2 ^ K[2], r3 ^ K[3])

    def decrypt_cbc(self, ciphertext: bytes, iv: bytes) -> bytes:
        n = (len(ciphertext) // 16) * 16
        out = bytearray(n)
        prev = int.from_bytes(iv[:16], "big")
        for i in range(0, n, 16):
            blk = ciphertext[i : i + 16]
            dec = int.from_bytes(self.decrypt_block(blk), "big") ^ prev
            out[i : i + 16] = dec.to_bytes(16, "big")
            prev = int.from_bytes(blk, "big")
        return bytes(out)


# --------------------------------------------------------------------------- #
#  EAX mode (CTR + OMAC/CMAC)                                                 #
# --------------------------------------------------------------------------- #
def _dbl(b: bytes) -> bytes:
    n = int.from_bytes(b, "big") << 1
    if n >> 128:
        n = (n ^ 0x87) & ((1 << 128) - 1)
    return n.to_bytes(16, "big")


def _xor16(a: bytes, b: bytes) -> bytes:
    return (int.from_bytes(a, "big") ^ int.from_bytes(b, "big")).to_bytes(16, "big")


def _cmac(cipher: Twofish, msg: bytes) -> bytes:
    k1 = _dbl(cipher.encrypt_block(b"\x00" * 16))
    k2 = _dbl(k1)
    if msg and len(msg) % 16 == 0:
        last = _xor16(msg[-16:], k1)
        body = msg[:-16]
    else:
        rem = len(msg) % 16
        tail = msg[len(msg) - rem :] + b"\x80" + b"\x00" * (15 - rem)
        last = _xor16(tail, k2)
        body = msg[: len(msg) - rem]
    x = b"\x00" * 16
    for i in range(0, len(body), 16):
        x = cipher.encrypt_block(_xor16(x, body[i : i + 16]))
    return cipher.encrypt_block(_xor16(x, last))


def _omac(cipher: Twofish, t: int, msg: bytes) -> bytes:
    return _cmac(cipher, b"\x00" * 15 + bytes([t]) + msg)


def eax_decrypt(key: bytes, nonce: bytes, data: bytes, verify: bool = False,
                progress=None) -> bytes:
    """Twofish-EAX decrypt. `data` = ciphertext || 16-byte tag."""
    cipher = Twofish(key)
    ct, tag = data[:-16], data[-16:]
    n = _omac(cipher, 0, nonce)
    if verify:
        h = _omac(cipher, 1, b"")
        c = _omac(cipher, 2, ct)
        calc = _xor16(_xor16(n, h), c)
        if calc != tag:
            raise PacketTracerDecodeError("EAX authentication tag mismatch")
    ctr = int.from_bytes(n, "big")
    enc = cipher.encrypt_block
    out = bytearray(len(ct))
    mask = (1 << 128) - 1
    total = len(ct)
    for i in range(0, total, 16):
        ks = enc(ctr.to_bytes(16, "big"))
        chunk = ct[i : i + 16]
        out[i : i + len(chunk)] = (
            int.from_bytes(chunk, "big") ^ int.from_bytes(ks[: len(chunk)], "big")
        ).to_bytes(len(chunk), "big")
        ctr = (ctr + 1) & mask
        if progress and (i & 0xFFFF) == 0:
            progress(i / total)
    return bytes(out)


# --------------------------------------------------------------------------- #
#  Decompression & Pipelines                                                  #
# --------------------------------------------------------------------------- #
def _q_uncompress(buf: bytes) -> bytes:
    """Bypass Qt qCompress 4-byte uncompressed size header and decompress with zlib
    (with an offset scan fallback for 0x78 headers)."""
    if len(buf) >= 6 and buf[4] == 0x78:
        try:
            return zlib.decompress(buf[4:])
        except zlib.error:
            pass
    try:
        return zlib.decompress(buf)
    except zlib.error:
        pass
    # Offset scan fallback for 0x78 zlib headers
    for off in range(0, min(len(buf) - 2, 128)):
        if buf[off] == 0x78 and buf[off + 1] in (0x01, 0x5E, 0x9C, 0xDA):
            try:
                return zlib.decompressobj().decompress(buf[off:])
            except zlib.error:
                continue
    raise PacketTracerDecodeError("zlib stream not found")


def _looks_like_xml(b: bytes) -> bool:
    head = b[:256].lstrip(b"\xef\xbb\xbf \r\n\t")
    return head.startswith(b"<?xml") or head.startswith(b"<PACKETTRACER")


def _decode_modern_eax(data: bytes, progress=None) -> bytes:
    n = len(data)
    s1 = bytearray(n)
    for i in range(n):
        s1[i] = data[n - 1 - i] ^ ((n - i * n) & 0xFF)
    s2 = eax_decrypt(PT_EAX_KEY, PT_EAX_NONCE, bytes(s1), progress=progress)
    m = len(s2)
    s3 = bytes(s2[i] ^ ((m - i) & 0xFF) for i in range(m))
    return _q_uncompress(s3)


def _decode_spec_cbc(data: bytes, key_offset: int = 20) -> bytes:
    """Spec CBC pipeline:
    - Fixed 128-bit Twofish key SPEC_TWOFISH_KEY
    - Read IV from bytes [4:20]
    - Positional XOR unmask on ciphertext: byte[i] ^ ((i + key_offset) & 0xFF)
    - Twofish CBC decrypt + bypass 4-byte qCompress header + zlib.decompress
    """
    if len(data) < 36:
        raise PacketTracerDecodeError("Container too short for CBC header")
    iv = data[4:20]
    ct = data[20:]
    unmasked = bytes(ct[i] ^ ((i + key_offset) & 0xFF) for i in range(len(ct)))
    pt = Twofish(SPEC_TWOFISH_KEY).decrypt_cbc(unmasked, iv)
    return _q_uncompress(pt)


def _decode_legacy(data: bytes) -> bytes:
    n = len(data)
    s = bytes(data[i] ^ ((n - i) & 0xFF) for i in range(n))
    return _q_uncompress(s)


def decode_packet_tracer(data: bytes, progress=None) -> tuple[str, str]:
    """
    Decode a Packet Tracer (.pka / .pkt / .pkz) file.

    Returns (xml_text, method) where method describes the pipeline that worked.
    Raises PacketTracerDecodeError if no pipeline succeeded.
    """
    if _looks_like_xml(data):
        return data.decode("utf-8", errors="replace"), "plain-xml"

    # ZIP / .pkz archive containing a .pka or .pkt
    if data[:4] == b"PK\x03\x04":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for info in zf.infolist():
                    if info.filename.lower().endswith((".pka", ".pkt", ".xml")):
                        xml, how = decode_packet_tracer(zf.read(info.filename), progress=progress)
                        return xml, f"pkz->{how}"
        except Exception as e:  # noqa: BLE001
            raise PacketTracerDecodeError(f"pkz archive error: {e}") from e

    errors = []
    # Plain (q)zlib fallback
    if data[:1] == b"\x78" or (len(data) > 5 and data[4] == 0x78):
        try:
            xml = _q_uncompress(data)
            if _looks_like_xml(xml):
                return xml.decode("utf-8", errors="replace"), "plain-zlib"
        except PacketTracerDecodeError as e:
            errors.append(f"plain-zlib: {e}")

    pipelines = (
        ("twofish-eax (PT 7/8/9.0.1)", lambda d: _decode_modern_eax(d, progress)),
        ("twofish-cbc (spec)", _decode_spec_cbc),
        ("legacy-xor (PT 5/6)", _decode_legacy),
    )
    for name, fn in pipelines:
        try:
            xml = fn(data)
            if _looks_like_xml(xml) or b"<PACKETTRACER" in xml[:4096]:
                return xml.decode("utf-8", errors="replace"), name
            errors.append(f"{name}: decoded but no XML root")
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e}")
    raise PacketTracerDecodeError("; ".join(errors))


def self_test() -> bool:
    """Official Twofish KAT: 128-bit zero key, zero plaintext + encrypt/decrypt round-trip."""
    tf = Twofish(b"\x00" * 16)
    ct = tf.encrypt_block(b"\x00" * 16)
    pt = tf.decrypt_block(ct)
    tf2 = Twofish(SPEC_TWOFISH_KEY)
    b2 = tf2.decrypt_block(tf2.encrypt_block(b"PacketTracerTest"))
    return ct.hex().upper() == "9F589F5CF6122C32B6BFEC2F2AE8C35A" and pt == b"\x00" * 16 and b2 == b"PacketTracerTest"
