/**
 * cisco_crypto.js - Cisco Security, Password Encryption, and IP Networking Core
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

const CiscoCrypto = {
  // Cisco Type 7 Encryption Key (standard constant used in Cisco IOS)
  KEY: "dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87",

  /**
   * Decrypts Cisco Type 7 password to plaintext
   */
  decryptType7(enc) {
    if (!enc || enc.length < 4 || enc.length % 2 !== 0) return enc;
    try {
      const seed = parseInt(enc.slice(0, 2), 10);
      if (isNaN(seed) || seed < 0 || seed > 15) return enc;
      let out = "";
      for (let i = 2; i < enc.length; i += 2) {
        const hex = enc.slice(i, i + 2);
        const val = parseInt(hex, 16);
        const keyChar = this.KEY[(seed + (i - 2) / 2) % this.KEY.length];
        out += String.fromCharCode(val ^ keyChar.charCodeAt(0));
      }
      return out;
    } catch (e) {
      return enc;
    }
  },

  /**
   * Encrypts plaintext password into Cisco Type 7 format
   */
  encryptType7(plain) {
    if (!plain) return "";
    const seed = Math.floor(Math.random() * 15);
    const seedStr = seed.toString().padStart(2, "0");
    let hex = "";
    for (let i = 0; i < plain.length; i++) {
      const keyChar = this.KEY[(seed + i) % this.KEY.length];
      const val = plain.charCodeAt(i) ^ keyChar.charCodeAt(0);
      hex += val.toString(16).padStart(2, "0").toUpperCase();
    }
    return seedStr + hex;
  },

  /**
   * Generates a simulated Cisco Type 5 MD5 secret hash ($1$...)
   */
  hashType5(plain) {
    if (!plain) return "";
    // Deterministic simulation of Cisco Type 5 hash
    let hash = 0;
    for (let i = 0; i < plain.length; i++) {
      hash = ((hash << 5) - hash) + plain.charCodeAt(i);
      hash |= 0;
    }
    const salt = "PXL" + Math.abs(hash % 999).toString().padStart(3, "0");
    const digest = Math.abs(hash).toString(36).padEnd(22, "x");
    return `$1$${salt}$${digest}`;
  },

  /**
   * Hashes student submission package for anti-tamper verification
   */
  generateSubmissionSignature(payloadStr) {
    let hash1 = 5381, hash2 = 52711;
    for (let i = 0; i < payloadStr.length; i++) {
      const char = payloadStr.charCodeAt(i);
      hash1 = ((hash1 << 5) + hash1) ^ char;
      hash2 = ((hash2 << 5) + hash2) ^ (char * (i + 1));
    }
    const sig1 = (hash1 >>> 0).toString(16).padStart(8, '0');
    const sig2 = (hash2 >>> 0).toString(16).padStart(8, '0');
    return `PXL-VERIFIED-${sig1}-${sig2}`.toUpperCase();
  }
};

/**
 * IP & Subnetting calculation utilities
 */
const IPUtils = {
  isValidIp(ip) {
    if (typeof ip !== 'string') return false;
    const parts = ip.trim().split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => {
      if (!/^\d+$/.test(p)) return false;
      const n = parseInt(p, 10);
      return n >= 0 && n <= 255;
    });
  },

  ipToInt(ip) {
    if (!this.isValidIp(ip)) return 0;
    return ip.trim().split('.').reduce((acc, oct) => ((acc << 8) + parseInt(oct, 10)) >>> 0, 0);
  },

  intToIp(intVal) {
    return [
      (intVal >>> 24) & 255,
      (intVal >>> 16) & 255,
      (intVal >>> 8) & 255,
      intVal & 255
    ].join('.');
  },

  maskToPrefix(mask) {
    if (!this.isValidIp(mask)) return 0;
    const n = this.ipToInt(mask);
    return n.toString(2).split('1').length - 1;
  },

  prefixToMask(prefix) {
    const p = Math.max(0, Math.min(32, parseInt(prefix, 10) || 0));
    const mask = p === 0 ? 0 : (~0 << (32 - p)) >>> 0;
    return this.intToIp(mask);
  },

  getNetwork(ip, mask) {
    const ipInt = this.ipToInt(ip);
    const maskInt = this.ipToInt(mask);
    return this.intToIp((ipInt & maskInt) >>> 0);
  },

  isSameSubnet(ipA, ipB, mask) {
    if (!this.isValidIp(ipA) || !this.isValidIp(ipB) || !this.isValidIp(mask)) return false;
    const maskInt = this.ipToInt(mask);
    return ((this.ipToInt(ipA) & maskInt) >>> 0) === ((this.ipToInt(ipB) & maskInt) >>> 0);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CiscoCrypto, IPUtils };
}

