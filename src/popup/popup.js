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
  const decryptBtn = document.getElementById('decrypt-btn');
  const contactListEl = document.getElementById('contact-list');
  const contactCountEl = document.getElementById('contact-count');
  const exportKeyringBtn = document.getElementById('export-keyring-btn');
  const importKeyringBtn = document.getElementById('import-keyring-btn');
  const changePassphraseBtn = document.getElementById('change-passphrase-btn');
  const mainView = document.getElementById('main-view');
  const composerView = document.getElementById('composer-view');
  const backToMainBtn = document.getElementById('back-to-main-btn');
  const recipientSelect = document.getElementById('nss-recipient-select');
  const messageInput = document.getElementById('nss-message-input');
  const encryptBtn = document.getElementById('nss-encrypt-btn');
  const outputStatusContainer = document.getElementById('nss-composer-status-container');
  const outputTextarea = document.getElementById('nss-output');
  
  const FOOTER_TEXT = '\n\n🏹 To read this secure message, install NSS Communicator:\nhttps://github.com/nexavision-tech/nss-communicator';

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
      decryptBtn.disabled = true;
    } else if (view === 'locked') {
      lockScreenEl.style.display = '';
      identitySection.style.display = 'none';
      sections.forEach((s) => (s.style.display = 'none'));
      composeBtn.disabled = true;
      decryptBtn.disabled = true;
    } else if (view === 'unlocked') {
      hasIdentityEl.style.display = 'block';
      identitySection.style.display = '';
      sections.forEach((s) => (s.style.display = ''));
      composeBtn.disabled = false;
      decryptBtn.disabled = false;
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

    // Populate contacts
    const response = await browser.runtime.sendMessage({ type: 'nss-get-contacts' });
    recipientSelect.innerHTML = `
      <option value="PUBLIC" selected>🌎 Public (Anyone can read)</option>
      <option disabled>──────────</option>
    `;
    if (response.success && response.contacts) {
      for (const contact of response.contacts) {
        const opt = document.createElement('option');
        opt.value = contact.fingerprint;
        opt.textContent = `👤 ${contact.name} (${contact.fingerprint})`;
        recipientSelect.appendChild(opt);
      }
    }

    // Reset fields
    messageInput.value = '';
    outputStatusContainer.style.display = 'none';
    outputTextarea.value = '';
    encryptBtn.textContent = '📡 Sign & Copy';
    
    // Switch views
    mainView.style.display = 'none';
    composerView.style.display = 'block';
    messageInput.focus();
  });

  backToMainBtn.addEventListener('click', () => {
    composerView.style.display = 'none';
    mainView.style.display = 'block';
  });

  recipientSelect.addEventListener('change', () => {
    if (recipientSelect.value === 'PUBLIC') {
      encryptBtn.textContent = '📡 Sign & Copy';
    } else {
      encryptBtn.textContent = '🔐 Encrypt & Copy';
    }
  });

  encryptBtn.addEventListener('click', async () => {
    const isPublic = recipientSelect.value === 'PUBLIC';
    const channel = isPublic ? 0 : 1;
    const recipientFp = isPublic ? null : recipientSelect.value;
    const message = messageInput.value.trim();

    if (!message) {
      showToast('✗ Type a message first', 'error');
      return;
    }

    encryptBtn.disabled = true;
    encryptBtn.textContent = '⏳ Encrypting…';

    try {
      const response = await browser.runtime.sendMessage({
        type: 'nss-encrypt',
        message,
        recipientFingerprint: recipientFp,
        channel,
      });

      if (response && response.success) {
        const fullText = response.nssString + FOOTER_TEXT;
        await navigator.clipboard.writeText(fullText);
        
        outputStatusContainer.style.display = 'block';
        outputTextarea.value = response.nssString;
        showToast('✓ Copied to clipboard!', 'success');
      } else {
        showToast('✗ ' + (response ? response.error : 'Encryption failed'), 'error');
      }
    } catch (err) {
      showToast('✗ ' + err.message, 'error');
    }

    encryptBtn.disabled = false;
    encryptBtn.textContent = isPublic ? '📡 Sign & Copy' : '🔐 Encrypt & Copy';
  });

  // ── Decrypt ────────────────────────────────────────────────────────

  decryptBtn.addEventListener('click', async () => {
    const idResp = await browser.runtime.sendMessage({ type: 'nss-get-identity' });
    if (idResp.success && idResp.identity && idResp.identity.locked) {
      showToast('✗ Keyring is locked — unlock first', 'error');
      return;
    }

    const result = await nssPrompt('Decrypt Message', [
      { id: 'decrypt-input', label: 'Paste NSS encrypted text', type: 'textarea', placeholder: '>>--\nNSS:v1:...' }
    ]);
    
    if (!result || !result['decrypt-input']) return;

    try {
      const response = await browser.runtime.sendMessage({
        type: 'nss-decrypt',
        nssString: result['decrypt-input'].trim()
      });

      if (response.success) {
        // Show the decrypted message in another modal
        const senderInfo = response.data.senderName !== 'Unknown' 
          ? `From: ${escapeHtml(response.data.senderName)} (${escapeHtml(response.data.senderFingerprint)})` 
          : `From Unknown Fingerprint: ${escapeHtml(response.data.senderFingerprint)}`;
          
        const verifiedIcon = response.data.verified ? '✅ Verified Signature' : '⚠️ Unverified';
        
        await showModal('🔓 Decrypted Message', `
          <div style="margin-bottom: 12px; font-size: 12px; color: #b0b0b0;">
            <div>${senderInfo}</div>
            <div style="color: ${response.data.verified ? '#00ff88' : '#ffaa00'};">${verifiedIcon}</div>
          </div>
          <textarea readonly style="width: 100%; height: 120px; padding: 8px; border-radius: 6px; background: #111827; border: 1px solid #00ff88; color: #e0e0e0; resize: vertical; font-family: inherit;">${escapeHtml(response.data.plaintext)}</textarea>
        `, (resolve) => resolve());
      } else {
        showToast('✗ ' + response.error, 'error');
      }
    } catch (err) {
      showToast('✗ ' + err.message, 'error');
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

  const importKeyBtn = document.getElementById('import-key-btn');
  importKeyBtn.addEventListener('click', async () => {
    const result = await nssPrompt('Import Contact Key', [
      { id: 'import-name', label: 'Contact Name', placeholder: 'e.g. Alice' },
      { id: 'import-key', label: 'Paste .nss file contents below', type: 'textarea', placeholder: '-----BEGIN NSS PUBLIC KEY-----\n...\n-----END NSS PUBLIC KEY-----' }
    ]);

    if (!result || !result['import-key']) return;
    const name = result['import-name'] ? result['import-name'].trim() : 'Unknown Contact';
    await handleImportContactSubmit(name, result['import-key']);
  });

  async function handleImportContactSubmit(name, keyData) {
    console.log('[NSS] Import contact:', name, 'keyData length:', keyData ? keyData.length : 0);
    try {
      const response = await browser.runtime.sendMessage({
        type: 'nss-import-key',
        name: name.trim(),
        email: '',
        keyData: keyData.trim()
      });

      console.log('[NSS] Import response:', response);

      if (response.success) {
        showToast('✓ Contact imported: ' + name, 'success');
        await loadContacts();
      } else {
        showToast('✗ ' + response.error, 'error');
      }
    } catch (err) {
      console.error('[NSS] Import error:', err);
      showToast('✗ ' + err.message, 'error');
    }
  }

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
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', async () => {
      try {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const data = await fileInput.files[0].text();
        await handleImportKeyringSubmit(data);
      } catch (err) {
        console.error('[NSS] Keyring file read error:', err);
        showToast('✗ Could not read file: ' + err.message, 'error');
      } finally {
        document.body.removeChild(fileInput);
      }
    });

    fileInput.click();
  });

  async function handleImportKeyringSubmit(data) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'nss-import-keyring',
        data: data.trim()
      });

      if (response.success) {
        showToast(`✓ Imported: ${response.imported} keys (Skipped: ${response.skipped})`, 'success');
        await loadIdentity();
        await loadContacts();
      } else {
        showToast('✗ ' + response.error, 'error');
      }
    } catch (err) {
      showToast('✗ ' + err.message, 'error');
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────

  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    const file = e.dataTransfer.files[0];
    const text = await file.text();
    console.log('[NSS] Drop:', file.name, 'length:', text.length);

    if (file.name.endsWith('.json')) {
      // Keyring import — just do it directly
      await handleImportKeyringSubmit(text);
    } else {
      // Contact key import — ask for name only
      let suggestedName = file.name.replace(/\.(nss|txt|pem)$/i, '');
      if (suggestedName.startsWith('nss-')) {
        suggestedName = 'Contact ' + suggestedName.substring(4, 12);
      }

      const result = await nssPrompt('Import Contact', [
        { id: 'import-name', label: 'Contact Name', placeholder: 'e.g. Alice', value: suggestedName }
      ]);
      if (result) {
        const name = result['import-name'] ? result['import-name'].trim() : 'Unknown Contact';
        await handleImportContactSubmit(name, text);
      }
    }
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
      
      confirmBtn.onclick = async () => {
        try {
          // Run onConfirm BEFORE cleanup so file inputs are still readable
          await onConfirm(resolve);
        } catch (err) {
          console.error('[NSS] Modal confirm error:', err);
          resolve(null);
        }
        cleanup();
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
          ${f.type === 'textarea'
            ? `<textarea id="${f.id}" placeholder="${escapeHtml(f.placeholder || '')}" rows="4" style="width: 100%; padding: 8px; border-radius: 6px; background: #111827; border: 1px solid #1a2035; color: #e0e0e0; resize: vertical; font-family: monospace; font-size: 11px; margin-top: 4px;">${escapeHtml(f.value || '')}</textarea>`
            : f.type === 'file'
            ? `<input type="file" id="${f.id}" accept="${escapeHtml(f.accept || '')}" style="width: 100%; padding: 8px; border-radius: 6px; background: #111827; border: 1px solid #1a2035; color: #e0e0e0; margin-top: 4px;">`
            : `<input type="${f.type || 'text'}" id="${f.id}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value || '')}" style="margin-top: 4px;">`
          }
        </div>
      `;
    });
    
    return showModal(title, html, async (resolve) => {
      const results = {};
      for (const f of fields) {
        const el = document.getElementById(f.id);
        if (f.type === 'file') {
          if (el.files && el.files.length > 0) {
            results[f.id] = await el.files[0].text();
          } else {
            results[f.id] = null;
          }
        } else {
          results[f.id] = el.value;
        }
      }
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
