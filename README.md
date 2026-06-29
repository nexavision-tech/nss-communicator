# 🔐 NSS — Not So Super Sneaky Communicator

**Encrypted messaging overlay for social media. Use *their* infrastructure. Keep *your* privacy.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox-browser)](https://addons.mozilla.org/en-US/firefox/)
[![NexaVision](https://img.shields.io/badge/NexaVision-Tech%20Consortium-00ff88)](https://nexavision.tech)

---

## What Is This?

NSS is a **browser extension** that lets you post encrypted messages as comments on Facebook, Twitter/X, YouTube, Reddit — anywhere text goes. Other NSS users see the decrypted message inline. Everyone else sees noise.

**You are not building a new platform.** You are using *their* platform as a transport layer for *your* private communication.

### What They See

```
💬 Chris commented:
NSS:v1:pub:A3F8:xKp9mR4vT7wQ2pL5nBYFZjC4cqF8E38pVoK2sH...
🔐 nexavision.tech/nss — decrypt this message
```

### What NSS Users See

```
💬 Chris commented:
🔓 "The new transparency report from EFF is worth reading.
    Thread continues in Channel 7."
✅ Verified — chris@gengeo.org (RSA-4096)
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

## ⚠️ Security Disclaimers

> **READ THIS. It matters.**

### What NSS Protects Against
- ✅ Platform operators reading your messages (Meta, X Corp, Google)
- ✅ Mass surveillance of social media content
- ✅ Data brokers scraping your conversations
- ✅ Advertising algorithms profiling your private thoughts

### What NSS Does NOT Protect Against
- ❌ **Compromised devices** — If your phone/computer has spyware, screen monitoring software, or a keylogger, attackers can read messages before encryption and after decryption. **No encryption tool can protect against a compromised endpoint.**
- ❌ **Screen recording/shoulder surfing** — If someone can see your screen, they can see decrypted messages.
- ❌ **Browser extensions with broad permissions** — Malicious extensions (including some from Chrome/Edge) may have permission to read page content. **Use Firefox. Audit your extensions.**
- ❌ **State-level adversaries** — If a government has installed monitoring software on your device, NSS cannot help. Consider using Tails OS or a dedicated secure device.
- ❌ **Metadata** — Platforms can still see *that* you posted, *when* you posted, and *who* you interacted with. They just can't read *what* you said.

### Browser Recommendations
| Browser | Recommendation | Why |
|---------|---------------|-----|
| 🦊 **Firefox** | ✅ **Primary** | Open source, privacy-focused, no Google telemetry |
| 🧅 **Tor Browser** | ✅ Supported | Maximum privacy, hides metadata too |
| 🦁 **Brave** | ⚠️ Compatible | Chromium-based but privacy-focused |
| 🌐 **Chrome** | ⚠️ Use with caution | Google telemetry, extension permissions are broader |
| 📐 **Edge** | ❌ Not recommended | Microsoft telemetry, broad extension permissions |

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
│  Key Exchange: X25519 ECDH (forward secrecy)     │
│  Encryption:  AES-256-GCM (fast, authenticated)  │
│  Signing:     RSA-PSS (message authenticity)      │
│  Implementation: Web Crypto API (browser-native)  │
│                                                  │
│  No external crypto libraries.                   │
│  No server-side processing.                      │
│  Everything happens in YOUR browser.             │
└─────────────────────────────────────────────────┘
```

### Key Files
- `.nss` — Public key (share with anyone)
- `.ss` — Private key (NEVER share, stored in browser IndexedDB)

### Channels
NSS supports **16 channels** for organizing conversations:

| Channel | Purpose | Access |
|---------|---------|--------|
| 0 (Public) | Open broadcast | Anyone with NSS |
| 1-8 | Group channels | Shared key required |
| 9-14 | Private channels | Invite-only |
| 15 | Direct message | 1:1 encrypted |

### Message Format
```
NSS:v1:<channel>:<sender_fingerprint_8char>:<base64_encrypted_payload>
🔐 nexavision.tech/nss — decrypt this message
```

---

## Installation

### Firefox (Primary)
1. Download the latest release from [Releases](../../releases)
2. Open Firefox → `about:debugging` → "This Firefox" → "Load Temporary Add-on"
3. Select the `manifest.json` file
4. NSS icon appears in your toolbar

*(Firefox Add-on Store submission coming soon)*

### From Source
```bash
git clone https://github.com/nexavision-tech/nss-communicator.git
cd nss-communicator
# Load src/ directory as a temporary extension in Firefox
```

---

## Usage

### First Time Setup
1. Click the NSS icon in your toolbar
2. Click **"Generate Keys"** — creates your RSA-4096 keypair
3. Your `.nss` public key file is ready to share
4. Your `.ss` private key is stored securely in the browser

### Sending an Encrypted Message
1. Navigate to any social media platform
2. Click the NSS icon → **"Compose"**
3. Select a channel
4. Type your message
5. Click **"Encrypt & Copy"**
6. Paste the encrypted string as a comment/post

### Reading Encrypted Messages
- NSS automatically scans the page for `NSS:v1:` strings
- If you have the sender's public key, the message decrypts inline
- A green lock icon indicates verified messages
- Unknown senders show a prompt to import their key

### Key Exchange
1. Share your `.nss` file with trusted contacts (email, in person, or post it publicly)
2. Import their `.nss` file through the extension popup
3. Messages from imported keys auto-decrypt

---

## Project Structure

```
nss-communicator/
├── src/
│   ├── manifest.json          # Firefox WebExtension manifest
│   ├── background.js          # Service worker / event page
│   ├── content/
│   │   ├── detector.js        # Scan pages for NSS strings
│   │   ├── injector.js        # Replace ciphertext with plaintext in DOM
│   │   └── composer.js        # Compose encrypted messages
│   ├── popup/
│   │   ├── popup.html         # Extension popup UI
│   │   ├── popup.js           # Key management, channels
│   │   └── popup.css          # Popup styling
│   ├── crypto/
│   │   ├── keys.js            # RSA-4096 + X25519 key generation
│   │   ├── encrypt.js         # AES-256-GCM encryption/decryption
│   │   └── sign.js            # RSA-PSS signing/verification
│   ├── storage/
│   │   └── keyring.js         # IndexedDB key storage
│   ├── icons/                 # Extension icons
│   └── styles/
│       └── nss-inline.css     # Injected styles for decrypted messages
├── docs/
│   ├── SECURITY.md            # Security model documentation
│   ├── PROTOCOL.md            # Message format specification
│   └── THREAT_MODEL.md        # What we protect against (and don't)
├── test/
│   └── crypto.test.js         # Crypto unit tests
├── LICENSE                    # GPL v3
├── CONTRIBUTING.md            # How to contribute
└── README.md                  # This file
```

---

## Roadmap

- [x] Project scope and architecture
- [ ] Core crypto engine (Web Crypto API)
- [ ] Key generation and storage (IndexedDB)
- [ ] Message encryption/decryption
- [ ] Content script: detect NSS strings in pages
- [ ] Content script: inline decryption display
- [ ] Compose modal for writing encrypted messages
- [ ] Firefox extension popup UI
- [ ] Channel system (16 channels)
- [ ] Platform-specific content scripts (Facebook, Twitter, YouTube, Reddit)
- [ ] Key exchange flow
- [ ] Firefox Add-on Store submission
- [ ] Security audit
- [ ] Mobile companion app (PWA)

---

## Contributing

NSS is open source and welcomes contributions. See [CONTRIBUTING.md](CONTRIBUTING.md).

Before contributing code:
1. Read the [Security Model](docs/SECURITY.md)
2. Read the [Threat Model](docs/THREAT_MODEL.md)
3. All crypto changes require peer review from at least 2 maintainers

---

## Credits

Built by the [NexaVision Tech Consortium](https://nexavision.tech)

**Core Team:**
- Chris Hanni ([@chris](https://git.nexavision.tech/chris)) — Creator, Vision
- Claude ([@claude](https://git.nexavision.tech/claude)) — Architecture, Engineering
- Gem — Navigation, Strategy

**Ethos:** Substrate-agnostic intelligence. Human-AI collaborative development. Privacy as a right, not a privilege.

---

## License

[GNU General Public License v3.0](LICENSE)

Free as in freedom. Always.

---

> *"Not so super sneaky — because the source code is right here."*
