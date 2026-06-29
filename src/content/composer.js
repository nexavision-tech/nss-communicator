/**
 * NSS Communicator — Message Composer
 * Floating modal overlay for composing encrypted messages.
 * NOT a content script — loaded on demand via the popup or background script.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

(function NSSComposer() {
  'use strict';

  const COMPOSER_ID = 'nss-composer-overlay';
  const FOOTER_TEXT = '\n\n🏹 To read this secure message, install NSS Communicator:\nhttps://github.com/nexavision-tech/nss-communicator';

  // Remove existing composer to always start fresh (reloads contacts)
  if (document.getElementById(COMPOSER_ID)) {
    document.getElementById(COMPOSER_ID).remove();
  }

  // ── Build Overlay ──────────────────────────────────────────────────

  const overlay = document.createElement('div');
  overlay.id = COMPOSER_ID;
  overlay.innerHTML = `
    <div class="nss-composer-backdrop"></div>
    <div class="nss-composer-modal">
      <div class="nss-composer-header">
        <h2>🔒 NSS Composer</h2>
        <button class="nss-composer-close" title="Close">&times;</button>
      </div>

      <div class="nss-composer-body">
        <div class="nss-composer-field">
          <label for="nss-recipient-select">Recipient</label>
          <select id="nss-recipient-select">
            <option value="PUBLIC" selected>🌎 Public (Anyone can read)</option>
            <option disabled>──────────</option>
          </select>
        </div>

        <div class="nss-composer-field">
          <label for="nss-message-input">Message</label>
          <textarea id="nss-message-input" rows="5" placeholder="Type your message…"></textarea>
        </div>

        <div class="nss-composer-actions">
          <button id="nss-encrypt-btn" class="nss-btn-primary">📡 Sign & Copy</button>
          <span id="nss-composer-status" class="nss-composer-status"></span>
        </div>

        <div class="nss-composer-field nss-output-field" style="display:none; margin-top:16px;">
          <label>Encrypted Output</label>
          <textarea id="nss-output" rows="3" readonly></textarea>
        </div>
      </div>

      <div class="nss-composer-footer">
        <span>NSS Communicator v0.1.0</span>
        <a href="https://nexavision.tech" target="_blank" rel="noopener">nexavision.tech</a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ── Elements ───────────────────────────────────────────────────────

  const recipientSelect = document.getElementById('nss-recipient-select');
  const messageInput = document.getElementById('nss-message-input');
  const encryptBtn = document.getElementById('nss-encrypt-btn');
  const statusEl = document.getElementById('nss-composer-status');
  const outputField = overlay.querySelector('.nss-output-field');
  const outputTextarea = document.getElementById('nss-output');
  const closeBtn = overlay.querySelector('.nss-composer-close');
  const backdrop = overlay.querySelector('.nss-composer-backdrop');

  // ── Load Contacts ──────────────────────────────────────────────────

  async function loadContacts() {
    try {
      const response = await browser.runtime.sendMessage({ type: 'nss-get-contacts' });

      // Keep the Public option and divider
      recipientSelect.innerHTML = `
        <option value="PUBLIC" selected>🌎 Public (Anyone can read)</option>
        <option disabled>──────────</option>
      `;

      if (response && response.contacts && response.contacts.length > 0) {
        for (const contact of response.contacts) {
          const opt = document.createElement('option');
          opt.value = contact.fingerprint;
          opt.textContent = `👤 ${contact.name} (${contact.fingerprint})`;
          recipientSelect.appendChild(opt);
        }
      }
    } catch (err) {
      console.error('[NSS] Failed to load contacts', err);
    }
  }

  loadContacts();

  // ── Recipient Change Handler ───────────────────────────────────────

  recipientSelect.addEventListener('change', () => {
    if (recipientSelect.value === 'PUBLIC') {
      encryptBtn.textContent = '📡 Sign & Copy';
    } else {
      encryptBtn.textContent = '🔐 Encrypt & Copy';
    }
  });

  // ── Encrypt & Copy ─────────────────────────────────────────────────

  encryptBtn.addEventListener('click', async () => {
    const isPublic = recipientSelect.value === 'PUBLIC';
    const channel = isPublic ? 0 : 1;
    const recipientFp = isPublic ? null : recipientSelect.value;
    const message = messageInput.value.trim();

    if (!message) {
      setStatus('Type a message first', 'error');
      return;
    }

    encryptBtn.disabled = true;
    setStatus('Encrypting…', '');

    try {
      const response = await browser.runtime.sendMessage({
        type: 'nss-encrypt',
        message,
        recipientFingerprint: recipientFp,
        channel,
      });

      if (response && response.success) {
        const fullText = response.nssString + FOOTER_TEXT;

        // Copy to clipboard
        await navigator.clipboard.writeText(fullText);

        // Show output
        outputField.style.display = 'block';
        outputTextarea.value = response.nssString;

        setStatus('✓ Copied to clipboard!', 'success');
      } else {
        setStatus(response ? response.error : 'Encryption failed', 'error');
      }
    } catch (err) {
      setStatus(err.message, 'error');
    }

    encryptBtn.disabled = false;
  });

  // ── UI Helpers ─────────────────────────────────────────────────────

  function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'nss-composer-status' + (type ? ` ${type}` : '');
  }

  // Close handlers
  function closeComposer() {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  closeBtn.addEventListener('click', closeComposer);
  backdrop.addEventListener('click', closeComposer);

  // Use a named function for the escape listener so we don't leak listeners
  function handleEscape(e) {
    if (e.key === 'Escape' && document.getElementById(COMPOSER_ID)) {
      closeComposer();
      document.removeEventListener('keydown', handleEscape);
    }
  }
  document.addEventListener('keydown', handleEscape);

  // Focus the message input
  messageInput.focus();

  console.log('[NSS] Composer loaded');
})();
