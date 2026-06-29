/**
 * NSS Communicator — Popup Logic
 * Initializes UI from keyring, handles key generation, import/export,
 * and contact management.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

(function NSSPopup() {
  'use strict';

  // ── Elements ───────────────────────────────────────────────────────

  const noIdentityEl = document.getElementById('no-identity');
  const hasIdentityEl = document.getElementById('has-identity');
  const fingerprintEl = document.getElementById('identity-fingerprint');
  const emailEl = document.getElementById('identity-email');
  const generateBtn = document.getElementById('generate-btn');
  const generateEmailInput = document.getElementById('generate-email');
  const exportOwnKeyBtn = document.getElementById('export-own-key-btn');
  const composeBtn = document.getElementById('compose-btn');
  const contactListEl = document.getElementById('contact-list');
  const contactCountEl = document.getElementById('contact-count');
  const importKeyBtn = document.getElementById('import-key-btn');
  const importKeyFile = document.getElementById('import-key-file');
  const exportKeyringBtn = document.getElementById('export-keyring-btn');
  const importKeyringBtn = document.getElementById('import-keyring-btn');
  const importKeyringFile = document.getElementById('import-keyring-file');

  // ── Initialize ─────────────────────────────────────────────────────

  async function init() {
    await loadIdentity();
    await loadContacts();
  }

  // ── Identity ───────────────────────────────────────────────────────

  async function loadIdentity() {
    const response = await browser.runtime.sendMessage({ type: 'nss-get-identity' });

    if (response.success && response.identity) {
      noIdentityEl.style.display = 'none';
      hasIdentityEl.style.display = 'block';
      fingerprintEl.textContent = response.identity.fingerprint;
      emailEl.textContent = response.identity.email || '—';
      composeBtn.disabled = false;
    } else {
      noIdentityEl.style.display = 'block';
      hasIdentityEl.style.display = 'none';
      composeBtn.disabled = true;
    }
  }

  generateBtn.addEventListener('click', async () => {
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating RSA-4096…';

    const response = await browser.runtime.sendMessage({
      type: 'nss-generate-keys',
      email: generateEmailInput.value.trim(),
    });

    if (response.success) {
      showToast('✓ Identity created!', 'success');
      await loadIdentity();
    } else {
      showToast('✗ ' + response.error, 'error');
    }

    generateBtn.disabled = false;
    generateBtn.textContent = '🔑 Generate Keys';
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
        if (confirm(`Remove contact ${fp}?`)) {
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
    importKeyFile.click();
  });

  importKeyFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const name = prompt('Name for this contact:', file.name.replace(/\.nss$/, ''));
    if (!name) return;

    const email = prompt('Email (optional):', '') || '';

    const response = await browser.runtime.sendMessage({
      type: 'nss-import-key',
      keyData: text,
      name,
      email,
    });

    if (response.success) {
      showToast(`✓ Imported key: ${response.fingerprint}`, 'success');
      await loadContacts();
    } else {
      showToast('✗ ' + response.error, 'error');
    }

    importKeyFile.value = '';
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
    importKeyringFile.click();
  });

  importKeyringFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();

    const response = await browser.runtime.sendMessage({
      type: 'nss-import-keyring',
      data: text,
    });

    if (response.success) {
      showToast(`✓ Imported ${response.imported}, skipped ${response.skipped}`, 'success');
      await loadContacts();
    } else {
      showToast('✗ ' + response.error, 'error');
    }

    importKeyringFile.value = '';
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

  // ── Boot ───────────────────────────────────────────────────────────

  init();
})();
