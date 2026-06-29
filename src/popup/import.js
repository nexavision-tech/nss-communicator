/**
 * NSS Communicator — Import Page Logic
 * Handles file importing in a dedicated tab to prevent popup closing issues.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

(function NSSImport() {
  'use strict';

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const statusEl = document.getElementById('import-status');
  const titleEl = document.getElementById('import-title');
  const descEl = document.getElementById('import-desc');

  // Determine import type based on URL hash
  const isKeyring = window.location.hash === '#keyring';
  
  if (isKeyring) {
    titleEl.textContent = 'Import Keyring';
    descEl.textContent = 'Select an nss-keyring.json file to restore your entire keyring.';
    fileInput.accept = '.json';
  } else {
    titleEl.textContent = 'Import Contact Key';
    descEl.textContent = 'Select an .nss public key file to add to your contacts.';
    fileInput.accept = '.nss,.txt';
  }

  // ── Drag and Drop ──────────────────────────────────────────────────

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFile(e.target.files[0]);
    }
  });

  // ── File Handling ──────────────────────────────────────────────────

  async function handleFile(file) {
    showStatus('Reading file...', '');
    
    try {
      const text = await file.text();
      
      if (isKeyring) {
        await processKeyringImport(text);
      } else {
        await processKeyImport(text, file.name);
      }
    } catch (err) {
      showStatus('Failed to read file: ' + err.message, 'error');
    }
    
    fileInput.value = '';
  }

  async function processKeyImport(text, filename) {
    const result = await nssPrompt('Import Contact', [
      { id: 'ik-name', label: 'Name for this contact:', value: filename.replace(/\.nss$/, '') },
      { id: 'ik-email', label: 'Email (optional):', placeholder: 'you@example.com' }
    ]);
    
    if (!result || !result['ik-name']) {
      showStatus('Import cancelled.', '');
      return;
    }
    
    const name = result['ik-name'];
    const email = result['ik-email'] || '';

    const response = await browser.runtime.sendMessage({
      type: 'nss-import-key',
      keyData: text,
      name,
      email,
    });

    if (response.success) {
      showStatus(`✓ Successfully imported key: ${response.fingerprint}`, 'success');
      setTimeout(() => window.close(), 2000);
    } else {
      showStatus('✗ Import failed: ' + response.error, 'error');
    }
  }

  async function processKeyringImport(text) {
    const response = await browser.runtime.sendMessage({
      type: 'nss-import-keyring',
      data: text,
    });

    if (response.success) {
      showStatus(`✓ Successfully imported ${response.imported} contacts (skipped ${response.skipped} duplicates).`, 'success');
      setTimeout(() => window.close(), 3000);
    } else {
      showStatus('✗ Import failed: ' + response.error, 'error');
    }
  }

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = '';
    if (type) statusEl.classList.add(`status-${type}`);
    statusEl.style.display = 'block';
  }

  // ── Utilities ──────────────────────────────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

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
        <div class="nss-field" style="margin-bottom: 12px; text-align: left;">
          <label for="${f.id}" style="display: block; margin-bottom: 4px; font-size: 11px; color: #888;">${escapeHtml(f.label)}</label>
          <input type="${f.type || 'text'}" id="${f.id}" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value || '')}" style="width: 100%; background: #0a0e17; border: 1px solid #1a2035; color: #e0e0e0; padding: 8px; border-radius: 4px; outline: none;">
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

})();
