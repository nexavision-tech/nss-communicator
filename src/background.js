/**
 * NSS Communicator — Background Script
 * Handles message passing from content scripts, keyring management,
 * key import/export, and encryption/decryption operations.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

(async function NSSBackground() {
  'use strict';

  // ── Initialize Keyring ─────────────────────────────────────────────

  await NSSKeyring.initKeyring();
  console.log('[NSS] Background initialized — keyring ready');

  // ── Message Handler ────────────────────────────────────────────────

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // All handlers are async — return true to keep message channel open
    handleMessage(message, sender).then(sendResponse);
    return true;
  });

  async function handleMessage(message, sender) {
    switch (message.type) {
      case 'nss-decrypt':
        return handleDecrypt(message);

      case 'nss-encrypt':
        return handleEncrypt(message);

      case 'nss-get-identity':
        return handleGetIdentity();

      case 'nss-generate-keys':
        return handleGenerateKeys(message);

      case 'nss-unlock':
        return handleUnlock(message);

      case 'nss-lock':
        return handleLock();

      case 'nss-change-passphrase':
        return handleChangePassphrase(message);

      case 'nss-get-contacts':
        return handleGetContacts();

      case 'nss-import-key':
        return handleImportKey(message);

      case 'nss-remove-contact':
        return handleRemoveContact(message);

      case 'nss-export-own-key':
        return handleExportOwnKey();

      case 'nss-export-keyring':
        return handleExportKeyring();

      case 'nss-import-keyring':
        return handleImportKeyring(message);

      case 'nss-open-composer':
        return handleOpenComposer(sender);

      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }

  // ── Unlock / Lock / Change Passphrase ─────────────────────────────

  async function handleUnlock(message) {
    try {
      await NSSKeyring.unlock(message.passphrase);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function handleLock() {
    NSSKeyring.lock();
    return { success: true };
  }

  async function handleChangePassphrase(message) {
    try {
      // If keyring is not unlocked, try to unlock with the current passphrase
      if (!NSSKeyring.isUnlocked()) {
        await NSSKeyring.unlock(message.currentPassphrase);
      }
      await NSSKeyring.changePassphrase(message.newPassphrase);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Decrypt ────────────────────────────────────────────────────────

  async function handleDecrypt(message) {
    try {
      // Check if keyring is unlocked
      if (!NSSKeyring.isUnlocked()) {
        return { success: false, error: 'locked' };
      }

      const identity = await NSSKeyring.getIdentity();
      if (!identity) {
        return { success: false, error: 'no-identity' };
      }

      // Get decrypted private key and import it
      const privateKeyStr = await NSSKeyring.getPrivateKey();
      const privateKeys = await NSSKeys.importPrivateKey(privateKeyStr);

      // Parse header to get sender fingerprint
      const header = NSSEncrypt.parseHeader(message.nssString);
      if (!header) {
        return { success: false, error: 'Invalid NSS format' };
      }

      // Look up sender's public key
      const contact = await NSSKeyring.getContact(header.senderFingerprint);
      let senderPublicKeys = null;
      let senderName = null;

      if (contact) {
        senderPublicKeys = await NSSKeys.importPublicKey(contact.publicKey);
        senderName = contact.name;
      } else if (header.senderFingerprint === identity.fingerprint) {
        // Message from self
        senderPublicKeys = await NSSKeys.importPublicKey(identity.publicKey);
        senderName = 'You';
      }

      // Channel 0 doesn't need private key for "decryption" but we still verify
      if (header.channel !== 0 && !contact && header.senderFingerprint !== identity.fingerprint) {
        // We can still try to decrypt (we have the private key), just can't verify
      }

      try {
        const result = await NSSEncrypt.decryptMessage(
          message.nssString,
          privateKeys,
          senderPublicKeys
        );

        return {
          success: true,
          data: {
            plaintext: result.plaintext,
            channel: result.channel,
            senderFingerprint: result.senderFingerprint,
            senderName: senderName,
            verified: result.verified,
          },
        };
      } catch (decryptErr) {
        // If we can't decrypt, it might be for someone else or sender is unknown
        if (!contact && header.senderFingerprint !== identity.fingerprint) {
          return {
            success: false,
            error: 'unknown-sender',
            senderFingerprint: header.senderFingerprint,
          };
        }
        return { success: false, error: decryptErr.message };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Encrypt ────────────────────────────────────────────────────────

  async function handleEncrypt(message) {
    try {
      // Check if keyring is unlocked
      if (!NSSKeyring.isUnlocked()) {
        return { success: false, error: 'locked' };
      }

      const identity = await NSSKeyring.getIdentity();
      if (!identity) {
        return { success: false, error: 'No identity — generate keys first' };
      }

      // Get decrypted private key and import it
      const privateKeyStr = await NSSKeyring.getPrivateKey();
      const senderPrivateKeys = await NSSKeys.importPrivateKey(privateKeyStr);
      const senderPublicKeys = await NSSKeys.importPublicKey(identity.publicKey);

      let recipientPublicKeys;

      if (message.channel === 0) {
        // Channel 0: sign-only, no recipient needed — use own key as placeholder
        recipientPublicKeys = senderPublicKeys;
      } else {
        // Look up recipient
        const contact = await NSSKeyring.getContact(message.recipientFingerprint);
        if (!contact) {
          return { success: false, error: 'Recipient not found in keyring' };
        }
        recipientPublicKeys = await NSSKeys.importPublicKey(contact.publicKey);
      }

      const nssString = await NSSEncrypt.encryptMessage(
        message.message,
        recipientPublicKeys,
        senderPrivateKeys,
        senderPublicKeys,
        message.channel
      );

      return { success: true, nssString };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Identity ───────────────────────────────────────────────────────

  async function handleGetIdentity() {
    try {
      const identity = await NSSKeyring.getIdentity();
      if (!identity) {
        return { success: true, identity: null };
      }
      return {
        success: true,
        identity: {
          fingerprint: identity.fingerprint,
          email: identity.email,
          createdAt: identity.createdAt,
          locked: identity.locked,
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function handleGenerateKeys(message) {
    try {
      const keypair = await NSSKeys.generateKeyPair();
      await NSSKeyring.saveIdentity(keypair, message.passphrase, message.email || '');

      const identity = await NSSKeyring.getIdentity();
      return {
        success: true,
        identity: {
          fingerprint: identity.fingerprint,
          email: identity.email,
          createdAt: identity.createdAt,
        },
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Contacts ───────────────────────────────────────────────────────

  async function handleGetContacts() {
    try {
      const contacts = await NSSKeyring.getAllContacts();
      return { success: true, contacts };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function handleImportKey(message) {
    try {
      const publicKeys = await NSSKeys.importPublicKey(message.keyData);
      const fingerprint = await NSSKeys.getFingerprint(publicKeys);

      await NSSKeyring.addContact(
        message.name || 'Unknown',
        message.email || '',
        message.keyData,
        fingerprint
      );

      return { success: true, fingerprint };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function handleRemoveContact(message) {
    try {
      await NSSKeyring.removeContact(message.fingerprint);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Key Export ─────────────────────────────────────────────────────

  async function handleExportOwnKey() {
    try {
      const identity = await NSSKeyring.getIdentity();
      if (!identity) {
        return { success: false, error: 'No identity to export' };
      }
      return { success: true, publicKey: identity.publicKey, fingerprint: identity.fingerprint };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function handleExportKeyring() {
    try {
      const json = await NSSKeyring.exportKeyring();
      return { success: true, data: json };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function handleImportKeyring(message) {
    try {
      const result = await NSSKeyring.importKeyring(message.data);
      return { success: true, imported: result.imported, skipped: result.skipped };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Composer ───────────────────────────────────────────────────────

  async function handleOpenComposer(sender) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        await browser.tabs.executeScript(tabs[0].id, {
          file: 'content/composer.js',
        });
        return { success: true };
      }
      return { success: false, error: 'No active tab' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
})();
