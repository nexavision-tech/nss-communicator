/**
 * NSS Communicator — Key Generation Module
 * Uses Web Crypto API exclusively for auditable browser-native cryptography.
 *
 * Key Formats:
 *   .nss — Public key export (base64 PEM-like, shareable)
 *   .ss  — Private key export (base64 PEM-like, keep secret)
 *
 * Algorithms:
 *   RSA-OAEP / SHA-256       — Encryption/Decryption
 *   RSASSA-PKCS1-v1_5 / SHA-256 — Signing/Verification
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const NSSKeys = (() => {
  'use strict';

  const ENCRYPTION_ALGO = {
    name: 'RSA-OAEP',
    modulusLength: 4096,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: 'SHA-256',
  };

  const SIGNING_ALGO = {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 4096,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: 'SHA-256',
  };

  const NSS_PUBLIC_HEADER = '-----BEGIN NSS PUBLIC KEY-----';
  const NSS_PUBLIC_FOOTER = '-----END NSS PUBLIC KEY-----';
  const NSS_PRIVATE_HEADER = '-----BEGIN NSS PRIVATE KEY-----';
  const NSS_PRIVATE_FOOTER = '-----END NSS PRIVATE KEY-----';

  /**
   * Generate a full identity keypair (encryption + signing).
   * @returns {Promise<{encrypt: CryptoKeyPair, sign: CryptoKeyPair}>}
   */
  async function generateKeyPair() {
    const [encryptPair, signPair] = await Promise.all([
      crypto.subtle.generateKey(ENCRYPTION_ALGO, true, ['encrypt', 'decrypt']),
      crypto.subtle.generateKey(SIGNING_ALGO, true, ['sign', 'verify']),
    ]);

    return { encrypt: encryptPair, sign: signPair };
  }

  /**
   * Export public keys to .nss format (base64 PEM-like, shareable).
   * Encodes both encryption and signing public keys as a single block.
   * @param {{encrypt: CryptoKeyPair, sign: CryptoKeyPair}} keypair
   * @returns {Promise<string>} .nss formatted string
   */
  async function exportPublicKey(keypair) {
    const [encPub, signPub] = await Promise.all([
      crypto.subtle.exportKey('spki', keypair.encrypt.publicKey),
      crypto.subtle.exportKey('spki', keypair.sign.publicKey),
    ]);

    const payload = JSON.stringify({
      version: 1,
      encrypt: _arrayBufferToBase64(encPub),
      sign: _arrayBufferToBase64(signPub),
    });

    const encoded = btoa(payload);
    const lines = encoded.match(/.{1,64}/g) || [];

    return [NSS_PUBLIC_HEADER, ...lines, NSS_PUBLIC_FOOTER].join('\n');
  }

  /**
   * Export private keys to .ss format (base64 PEM-like, keep secret).
   * Encodes both encryption and signing private keys as a single block.
   * @param {{encrypt: CryptoKeyPair, sign: CryptoKeyPair}} keypair
   * @returns {Promise<string>} .ss formatted string
   */
  async function exportPrivateKey(keypair) {
    const [encPriv, signPriv] = await Promise.all([
      crypto.subtle.exportKey('pkcs8', keypair.encrypt.privateKey),
      crypto.subtle.exportKey('pkcs8', keypair.sign.privateKey),
    ]);

    const payload = JSON.stringify({
      version: 1,
      encrypt: _arrayBufferToBase64(encPriv),
      sign: _arrayBufferToBase64(signPriv),
    });

    const encoded = btoa(payload);
    const lines = encoded.match(/.{1,64}/g) || [];

    return [NSS_PRIVATE_HEADER, ...lines, NSS_PRIVATE_FOOTER].join('\n');
  }

  /**
   * Import a public key from .nss format string.
   * @param {string} nssString — .nss file contents
   * @returns {Promise<{encrypt: CryptoKey, sign: CryptoKey}>}
   */
  async function importPublicKey(nssString) {
    const body = nssString
      .replace(NSS_PUBLIC_HEADER, '')
      .replace(NSS_PUBLIC_FOOTER, '')
      .replace(/\s+/g, '');

    const payload = JSON.parse(atob(body));

    if (payload.version !== 1) {
      throw new Error(`Unsupported NSS key version: ${payload.version}`);
    }

    const [encKey, signKey] = await Promise.all([
      crypto.subtle.importKey(
        'spki',
        _base64ToArrayBuffer(payload.encrypt),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      ),
      crypto.subtle.importKey(
        'spki',
        _base64ToArrayBuffer(payload.sign),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        ['verify']
      ),
    ]);

    return { encrypt: encKey, sign: signKey };
  }

  /**
   * Import a private key from .ss format string.
   * @param {string} ssString — .ss file contents
   * @returns {Promise<{encrypt: CryptoKey, sign: CryptoKey}>}
   */
  async function importPrivateKey(ssString) {
    const body = ssString
      .replace(NSS_PRIVATE_HEADER, '')
      .replace(NSS_PRIVATE_FOOTER, '')
      .replace(/\s+/g, '');

    const payload = JSON.parse(atob(body));

    if (payload.version !== 1) {
      throw new Error(`Unsupported NSS key version: ${payload.version}`);
    }

    const [encKey, signKey] = await Promise.all([
      crypto.subtle.importKey(
        'pkcs8',
        _base64ToArrayBuffer(payload.encrypt),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
      ),
      crypto.subtle.importKey(
        'pkcs8',
        _base64ToArrayBuffer(payload.sign),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        ['sign']
      ),
    ]);

    return { encrypt: encKey, sign: signKey };
  }

  /**
   * Compute SHA-256 fingerprint of a public key, return first 8 hex chars.
   * @param {{encrypt: CryptoKey, sign: CryptoKey}} publicKeys
   * @returns {Promise<string>} 8-character hex fingerprint
   */
  async function getFingerprint(publicKeys) {
    const [encRaw, signRaw] = await Promise.all([
      crypto.subtle.exportKey('spki', publicKeys.encrypt),
      crypto.subtle.exportKey('spki', publicKeys.sign),
    ]);

    // Concatenate both public key buffers for combined fingerprint
    const combined = new Uint8Array(encRaw.byteLength + signRaw.byteLength);
    combined.set(new Uint8Array(encRaw), 0);
    combined.set(new Uint8Array(signRaw), encRaw.byteLength);

    const hash = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = Array.from(new Uint8Array(hash));

    return hashArray
      .slice(0, 4)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Utility Functions ──────────────────────────────────────────────

  function _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ── Public API ─────────────────────────────────────────────────────

  return {
    generateKeyPair,
    exportPublicKey,
    exportPrivateKey,
    importPublicKey,
    importPrivateKey,
    getFingerprint,
    // Expose utils for encrypt.js
    _arrayBufferToBase64,
    _base64ToArrayBuffer,
  };
})();

// Make available to other extension scripts
if (typeof globalThis !== 'undefined') {
  globalThis.NSSKeys = NSSKeys;
}
