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

  // ── Inject Styles ──────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    #nss-composer-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .nss-composer-backdrop {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
    }

    .nss-composer-modal {
      position: relative;
      background: #0a0e17;
      border: 1px solid #00ff8844;
      border-radius: 12px;
      width: 420px;
      max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 0 40px rgba(0, 255, 136, 0.15), 0 20px 60px rgba(0, 0, 0, 0.5);
      color: #e0e0e0;
    }

    .nss-composer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #1a2035;
    }

    .nss-composer-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #00ff88;
    }

    .nss-composer-close {
      background: none;
      border: none;
      color: #666;
      font-size: 22px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      transition: color 0.2s;
    }
    .nss-composer-close:hover { color: #ff4444; }

    .nss-composer-body {
      padding: 20px;
    }

    .nss-composer-field {
      margin-bottom: 16px;
    }

    .nss-composer-field label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #00ff88;
      margin-bottom: 6px;
    }

    .nss-composer-field select,
    .nss-composer-field textarea {
      width: 100%;
      background: #111827;
      border: 1px solid #1a2035;
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 14px;
      padding: 10px 12px;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }

    .nss-composer-field select:focus,
    .nss-composer-field textarea:focus {
      outline: none;
      border-color: #00ff88;
    }

    .nss-composer-field textarea {
      resize: vertical;
      min-height: 80px;
    }

    .nss-composer-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .nss-btn-primary {
      background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
      color: #0a0e17;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }
    .nss-btn-primary:hover { opacity: 0.9; }
    .nss-btn-primary:active { transform: scale(0.97); }
    .nss-btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .nss-composer-status {
      font-size: 13px;
      color: #888;
    }
    .nss-composer-status.success { color: #00ff88; }
    .nss-composer-status.error { color: #ff4444; }

    .nss-output-field textarea {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #00ff88;
      word-break: break-all;
    }

    .nss-composer-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      border-top: 1px solid #1a2035;
      font-size: 11px;
      color: #555;
    }

    .nss-composer-footer a {
      color: #00ff88;
      text-decoration: none;
    }
    .nss-composer-footer a:hover { text-decoration: underline; }
  `;

  document.head.appendChild(style);
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
