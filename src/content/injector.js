/**
 * NSS Communicator — Content Injector
 * Listens for detected NSS strings and replaces them with decrypted content.
 * Communicates with the background script for key access and decryption.
 *
 * Runs as IIFE content script, paired with detector.js.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

(function NSSInjector() {
  'use strict';

  // ── Channel Labels ─────────────────────────────────────────────────

  const CHANNEL_NAMES = {
    0: 'Public',
    1: 'Private',
    2: 'Group',
    3: 'Broadcast',
    4: 'Ephemeral',
  };

  function getChannelName(ch) {
    return CHANNEL_NAMES[ch] || `Ch-${ch}`;
  }

  // ── Event Listener ─────────────────────────────────────────────────

  document.addEventListener('nss-found', async (event) => {
    const { element, nssString } = event.detail;

    // Prevent double-processing
    if (element.hasAttribute('data-nss-injected')) return;
    element.setAttribute('data-nss-injected', 'true');

    // Show loading state
    element.classList.add('nss-loading');
    element.textContent = '🔒 Decrypting…';

    try {
      // Send to background script for decryption
      const response = await browser.runtime.sendMessage({
        type: 'nss-decrypt',
        nssString: nssString,
      });

      if (response && response.success) {
        renderDecrypted(element, response.data);
      } else if (response && response.error === 'no-identity') {
        renderNoIdentity(element);
      } else if (response && response.error === 'unknown-sender') {
        renderUnknownSender(element, response.senderFingerprint);
      } else {
        renderError(element, response ? response.error : 'Unknown error');
      }
    } catch (err) {
      renderError(element, err.message);
    }

    element.classList.remove('nss-loading');
  });

  // ── Render Functions ───────────────────────────────────────────────

  /**
   * Render a successfully decrypted message.
   */
  function renderDecrypted(element, data) {
    const { plaintext, channel, senderFingerprint, senderName, verified } = data;

    element.className = 'nss-decrypted';
    element.innerHTML = '';

    // Container
    const container = document.createElement('div');
    container.className = 'nss-message-container';

    // Header bar
    const header = document.createElement('div');
    header.className = 'nss-message-header';

    // Verification icon
    const icon = document.createElement('span');
    if (verified) {
      icon.className = 'nss-verified';
      icon.textContent = '🔒';
      icon.title = `Verified: ${senderName || senderFingerprint}`;
    } else {
      icon.className = 'nss-unverified';
      icon.textContent = '🔓';
      icon.title = 'Signature not verified';
    }
    header.appendChild(icon);

    // Sender info
    const sender = document.createElement('span');
    sender.className = 'nss-sender';
    sender.textContent = senderName || senderFingerprint;
    header.appendChild(sender);

    // Channel badge
    const badge = document.createElement('span');
    badge.className = 'nss-channel-badge';
    badge.textContent = getChannelName(channel);
    badge.setAttribute('data-channel', channel);
    header.appendChild(badge);

    container.appendChild(header);

    // Message body
    const body = document.createElement('div');
    body.className = 'nss-message-body';
    body.textContent = plaintext;
    container.appendChild(body);

    element.appendChild(container);
  }

  /**
   * Render when no identity key exists.
   */
  function renderNoIdentity(element) {
    element.className = 'nss-decrypted nss-error';
    element.innerHTML = '';

    const msg = document.createElement('span');
    msg.className = 'nss-error-text';
    msg.textContent = '🔑 No identity key — open NSS Communicator to generate one';
    element.appendChild(msg);
  }

  /**
   * Render when sender is unknown (no public key imported).
   */
  function renderUnknownSender(element, fingerprint) {
    element.className = 'nss-decrypted nss-unknown';
    element.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'nss-message-container';

    const icon = document.createElement('span');
    icon.className = 'nss-unknown-icon';
    icon.textContent = '⚠️';

    const msg = document.createElement('span');
    msg.className = 'nss-unknown-text';
    msg.textContent = `Unknown sender (${fingerprint}) — import their .nss key`;

    container.appendChild(icon);
    container.appendChild(msg);
    element.appendChild(container);
  }

  /**
   * Render a decryption error.
   */
  function renderError(element, errorMsg) {
    element.className = 'nss-decrypted nss-error';
    element.innerHTML = '';

    const msg = document.createElement('span');
    msg.className = 'nss-error-text';
    msg.textContent = `🔒 Encrypted message (${errorMsg})`;
    msg.title = 'Could not decrypt this message';
    element.appendChild(msg);
  }

  console.log('[NSS] Injector active — ready to decrypt messages');
})();
