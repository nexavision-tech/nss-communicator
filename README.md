# 🔐 NSS — Not So Super Sneaky Communicator

![NSS Communicator Banner](docs/assets/nss-banner.jpg)

**Encrypted messaging overlay for social media. Use *their* infrastructure. Keep *your* privacy.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox-browser)](https://addons.mozilla.org/en-US/firefox/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome)](https://chrome.google.com/webstore/)
[![NexaVision](https://img.shields.io/badge/NexaVision-Tech%20Consortium-00ff88)](https://nexavision.tech)

---

## What Is This?

NSS is a **browser extension** that lets you post encrypted messages as comments on Facebook, Twitter/X, YouTube, Reddit — anywhere text goes. Other NSS users see the decrypted message. Everyone else sees noise.

**You are not building a new platform.** You are using *their* platform as a transport layer for *your* private communication.

### What They See

```
💬 Chris commented:
>>--
NSS:v1:1:52bfe4a8:eyJtb2RlIjoiZW5jcnlwdGVkIiwiZW5j...
-->

🏹 To read this secure message, install NSS Communicator:
https://github.com/nexavision-tech/nss-communicator
```

### What NSS Users See

```
💬 Chris commented:
🔓 "The new transparency report from EFF is worth reading."
✅ Verified Signature — From: Alice (52bfe4a8)
```

---

## Why?

People deserve private communication. The platforms that connect 8+ billion humans are owned by a handful of billionaires who monetize every word, every click, every relationship.

NSS doesn't fight them. It **rides** them. Their servers store and distribute your messages — for free. They just can't read them.

**Not So Super Sneaky** because:
- All source code is public (this repo)
- The encryption is standard, auditable cryptography
- There is no hidden infrastructure, no secret servers, no backdoors
- Security through transparency, not obscurity

---

## ⚠️ Security & Disclaimers

> **READ THIS. It matters.**

### What NSS Protects Against
- ✅ Platform operators reading your messages (Meta, X Corp, Google)
- ✅ Mass surveillance of social media content
- ✅ Data brokers scraping your conversations
- ✅ Advertising algorithms profiling your private thoughts

### What NSS Does NOT Protect Against
- ❌ **Compromised devices** — If your phone/computer has spyware, screen monitoring software, or a keylogger, attackers can read messages before encryption and after decryption. **No encryption tool can protect against a compromised endpoint.**
- ❌ **Screen recording/shoulder surfing** — If someone can see your screen, they can see decrypted messages.
- ❌ **Browser extensions with broad permissions** — Malicious extensions may have permission to read page content. **Audit your extensions.**
- ❌ **State-level adversaries** — If a government has installed monitoring software on your device, NSS cannot help. Consider using Tails OS or a dedicated secure device.
- ❌ **Metadata** — Platforms can still see *that* you posted, *when* you posted, and *who* you interacted with. They just can't read *what* you said.

### Warranty Disclaimer

> **This software is provided "AS IS", without warranty of any kind.** Use at your own risk. See the [GNU General Public License v3.0](LICENSE) for full terms. This is free software in the sense of freedom, not a commercial product. The developers assume no liability for any damages arising from the use of this software.

### Contact

- **Project:** [nexavision.tech](https://nexavision.tech)
- **Email:** admin@nexavision.tech
- **Source:** [github.com/nexavision-tech/nss-communicator](https://github.com/nexavision-tech/nss-communicator)
- **License:** [GNU General Public License v3.0](LICENSE)

### Browser Recommendations
| Browser | Recommendation | Why |
|---------|---------------|-----|
| 🦊 **Firefox** | ✅ **Primary** | Open source, privacy-focused, no Google telemetry |
| 🧅 **Tor Browser** | ✅ Supported | Maximum privacy, hides metadata too |
| 🌐 **Chrome** | ✅ Supported | MV3 build available |
| 📐 **Edge** | ⚠️ Compatible | Chromium-based, uses Chrome build |
| 🎭 **Opera** | ⚠️ Compatible | Chromium-based, uses Chrome build |
| 🦁 **Brave** | ⚠️ Compatible | Chromium-based but privacy-focused |

### The Golden Rule
> **Your encryption is only as strong as your weakest endpoint.** If your device is compromised, no software can save you. Practice basic security hygiene: keep your OS updated, don't install random apps, use a password manager, enable 2FA everywhere.

---

## How It Works

### Cryptography

```
┌─────────────────────────────────────────────────┐
│                 NSS Crypto Stack                 │
│                                                  │
│  Identity:    RSA-4096 keypairs (.nss / .ss)     │
│  Key Wrap:    RSA-OAEP / SHA-256                 │
│  Encryption:  AES-256-GCM (authenticated)        │
│  Signing:     RSASSA-PKCS1-v1_5 / SHA-256        │
│  Passphrase:  PBKDF2 (100K iterations) + AES-GCM │
│  Implementation: Web Crypto API (browser-native)  │
│                                                  │
│  No external crypto libraries.                   │
│  No server-side processing.                      │
│  Everything happens in YOUR browser.             │
└─────────────────────────────────────────────────┘
```

### Key Files
- `.nss` — Public key (share with anyone)
- `.ss` — Private key (NEVER share, encrypted with your passphrase in IndexedDB)

### Message Format
```
>>--
NSS:v1:<channel>:<sender_fingerprint_8char>:<base64_encrypted_payload>
-->

🏹 To read this secure message, install NSS Communicator:
https://github.com/nexavision-tech/nss-communicator
```

### Channels
| Channel | Purpose | Encryption |
|---------|---------|------------|
| 0 (Public) | Open broadcast | Signed only (readable by anyone with NSS) |
| 1-15 | Private messages | Fully encrypted (AES-256-GCM + RSA-OAEP) |

---

## Installation

### Firefox (Primary)

**From Source (recommended for audit):**
```bash
git clone https://github.com/nexavision-tech/nss-communicator.git
cd nss-communicator
# Open Firefox → about:debugging → "This Firefox" → "Load Temporary Add-on"
# Select src/manifest.json
```

**From Firefox Add-on Store:** *(Coming soon — submission in progress)*

### Chrome / Edge / Brave / Opera

**From Source:**
```bash
git clone https://github.com/nexavision-tech/nss-communicator.git
cd nss-communicator
./build-chrome.sh
# Open Chrome → chrome://extensions → Enable "Developer Mode"
# Click "Load unpacked" → select dist/chrome/
```

**From Chrome Web Store:** *(Coming soon — submission in progress)*

> 🔒 **Don't trust pre-built binaries?** Build from source. That's the whole point of open source. The code is right here. Read it. Audit it. Build it yourself.

---

## Usage

### First Time Setup
1. Click the NSS icon in your browser toolbar
2. Choose a **passphrase** (min 8 characters) — this protects your private key
3. Click **"🔑 Generate Keys"** — creates your RSA-4096 keypair
4. Your keyring is now unlocked and ready to use

### Sharing Your Public Key
1. Click **"📤 Export .nss"** — downloads your public key file
2. Share this `.nss` file with contacts (email, post it publicly, hand it to them on a USB stick)
3. Your public key is *public* — there's no harm in sharing it widely

### Importing a Contact's Key
1. Open their `.nss` file in any text editor
2. Select all, copy (Ctrl+A, Ctrl+C)
3. In the extension, click **"📥 Import .nss Key"**
4. Enter their name and paste the key contents
5. Click OK — they appear in your contacts

### Sending an Encrypted Message
1. Click the NSS icon → **"✍️ Compose Message"**
2. Select a recipient (or "🌎 Public" for sign-only)
3. Type your message
4. Click **"🔐 Encrypt & Copy"**
5. Paste the encrypted string anywhere — comment, post, DM, forum, email

### Decrypting a Message
1. Copy the encrypted text (everything from `>>--` to `-->`)
2. Click the NSS icon → **"🔓 Decrypt Message"**
3. Paste the encrypted text
4. Click OK — the decrypted message appears with sender verification

### Locking Your Keyring
- Click **"🔓 Lock"** to wipe the passphrase from memory
- The keyring auto-locks after 15 minutes of inactivity
- You'll need to re-enter your passphrase to encrypt or decrypt

---

## Project Structure

```
nss-communicator/
├── src/
│   ├── manifest.json          # Firefox WebExtension manifest (MV2)
│   ├── chrome-manifest.json   # Chrome/Chromium manifest (MV3)
│   ├── background.js          # Background event page
│   ├── content/
│   │   ├── detector.js        # Scan pages for NSS strings
│   │   └── injector.js        # Page integration utilities
│   ├── popup/
│   │   ├── popup.html         # Extension popup UI
│   │   ├── popup.js           # Key management, compose, decrypt
│   │   └── popup.css          # Dark cyberpunk styling
│   ├── crypto/
│   │   ├── keys.js            # RSA-4096 key generation & import/export
│   │   └── encrypt.js         # AES-256-GCM + RSA-OAEP encryption
│   ├── storage/
│   │   └── keyring.js         # PBKDF2-protected IndexedDB keyring
│   ├── icons/                 # Extension icons (48, 96, 128px)
│   └── styles/
│       └── nss-inline.css     # Injected styles for page integration
├── docs/
│   ├── SECURITY.md            # Security model documentation
│   ├── CHANNELS.md            # Channel system specification
│   └── assets/                # Banner and icon graphics
├── build-chrome.sh            # Chrome/Chromium build script
├── LICENSE                    # GNU General Public License v3.0
├── CONTRIBUTING.md            # How to contribute
└── README.md                  # This file
```

---

## Roadmap

- [x] Core crypto engine (Web Crypto API — RSA-OAEP, AES-256-GCM, RSASSA-PKCS1-v1_5)
- [x] Key generation and storage (IndexedDB + PBKDF2 passphrase protection)
- [x] Message encryption/decryption with `>>--` / `-->` envelope
- [x] Compose message UI (popup-based, copy-paste workflow)
- [x] Decrypt message UI (popup-based, paste and read)
- [x] Firefox extension popup UI (dark cyberpunk aesthetic)
- [x] Contact management (import, export, remove)
- [x] Keyring import/export (JSON backup)
- [x] Passphrase-protected keyring (lock/unlock/change passphrase)
- [x] Auto-lock after inactivity
- [x] Channel 0 (public/sign-only) and Channels 1-15 (encrypted)
- [x] Message signature verification
- [ ] Chrome Web Store submission
- [ ] Firefox Add-on Store submission
- [ ] Edge / Opera store submissions
- [ ] Content script: auto-detect `>>--NSS:` on pages
- [ ] Security audit (community welcome)
- [ ] Mobile companion app (PWA)

---

## Contributing

NSS is open source and welcomes contributions. See [CONTRIBUTING.md](CONTRIBUTING.md).

Before contributing code:
1. Read the [Security Model](docs/SECURITY.md)
2. All crypto changes require peer review
3. Follow the existing code style (vanilla JS, no frameworks, no build tools for core)

---

## Credits

Built by the [NexaVision Tech Consortium](https://nexavision.tech)

**Core Team:**
- Chris Hanni — Creator, Vision
- Claude — Architecture, Engineering
- Gem — Navigation, Strategy
- Nano — Design, Assets

**Ethos:** Substrate-agnostic intelligence. Human-AI collaborative development. Privacy as a right, not a privilege.

---

## License

[GNU General Public License v3.0](LICENSE)

Free as in freedom. Always.

---

> *"Not so super sneaky — because the source code is right here."*
