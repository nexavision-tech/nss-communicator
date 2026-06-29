# 🛡️ NSS Security Model

## Threat Model Overview

NSS is designed to protect **message content** from platform operators and mass surveillance. It is NOT designed to protect against endpoint compromise.

### Threat Actors

| Actor | Capability | NSS Protection |
|-------|-----------|---------------|
| **Platform operators** (Meta, X, Google) | Read all plaintext messages, comments, posts | ✅ Protected — they see ciphertext only |
| **Data brokers** | Scrape and correlate social media content | ✅ Protected — scraped content is encrypted noise |
| **Ad networks** | Profile users based on message content | ✅ Protected — no content to profile |
| **Passive network observers** | Intercept traffic between user and platform | ✅ Protected — message is encrypted before it hits the network |
| **State-level actors** | Install device monitoring, compel platform cooperation | ❌ NOT protected — if your device is compromised, game over |
| **Physical access attackers** | Shoulder surfing, screen recording, device theft | ❌ NOT protected — decrypted content is visible on screen |
| **Malicious browser extensions** | Read DOM content, intercept keystrokes | ❌ NOT protected — extension has same DOM access as NSS |

## What We Protect

1. **Message confidentiality** — Only intended recipients can read the message
2. **Message authenticity** — RSA-PSS signatures prove who sent the message
3. **Message integrity** — AES-256-GCM's authentication tag detects tampering
4. **Forward secrecy** (planned) — X25519 ECDH key exchange means past messages stay safe even if long-term keys are compromised

## What We Do NOT Protect

### Endpoint Security (Your Device)
If your device has:
- **Keyloggers** — Attacker reads your message as you type it
- **Screen capture malware** — Attacker sees decrypted content on your screen
- **Malicious browser extensions** — Extensions with broad permissions can read page DOM after NSS decrypts
- **Remote access trojans (RATs)** — Full device compromise, nothing helps

> **The Golden Rule**: Your encryption is only as strong as your weakest endpoint.

### Metadata
Platforms can still see:
- **That** you posted (your account posted content)
- **When** you posted (timestamp)
- **Where** you posted (which page/group/thread)
- **How often** you post (frequency patterns)
- **Who you interact with** (reply patterns)

They just can't read **what** you said.

### Traffic Analysis
A sophisticated observer can correlate:
- Timing of encrypted posts between two users → probable communication
- Length of ciphertext → approximate message length
- Channel numbers → group affiliations

## Browser Recommendations

| Browser | Risk Level | Notes |
|---------|-----------|-------|
| 🦊 **Firefox** | ✅ Low | Open source, strong extension sandboxing, no Google telemetry. **Use this.** |
| 🧅 **Tor Browser** | ✅ Low | Firefox-based, adds network anonymity. Best for high-risk users. |
| 🦁 **Brave** | ⚠️ Medium | Chromium-based but blocks trackers. Acceptable alternative. |
| 🌐 **Chrome** | ⚠️ High | Google telemetry, Manifest V3 limits extension capabilities, broader extension permissions. Use with caution. |
| 📐 **Edge** | ❌ Very High | Microsoft telemetry, Bing integration, broad data collection. Not recommended. |

## Key Management Best Practices

1. **Generate keys on a clean device** — No malware, no unknown extensions
2. **Back up your .ss (private key) file** — Encrypted USB drive, not cloud storage
3. **Never share your .ss file** — Not with anyone, not with us, not with law enforcement
4. **Verify public keys in person** — Exchange .nss files face-to-face or over a verified secure channel
5. **Rotate keys periodically** — Generate new keypairs every 6-12 months
6. **Revoke compromised keys immediately** — If you suspect compromise, generate new keys and notify contacts

## Cryptographic Implementation

All cryptography uses the **Web Crypto API** — a browser-native cryptographic interface.

- **No external dependencies** — No npm packages, no compiled libraries
- **No custom crypto** — Standard algorithms only (RSA-OAEP, RSA-PSS, AES-256-GCM)
- **Auditable source** — Every crypto operation is in `src/crypto/` (< 500 lines total)
- **No server-side processing** — All encryption/decryption happens in your browser

### Why Web Crypto API?
- Implemented by browser vendors (Mozilla, Google, Apple) who have dedicated security teams
- FIPS 140-2 validated implementations on most platforms
- Constant-time operations to prevent timing attacks
- Hardware acceleration where available

## Responsible Disclosure

Found a vulnerability? Please report it responsibly:

1. **Email**: chris@gengeo.org (subject: "NSS Security")
2. **Do NOT** open a public GitHub issue for security vulnerabilities
3. We will acknowledge within 48 hours
4. We will provide a fix timeline within 7 days
5. Credit will be given to the reporter (unless anonymity is requested)

---

*Security through transparency, not obscurity.*
