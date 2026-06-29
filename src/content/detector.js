/**
 * NSS Communicator — Content Detector
 * Scans social media pages for NSS-encrypted strings and marks them for processing.
 *
 * Runs as IIFE content script. Uses MutationObserver for efficient detection
 * of dynamically loaded content (infinite scroll, AJAX updates, etc.).
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

(function NSSDetector() {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────────

  const NSS_PATTERN = />>--NSS:v1:\d{1,2}:[0-9a-f]{8}:[\s\S]*?-->/g;
  const NSS_CLASS = 'nss-encrypted';
  const NSS_PROCESSED_ATTR = 'data-nss-detected';
  const SCAN_DEBOUNCE_MS = 150;

  let scanTimeout = null;

  // ── Core Detection ─────────────────────────────────────────────────

  /**
   * Scan a single text node for NSS strings.
   * If found, wraps each match in a <span class="nss-encrypted"> and dispatches
   * a custom 'nss-found' event on the document.
   *
   * @param {Text} textNode — DOM Text node to scan
   */
  function scanTextNode(textNode) {
    const text = textNode.textContent;
    if (!text || text.length < 20) return;

    // Quick bail-out before running regex
    if (text.indexOf('>>--NSS:v1:') === -1) return;

    const parent = textNode.parentNode;
    if (!parent) return;

    // Don't re-process already-detected nodes
    if (parent.classList && parent.classList.contains(NSS_CLASS)) return;
    if (parent.hasAttribute && parent.hasAttribute(NSS_PROCESSED_ATTR)) return;

    // Don't scan script/style/textarea elements
    const tagName = parent.tagName;
    if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'TEXTAREA' || tagName === 'INPUT') {
      return;
    }

    const matches = text.match(NSS_PATTERN);
    if (!matches) return;

    // For each match, split the text node and wrap the NSS string
    let currentNode = textNode;

    for (const match of matches) {
      const idx = currentNode.textContent.indexOf(match);
      if (idx === -1) continue;

      // Split: [before][match][after]
      const beforeNode = currentNode;
      const matchNode = beforeNode.splitText(idx);
      const afterNode = matchNode.splitText(match.length);

      // Create wrapper span
      const span = document.createElement('span');
      span.className = NSS_CLASS;
      span.setAttribute(NSS_PROCESSED_ATTR, 'true');
      span.setAttribute('data-nss-raw', match);
      span.textContent = match;

      // Replace the match text node with the span
      parent.replaceChild(span, matchNode);

      // Dispatch custom event for injector.js
      const event = new CustomEvent('nss-found', {
        bubbles: true,
        detail: {
          element: span,
          nssString: match,
        },
      });
      document.dispatchEvent(event);

      // Continue scanning from the remainder
      currentNode = afterNode;
    }
  }

  /**
   * Recursively scan a DOM subtree for text nodes containing NSS strings.
   * @param {Node} root — Root node to scan
   */
  function scanSubtree(root) {
    // Use TreeWalker for efficient text node enumeration
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip nodes inside already-processed NSS elements
          if (node.parentNode && node.parentNode.classList &&
              node.parentNode.classList.contains(NSS_CLASS)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    // Collect text nodes first (scanning modifies the DOM)
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    // Process collected nodes
    for (const textNode of textNodes) {
      scanTextNode(textNode);
    }
  }

  /**
   * Debounced full-page scan. Used sparingly — primarily on initial load.
   */
  function scheduleScan() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      scanSubtree(document.body);
    }, SCAN_DEBOUNCE_MS);
  }

  // ── MutationObserver ───────────────────────────────────────────────

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Scan new nodes
      if (mutation.type === 'childList') {
        for (const added of mutation.addedNodes) {
          if (added.nodeType === Node.TEXT_NODE) {
            scanTextNode(added);
          } else if (added.nodeType === Node.ELEMENT_NODE) {
            // Skip our own injected elements
            if (added.classList && added.classList.contains(NSS_CLASS)) continue;
            if (added.classList && added.classList.contains('nss-decrypted')) continue;
            scanSubtree(added);
          }
        }
      }

      // Handle text content changes
      if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
        scanTextNode(mutation.target);
      }
    }
  });

  // ── Initialization ─────────────────────────────────────────────────

  function init() {
    // Initial scan
    if (document.body) {
      scanSubtree(document.body);
    }

    // Watch for dynamic content
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    console.log('[NSS] Detector active — watching for encrypted messages');
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
