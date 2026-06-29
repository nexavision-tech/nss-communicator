/**
 * NSS Communicator — IndexedDB Key Storage (Keyring)
 * Manages identity keypairs and imported contact public keys.
 *
 * Stores:
 *   'identity' — User's own keypair (encrypt + sign key pairs)
 *   'contacts' — Imported public keys indexed by fingerprint
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const NSSKeyring = (() => {
  'use strict';

  const DB_NAME = 'nss-keyring';
  const DB_VERSION = 1;
  const STORE_IDENTITY = 'identity';
  const STORE_CONTACTS = 'contacts';

  let _db = null;

  /**
   * Open or create the IndexedDB keyring database.
   * @returns {Promise<IDBDatabase>}
   */
  function initKeyring() {
    return new Promise((resolve, reject) => {
      if (_db) {
        resolve(_db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Identity store — single record with key 'primary'
        if (!db.objectStoreNames.contains(STORE_IDENTITY)) {
          db.createObjectStore(STORE_IDENTITY, { keyPath: 'id' });
        }

        // Contacts store — indexed by fingerprint
        if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
          const contactStore = db.createObjectStore(STORE_CONTACTS, { keyPath: 'fingerprint' });
          contactStore.createIndex('name', 'name', { unique: false });
          contactStore.createIndex('email', 'email', { unique: false });
          contactStore.createIndex('addedAt', 'addedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        _db = event.target.result;
        resolve(_db);
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to open keyring: ${event.target.error}`));
      };
    });
  }

  /**
   * Helper: execute a transaction operation.
   * @param {string} storeName
   * @param {string} mode — 'readonly' or 'readwrite'
   * @param {function(IDBObjectStore): IDBRequest} operation
   * @returns {Promise<*>}
   */
  function _txn(storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      const db = _db;
      if (!db) {
        reject(new Error('Keyring not initialized. Call initKeyring() first.'));
        return;
      }

      const txn = db.transaction(storeName, mode);
      const store = txn.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Keyring operation failed: ${request.error}`));
    });
  }

  /**
   * Save the user's identity keypair.
   * Stores exported key strings so they survive IndexedDB serialization.
   *
   * @param {{encrypt: CryptoKeyPair, sign: CryptoKeyPair}} keypair — Raw CryptoKeyPair objects
   * @param {string} email — User's email (optional label)
   * @returns {Promise<void>}
   */
  async function saveIdentity(keypair, email = '') {
    const publicKeyStr = await NSSKeys.exportPublicKey(keypair);
    const privateKeyStr = await NSSKeys.exportPrivateKey(keypair);
    const publicKeys = {
      encrypt: keypair.encrypt.publicKey,
      sign: keypair.sign.publicKey,
    };
    const fingerprint = await NSSKeys.getFingerprint(publicKeys);

    const record = {
      id: 'primary',
      publicKey: publicKeyStr,
      privateKey: privateKeyStr,
      fingerprint,
      email,
      createdAt: new Date().toISOString(),
    };

    return _txn(STORE_IDENTITY, 'readwrite', (store) => store.put(record));
  }

  /**
   * Retrieve the user's identity.
   * Returns exported strings and fingerprint. Caller must import keys as needed.
   *
   * @returns {Promise<{publicKey: string, privateKey: string, fingerprint: string, email: string, createdAt: string}|null>}
   */
  async function getIdentity() {
    const result = await _txn(STORE_IDENTITY, 'readonly', (store) => store.get('primary'));
    return result || null;
  }

  /**
   * Add a trusted contact's public key.
   *
   * @param {string} name — Display name
   * @param {string} email — Contact email
   * @param {string} publicKeyStr — .nss format public key string
   * @param {string} fingerprint — 8-char hex fingerprint
   * @returns {Promise<void>}
   */
  async function addContact(name, email, publicKeyStr, fingerprint) {
    const record = {
      fingerprint,
      name,
      email,
      publicKey: publicKeyStr,
      addedAt: new Date().toISOString(),
      trusted: true,
    };

    return _txn(STORE_CONTACTS, 'readwrite', (store) => store.put(record));
  }

  /**
   * Look up a contact by fingerprint.
   * @param {string} fingerprint — 8-char hex fingerprint
   * @returns {Promise<{fingerprint: string, name: string, email: string, publicKey: string, addedAt: string, trusted: boolean}|null>}
   */
  async function getContact(fingerprint) {
    const result = await _txn(STORE_CONTACTS, 'readonly', (store) => store.get(fingerprint));
    return result || null;
  }

  /**
   * List all contacts.
   * @returns {Promise<Array>}
   */
  function getAllContacts() {
    return new Promise((resolve, reject) => {
      if (!_db) {
        reject(new Error('Keyring not initialized'));
        return;
      }

      const txn = _db.transaction(STORE_CONTACTS, 'readonly');
      const store = txn.objectStore(STORE_CONTACTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to list contacts: ${request.error}`));
    });
  }

  /**
   * Remove a contact by fingerprint.
   * @param {string} fingerprint
   * @returns {Promise<void>}
   */
  function removeContact(fingerprint) {
    return _txn(STORE_CONTACTS, 'readwrite', (store) => store.delete(fingerprint));
  }

  /**
   * Export all contacts as a JSON string for backup.
   * @returns {Promise<string>}
   */
  async function exportKeyring() {
    const contacts = await getAllContacts();
    const identity = await getIdentity();

    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      identity: identity
        ? { fingerprint: identity.fingerprint, email: identity.email, publicKey: identity.publicKey }
        : null,
      contacts,
    }, null, 2);
  }

  /**
   * Import contacts from a JSON string.
   * Does NOT overwrite existing contacts — merges by fingerprint.
   *
   * @param {string} json — JSON string from exportKeyring()
   * @returns {Promise<{imported: number, skipped: number}>}
   */
  async function importKeyring(json) {
    const data = JSON.parse(json);

    if (data.version !== 1) {
      throw new Error(`Unsupported keyring export version: ${data.version}`);
    }

    let imported = 0;
    let skipped = 0;

    for (const contact of (data.contacts || [])) {
      const existing = await getContact(contact.fingerprint);
      if (existing) {
        skipped++;
      } else {
        await addContact(contact.name, contact.email, contact.publicKey, contact.fingerprint);
        imported++;
      }
    }

    return { imported, skipped };
  }

  // ── Public API ─────────────────────────────────────────────────────

  return {
    initKeyring,
    saveIdentity,
    getIdentity,
    addContact,
    getContact,
    getAllContacts,
    removeContact,
    exportKeyring,
    importKeyring,
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.NSSKeyring = NSSKeyring;
}
