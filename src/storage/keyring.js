/**
 * NSS Communicator — Secure IndexedDB Key Storage (Keyring)
 *
 * CRITICAL SECURITY: Private keys are NEVER stored in plaintext.
 * They are wrapped (encrypted) using a key derived from the user's
 * passphrase via PBKDF2 (100,000 iterations) + AES-256-GCM.
 *
 * Flow:
 *   1. User sets a passphrase on first key generation
 *   2. PBKDF2 derives a wrapping key from passphrase + random salt
 *   3. Private keys are encrypted with AES-256-GCM using the wrapping key
 *   4. Only the encrypted blob + salt + iv are stored in IndexedDB
 *   5. To use keys, user must "unlock" the keyring with their passphrase
 *
 * Stores:
 *   'identity' — User's wrapped private key + plaintext public key
 *   'contacts' — Imported public keys indexed by fingerprint
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const NSSKeyring = (() => {
  'use strict';

  const DB_NAME = 'nss-keyring';
  const DB_VERSION = 2;
  const STORE_IDENTITY = 'identity';
  const STORE_CONTACTS = 'contacts';
  const PBKDF2_ITERATIONS = 100000;

  let _db = null;
  let _wrappingKey = null;  // Derived from passphrase, lives in memory only

  // ── Database ──────────────────────────────────────────────────────

  function initKeyring() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_IDENTITY)) {
          db.createObjectStore(STORE_IDENTITY, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
          const cs = db.createObjectStore(STORE_CONTACTS, { keyPath: 'fingerprint' });
          cs.createIndex('name', 'name', { unique: false });
          cs.createIndex('email', 'email', { unique: false });
        }
      };

      request.onsuccess = (event) => { _db = event.target.result; resolve(_db); };
      request.onerror = (event) => { reject(new Error(`Keyring open failed: ${event.target.error}`)); };
    });
  }

  function _txn(storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      if (!_db) { reject(new Error('Keyring not initialized')); return; }
      const txn = _db.transaction(storeName, mode);
      const store = txn.objectStore(storeName);
      const req = operation(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(`Keyring op failed: ${req.error}`));
    });
  }

  // ── Passphrase Key Derivation (PBKDF2) ────────────────────────────

  /**
   * Derive an AES-256-GCM wrapping key from a passphrase + salt.
   * @param {string} passphrase — User's passphrase
   * @param {Uint8Array} salt — 16-byte random salt
   * @returns {Promise<CryptoKey>} — AES-256-GCM key
   */
  async function _deriveWrappingKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,   // extractable — needed for session storage persistence
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt private key data with the wrapping key.
   * @param {string} plaintext — Private key string to encrypt
   * @param {CryptoKey} wrappingKey — AES-256-GCM key
   * @returns {Promise<{ciphertext: ArrayBuffer, iv: Uint8Array}>}
   */
  async function _wrapPrivateKey(plaintext, wrappingKey) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      wrappingKey,
      encoder.encode(plaintext)
    );
    return { ciphertext, iv };
  }

  /**
   * Decrypt private key data with the wrapping key.
   * @param {ArrayBuffer} ciphertext — Encrypted private key
   * @param {Uint8Array} iv — 12-byte IV
   * @param {CryptoKey} wrappingKey — AES-256-GCM key
   * @returns {Promise<string>} — Decrypted private key string
   */
  async function _unwrapPrivateKey(ciphertext, iv, wrappingKey) {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      wrappingKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  // ── Keyring Lock/Unlock ───────────────────────────────────────────

  /**
   * Unlock the keyring with a passphrase.
   * Derives the wrapping key and verifies it against stored identity.
   * @param {string} passphrase
   * @returns {Promise<boolean>} — true if unlock succeeded
   */
  async function unlock(passphrase) {
    const identity = await _txn(STORE_IDENTITY, 'readonly', (s) => s.get('primary'));
    if (!identity) {
      throw new Error('No identity found. Generate keys first.');
    }

    const salt = new Uint8Array(identity.salt);
    const wrappingKey = await _deriveWrappingKey(passphrase, salt);

    try {
      // Try to decrypt — if passphrase is wrong, AES-GCM will throw
      const iv = new Uint8Array(identity.privateKeyIV);
      const ct = new Uint8Array(identity.privateKeyCiphertext).buffer;
      await _unwrapPrivateKey(ct, iv, wrappingKey);

      // Success — store wrapping key in memory
      _wrappingKey = wrappingKey;
      await _saveSession(wrappingKey);
      _resetLockTimer();
      return true;
    } catch (e) {
      _wrappingKey = null;
      throw new Error('Wrong passphrase. Cannot unlock keyring.');
    }
  }

  /**
   * Lock the keyring — wipe the wrapping key from memory.
   */
  function lock() {
    _wrappingKey = null;
    _clearSession();
  }

  /**
   * Check if keyring is currently unlocked.
   * @returns {boolean}
   */
  function isUnlocked() {
    return _wrappingKey !== null;
  }

  // ── Identity (User's Keypair) ─────────────────────────────────────

  /**
   * Save the user's identity keypair, encrypted with a passphrase.
   * Called once during key generation ("brew your keys").
   *
   * @param {{encrypt: CryptoKeyPair, sign: CryptoKeyPair}} keypair
   * @param {string} passphrase — User-chosen passphrase to protect keys
   * @param {string} email — Optional label
   * @returns {Promise<void>}
   */
  async function saveIdentity(keypair, passphrase, email = '') {
    // Export keys to strings
    const publicKeyStr = await NSSKeys.exportPublicKey(keypair);
    const privateKeyStr = await NSSKeys.exportPrivateKey(keypair);
    const publicKeys = {
      encrypt: keypair.encrypt.publicKey,
      sign: keypair.sign.publicKey,
    };
    const fingerprint = await NSSKeys.getFingerprint(publicKeys);

    // Generate salt + derive wrapping key
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrappingKey = await _deriveWrappingKey(passphrase, salt);

    // Wrap (encrypt) the private key
    const { ciphertext, iv } = await _wrapPrivateKey(privateKeyStr, wrappingKey);

    // Store: public key in plaintext, private key encrypted
    const record = {
      id: 'primary',
      publicKey: publicKeyStr,                            // Plaintext (it's public)
      privateKeyCiphertext: Array.from(new Uint8Array(ciphertext)),  // Encrypted
      privateKeyIV: Array.from(iv),                       // IV for AES-GCM
      salt: Array.from(salt),                             // Salt for PBKDF2
      fingerprint,
      email,
      createdAt: new Date().toISOString(),
      pbkdf2Iterations: PBKDF2_ITERATIONS,
    };

    await _txn(STORE_IDENTITY, 'readwrite', (store) => store.put(record));

    // Keep wrapping key in memory (keyring is now unlocked)
    _wrappingKey = wrappingKey;
  }

  /**
   * Get the user's identity (public info — always available).
   * @returns {Promise<{publicKey, fingerprint, email, createdAt}|null>}
   */
  async function getIdentity() {
    const result = await _txn(STORE_IDENTITY, 'readonly', (s) => s.get('primary'));
    if (!result) return null;
    return {
      publicKey: result.publicKey,
      fingerprint: result.fingerprint,
      email: result.email,
      createdAt: result.createdAt,
      locked: !isUnlocked(),
    };
  }

  /**
   * Get the decrypted private key string. Requires unlocked keyring.
   * @returns {Promise<string>} — Private key in .ss format
   */
  async function getPrivateKey() {
    if (!_wrappingKey) {
      throw new Error('Keyring is locked. Call unlock(passphrase) first.');
    }

    const identity = await _txn(STORE_IDENTITY, 'readonly', (s) => s.get('primary'));
    if (!identity) throw new Error('No identity found.');

    const iv = new Uint8Array(identity.privateKeyIV);
    const ct = new Uint8Array(identity.privateKeyCiphertext).buffer;

    return _unwrapPrivateKey(ct, iv, _wrappingKey);
  }

  /**
   * Change the passphrase. Re-wraps the private key with new passphrase.
   * Requires current keyring to be unlocked.
   * @param {string} newPassphrase
   * @returns {Promise<void>}
   */
  async function changePassphrase(newPassphrase) {
    if (!_wrappingKey) {
      throw new Error('Keyring must be unlocked to change passphrase.');
    }

    // Decrypt with old key
    const privateKeyStr = await getPrivateKey();
    const identity = await _txn(STORE_IDENTITY, 'readonly', (s) => s.get('primary'));

    // Re-encrypt with new passphrase
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newWrappingKey = await _deriveWrappingKey(newPassphrase, newSalt);
    const { ciphertext, iv } = await _wrapPrivateKey(privateKeyStr, newWrappingKey);

    // Update record
    identity.privateKeyCiphertext = Array.from(new Uint8Array(ciphertext));
    identity.privateKeyIV = Array.from(iv);
    identity.salt = Array.from(newSalt);

    await _txn(STORE_IDENTITY, 'readwrite', (store) => store.put(identity));

    _wrappingKey = newWrappingKey;
  }

  // ── Contacts (Public Keys Only) ───────────────────────────────────

  async function addContact(name, email, publicKeyStr, fingerprint) {
    return _txn(STORE_CONTACTS, 'readwrite', (store) => store.put({
      fingerprint, name, email,
      publicKey: publicKeyStr,
      addedAt: new Date().toISOString(),
      trusted: true,
    }));
  }

  async function getContact(fingerprint) {
    const r = await _txn(STORE_CONTACTS, 'readonly', (s) => s.get(fingerprint));
    return r || null;
  }

  function getAllContacts() {
    return new Promise((resolve, reject) => {
      if (!_db) { reject(new Error('Keyring not initialized')); return; }
      const req = _db.transaction(STORE_CONTACTS, 'readonly').objectStore(STORE_CONTACTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(new Error(`List contacts failed: ${req.error}`));
    });
  }

  function removeContact(fingerprint) {
    return _txn(STORE_CONTACTS, 'readwrite', (s) => s.delete(fingerprint));
  }

  async function exportKeyring() {
    const contacts = await getAllContacts();
    const identity = await getIdentity();
    return JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      identity: identity ? { fingerprint: identity.fingerprint, email: identity.email, publicKey: identity.publicKey } : null,
      contacts,  // Public keys only — private key NEVER exported here
    }, null, 2);
  }

  async function importKeyring(json) {
    const data = JSON.parse(json);
    let imported = 0, skipped = 0;
    for (const c of (data.contacts || [])) {
      if (await getContact(c.fingerprint)) { skipped++; }
      else { await addContact(c.name, c.email, c.publicKey, c.fingerprint); imported++; }
    }
    return { imported, skipped };
  }

  // ── Session Storage (Chrome MV3 service worker persistence) ──────
  // Chrome's service workers die after ~30s of inactivity, wiping
  // the in-memory _wrappingKey. We persist the raw key bytes in
  // chrome.storage.session (memory-only, never written to disk,
  // cleared on browser close). Firefox MV2 doesn't have this API.

  function _hasSessionStorage() {
    return typeof browser !== 'undefined' &&
           browser.storage &&
           typeof browser.storage.session !== 'undefined';
  }

  async function _saveSession(wrappingKey) {
    if (!_hasSessionStorage()) return;
    try {
      const raw = await crypto.subtle.exportKey('raw', wrappingKey);
      await browser.storage.session.set({
        _nssKey: Array.from(new Uint8Array(raw)),
        _nssKeyTime: Date.now(),
      });
    } catch (e) {
      // Silently fail — session persistence is best-effort
    }
  }

  function _clearSession() {
    if (!_hasSessionStorage()) return;
    try { browser.storage.session.remove(['_nssKey', '_nssKeyTime']); } catch (e) { /* */ }
  }

  /**
   * Try to restore the wrapping key from session storage.
   * Called by background.js on service worker restart.
   * @returns {Promise<boolean>} — true if session was restored
   */
  async function tryRestoreSession() {
    if (!_hasSessionStorage()) return false;
    if (_wrappingKey) return true;  // Already unlocked
    try {
      const data = await browser.storage.session.get(['_nssKey', '_nssKeyTime']);
      if (!data._nssKey) return false;

      // Check if session has expired (15 minutes)
      if (Date.now() - data._nssKeyTime > AUTO_LOCK_MS) {
        _clearSession();
        return false;
      }

      // Re-import the wrapping key
      const rawKey = new Uint8Array(data._nssKey).buffer;
      _wrappingKey = await crypto.subtle.importKey(
        'raw', rawKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
      _resetLockTimer();
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Auto-Lock Timer ───────────────────────────────────────────────

  let _lockTimer = null;
  const AUTO_LOCK_MS = 15 * 60 * 1000;  // 15 minutes

  function _resetLockTimer() {
    if (_lockTimer) clearTimeout(_lockTimer);
    _lockTimer = setTimeout(() => {
      lock();
      console.log('[NSS] Keyring auto-locked after inactivity');
    }, AUTO_LOCK_MS);
  }

  // ── Public API ────────────────────────────────────────────────────

  return {
    initKeyring,
    // Lock / Unlock
    unlock,
    lock,
    isUnlocked,
    // Identity
    saveIdentity,
    getIdentity,
    getPrivateKey,
    changePassphrase,
    // Contacts
    addContact,
    getContact,
    getAllContacts,
    removeContact,
    // Import / Export
    exportKeyring,
    importKeyring,
    // Auto-lock
    _resetLockTimer,
    // Session persistence (Chrome MV3)
    tryRestoreSession,
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.NSSKeyring = NSSKeyring;
}
