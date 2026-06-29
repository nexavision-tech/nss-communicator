/**
 * NSS Communicator — Popup Logic
 * Initializes UI from keyring, handles key generation, import/export,
 * contact management, and passphrase lock/unlock.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

(function NSSPopup() {
  'use strict';

  // ── Elements ───────────────────────────────────────────────────────

  const noIdentityEl = document.getElementById('no-identity');
  const hasIdentityEl = document.getElementById('has-identity');
  const lockScreenEl = document.getElementById('lock-screen');
  const fingerprintEl = document.getElementById('identity-fingerprint');
  const emailEl = document.getElementById('identity-email');
  const lockFingerprintEl = document.getElementById('lock-fingerprint');
  const generateBtn = document.getElementById('generate-btn');
  const generateEmailInput = document.getElementById('generate-email');
  const generatePassphraseInput = document.getElementById('generate-passphrase');
  const generatePassphraseConfirm = document.getElementById('generate-passphrase-confirm');
  const exportOwnKeyBtn = document.getElementById('export-own-key-btn');
  const lockBtn = document.getElementById('lock-btn');
  const unlockBtn = document.getElementById('unlock-btn');
  const unlockPassphraseInput = document.getElementById('unlock-passphrase');
  const composeBtn = document.getElementById('compose-btn');
  const contactListEl = document.getElementById('contact-list');
  const contactCountEl = document.getElementById('contact-count');
  const importKeyBtn = document.getElementById('import-key-btn');
  const importKeyFile = document.getElementById('import-key-file');
  const exportKeyringBtn = document.getElementById('export-keyring-btn');
  const importKeyringBtn = document.getElementById('import-keyring-btn');
  const importKeyringFile = document.getElementById('import-keyring-file');
  const changePassphraseBtn = document.getElementById('change-passphrase-btn');

  // ── Initialize ─────────────────────────────────────────────────────

  async function init() {
    await loadIdentity();
    await loadContacts();
  }

  // ── View State ─────────────────────────────────────────────────────

  function showView(view) {
    noIdentityEl.style.display = 'none';
    hasIdentityEl.style.display = 'none';
    lockScreenEl.style.display = 'none';

    // Hide the rest of the popup when locked or no identity
    const identitySection = document.getElementById('identity-section');
    const sections = document.querySelectorAll('.nss-section:not(#identity-section):not(#lock-screen)');

    if (view === 'no-identity') {
      noIdentityEl.style.display = 'block';
      identitySection.style.display = '';
      sections.forEach((s) => (s.style.display = 'none'));
      composeBtn.disabled = true;
    } else if (view === 'locked') {
      lockScreenEl.style.display = '';
      identitySection.style.display = 'none';
      sections.forEach((s) => (s.style.display = 'none'));
      composeBtn.disabled = true;
    } else if (view === 'unlocked') {
      hasIdentityEl.style.display = 'block';
      identitySection.style.display = '';
      sections.forEach((s) => (s.style.display = ''));
      composeBtn.disabled = false;
    }
  }

  // ── Identity ───────────────────────────────────────────────────────

  async function loadIdentity() {
    const response = await browser.runtime.sendMessage({ type: 'nss-get-identity' });

    if (response.success && response.identity) {
      if (response.identity.locked) {
        // Identity exists but keyring is locked
        lockFingerprintEl.textContent = response.identity.fingerprint;
        showView('locked');
      } else {
        // Identity exists and keyring is unlocked
        fingerprintEl.textContent = response.identity.fingerprint;
        emailEl.textContent = response.identity.email || '—';
        showView('unlocked');
      }
    } else {
      showView('no-identity');
    }
  }

  // ── Generate Keys ──────────────────────────────────────────────────

  generateBtn.addEventListener('click', async () => {
    const passphrase = generatePassphraseInput.value;
    const confirm = generatePassphraseConfirm.value;

    // Validate passphrase
    if (!passphrase || passphrase.length < 8) {
      showToast('✗ Passphrase must be at least 8 characters', 'error');
      return;
    }

    if (passphrase !== confirm) {
      showToast('✗ Passphrases do not match', 'error');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating RSA-4096…';

    const response = await browser.runtime.sendMessage({
      type: 'nss-generate-keys',
      email: generateEmailInput.value.trim(),
      passphrase,
    });

    if (response.success) {
      showToast('✓ Identity created!', 'success');
      // Clear passphrase fields
      generatePassphraseInput.value = '';
      generatePassphraseConfirm.value = '';
      await loadIdentity();
    } else {
      showToast('✗ ' + response.error, 'error');
    }

    generateBtn.disabled = false;
    generateBtn.textContent = '🔑 Generate Keys';
  });

  // ── Unlock ─────────────────────────────────────────────────────────

  unlockBtn.addEventListener('click', async () => {
    const passphrase = unlockPassphraseInput.value;

    if (!passphrase) {
      showToast('✗ Enter your passphrase', 'error');
      return;
    }

    unlockBtn.disabled = true;
    unlockBtn.textContent = '⏳ Unlocking…';

    const response = await browser.runtime.sendMessage({
      type: 'nss-unlock',
      passphrase,
    });

    if (response.success) {
      unlockPassphraseInput.value = '';
      showToast('✓ Keyring unlocked', 'success');
      await loadIdentity();
      await loadContacts();
    } else {
      showToast('✗ ' + response.error, 'error');
    }

    unlockBtn.disabled = false;
    unlockBtn.textContent = '🔓 Unlock';
  });

  // Allow Enter key to unlock
  unlockPassphraseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockBtn.click();
  });

  // ── Lock ───────────────────────────────────────────────────────────

  lockBtn.addEventListener('click', async () => {
    await browser.runtime.sendMessage({ type: 'nss-lock' });
    showToast('🔒 Keyring locked', 'success');
    await loadIdentity();
  });

  // ── Change Passphrase ──────────────────────────────────────────────

  changePassphraseBtn.addEventListener('click', async () => {
    const result = await nssPrompt('Change Passphrase', [
      { id: 'cp-current', label: 'Current Passphrase', type: 'password' },
      { id: 'cp-new', label: 'New Passphrase (min 8 chars)', type: 'password' },
      { id: 'cp-confirm', label: 'Confirm New Passphrase', type: 'password' }
    ]);
    
    if (!result) return;
    
    const currentPassphrase = result['cp-current'];
    const newPassphrase = result['cp-new'];
    const confirmNew = result['cp-confirm'];

    if (!currentPassphrase) return;

    if (!newPassphrase || newPassphrase.length < 8) {
      showToast('✗ New passphrase must be at least 8 characters', 'error');
      return;
    }

    if (newPassphrase !== confirmNew) {
      showToast('✗ Passphrases do not match', 'error');
      return;
    }

    const response = await browser.runtime.sendMessage({
      type: 'nss-change-passphrase',
      currentPassphrase,
      newPassphrase,
    });

    if (response.success) {
      showToast('✓ Passphrase changed', 'success');
    } else {
      showToast('✗ ' + response.error, 'error');
    }
  });

  // ── Export Own Key ─────────────────────────────────────────────────

  exportOwnKeyBtn.addEventListener('click', async () => {
    const response = await browser.runtime.sendMessage({ type: 'nss-export-own-key' });

    if (response.success) {
      downloadFile(
        response.publicKey,
        `nss-${response.fingerprint}.nss`,
        'text/plain'
      );
      showToast('✓ Public key exported', 'success');
    } else {
      showToast('✗ ' + response.error, 'error');
    }
  });

  // ── Compose ────────────────────────────────────────────────────────

  composeBtn.addEventListener('click', async () => {
    // Check if unlocked first
    const idResp = await browser.runtime.sendMessage({ type: 'nss-get-identity' });
    if (idResp.success && idResp.identity && idResp.identity.locked) {
      showToast('✗ Keyring is locked — unlock first', 'error');
      return;
    }

    const response = await browser.runtime.sendMessage({ type: 'nss-open-composer' });

    if (response.success) {
      window.close(); // Close popup after injecting composer
    } else {
      showToast('✗ ' + response.error, 'error');
    }
  });

  // ── Contacts ───────────────────────────────────────────────────────

  async function loadContacts() {
    const response = await browser.runtime.sendMessage({ type: 'nss-get-contacts' });

    if (!response.success || !response.contacts || response.contacts.length === 0) {
      contactListEl.innerHTML = '<p class="nss-muted nss-empty-state">No contacts yet</p>';
      contactCountEl.textContent = '0';
      return;
    }

    const contacts = response.contacts;
    contactCountEl.textContent = contacts.length.toString();
    contactListEl.innerHTML = '';

    for (const contact of contacts) {
      const item = document.createElement('div');
      item.className = 'nss-contact-item';
      item.innerHTML = `
        <div class="nss-contact-info">
          <span class="nss-contact-name">${escapeHtml(contact.name)}</span>
          <code class="nss-contact-fp">${escapeHtml(contact.fingerprint)}</code>
        </div>
        <button class="nss-btn-icon nss-contact-remove" data-fp="${escapeHtml(contact.fingerprint)}" title="Remove contact">
          ✕
        </button>
      `;
      contactListEl.appendChild(item);
    }

    // Attach remove handlers
    contactListEl.querySelectorAll('.nss-contact-remove').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const fp = e.target.getAttribute('data-fp');
        const confirmed = await nssConfirm('Remove Contact', `Are you sure you want to remove contact ${fp}?`);
        if (confirmed) {
          const resp = await browser.runtime.sendMessage({
            type: 'nss-remove-contact',
            fingerprint: fp,
          });
          if (resp.success) {
            showToast('Contact removed', 'success');
            await loadContacts();
          }
        }
      });
    });
  }

  // ── Import .nss Key ────────────────────────────────────────────────

  importKeyBtn.addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('popup/import.html') });
  });

  // ── Keyring Import/Export ──────────────────────────────────────────

  exportKeyringBtn.addEventListener('click', async () => {
    const response = await browser.runtime.sendMessage({ type: 'nss-export-keyring' });

    if (response.success) {
      downloadFile(response.data, 'nss-keyring.json', 'application/json');
      showToast('✓ Keyring exported', 'success');
    } else {
      showToast('✗ ' + response.error, 'error');
    }
  });

  importKeyringBtn.addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('popup/import.html#keyring') });
  });

  // ── Utilities ──────────────────────────────────────────────────────

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showToast(message, type = '') {
    const toast = document.getElementById('nss-toast');
    const text = document.getElementById('nss-toast-text');

    text.textContent = message;
    toast.className = `nss-toast ${type}`;
    toast.style.display = 'block';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Custom Modals ──────────────────────────────────────────────────

  function showModal(title, bodyHtml, onConfirm) {
    const modal = document.getElementById('nss-modal');
    document.getElementById('nss-modal-title').textContent = title;
    document.getElementById('nss-modal-body').innerHTML = bodyHtml;
    
    modal.style.display = 'flex';
    
    return new Promise((resolve) => {
      const confirmBtn = document.getElementById('nss-modal-confirm');
      const cancelBtn = document.getElementById('nss-modal-cancel');
      
      const cleanup = () => {
        modal.style.display = 'none';
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
      };
      
      confirmBtn.onclick = () => {
        cleanup();
        onConfirm(resolve);
      };
      
      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };
    });
  }

  function nssPrompt(title, fields) {
    let html = '';
    fields.forEach(f => {
      html += `
        <div class="nss-field">
          <label for="${f.id}">${escapeHtml(f.label)}</label>
          <input type="${f.type || 'text'}" id="${f.id}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value || '')}">
        </div>
      `;
    });
    
    return showModal(title, html, (resolve) => {
      const results = {};
      fields.forEach(f => {
        results[f.id] = document.getElementById(f.id).value;
      });
      resolve(results);
    });
  }

  function nssConfirm(title, message) {
    const html = `<p class="nss-muted">${escapeHtml(message)}</p>`;
    return showModal(title, html, (resolve) => {
      resolve(true);
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────

  init();
})();
