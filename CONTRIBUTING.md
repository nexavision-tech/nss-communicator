# Contributing to NSS Communicator

Thank you for your interest in contributing to NSS Communicator! This project is built by the [NexaVision Tech Consortium](https://nexavision.tech) and welcomes contributions from everyone.

## How to Contribute

### Reporting Bugs
1. Check existing [Issues](../../issues) to avoid duplicates
2. Open a new issue with:
   - Browser and version (Firefox 91+, Chrome, etc.)
   - Operating system
   - Steps to reproduce
   - Expected vs. actual behavior
   - Console errors (if any — open `about:debugging` → Inspect in Firefox)

### Suggesting Features
Open an issue with the `enhancement` label. Describe:
- What problem it solves
- How you envision it working
- Any security implications

### Code Contributions

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nss-communicator.git
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b fix/import-bug
   ```
4. **Make your changes** — follow the code style (see below)
5. **Test** in Firefox and Chrome
6. **Push** and open a **Pull Request**

## Code Style

- **Vanilla JavaScript** — no frameworks, no build tools for core extension
- **IIFE modules** — each file wraps in `(() => { ... })()`
- **`'use strict'`** — always
- **Meaningful names** — `handleImportKey`, not `doStuff`
- **Comments** — explain *why*, not *what*
- **SPDX headers** — every source file includes `SPDX-License-Identifier: GPL-3.0-or-later`

## Security-Sensitive Changes

If your change touches **any** of these files, it requires extra scrutiny:
- `crypto/keys.js` — Key generation and import
- `crypto/encrypt.js` — Encryption and decryption
- `storage/keyring.js` — Private key storage and passphrase handling
- `background.js` — Message routing between popup and crypto

**Requirements for crypto changes:**
- Explain the security rationale in your PR description
- Do not introduce external crypto libraries — Web Crypto API only
- Do not weaken any algorithm parameters (key sizes, iteration counts, etc.)
- All crypto changes require review before merge

## Testing

Load the extension from source in Firefox (`about:debugging`) and Chrome (`chrome://extensions`):
1. Generate keys with a test passphrase
2. Export your public key
3. Import it as a contact
4. Compose and encrypt a message (both public and private channels)
5. Decrypt the message
6. Lock and unlock the keyring
7. Export and import the keyring

## License

By contributing, you agree that your contributions will be licensed under the [GNU General Public License v3.0](LICENSE).

## Contact

- **Email:** admin@nexavision.tech
- **Project:** [nexavision.tech](https://nexavision.tech)

---

> *Privacy is a right, not a privilege. Thank you for helping protect it.*
