# NSS Distribution & Trust Levels

## 🎯 Distribution Channels

### Phase 1: Browser Extensions
| Platform | Store | Fee | Status |
|----------|-------|-----|--------|
| 🦊 **Firefox** | [addons.mozilla.org](https://addons.mozilla.org) | Free | 🔜 Primary target |
| 🦊 **Firefox Android** | Same as desktop | Free | 🔜 Mobile extensions supported natively! |
| 🌐 **Chrome** | [Chrome Web Store](https://chrome.google.com/webstore) | $5 one-time | ⏳ Phase 2 |
| 🦁 **Brave** | Chrome Web Store compatible | $0 | ⏳ Phase 2 |

### Phase 2: Mobile Apps
| Platform | Method | Fee | Notes |
|----------|--------|-----|-------|
| 🤖 **Android** | F-Droid (FOSS store) | Free | GPL-friendly, no Google Play needed |
| 🤖 **Android** | APK direct download | Free | Side-load from nexavision.tech |
| 🍎 **iOS** | Safari Web Extension | $99/yr Apple Developer | Safari supports Web Extensions |
| 🍎 **iOS** | TestFlight (beta) | Same | Pre-release testing |

### Phase 3: Desktop Apps
| Platform | Method | Notes |
|----------|--------|-------|
| 🐧 **Linux** | AppImage / Flatpak / Snap | Native packaging |
| 🍎 **macOS** | DMG / Homebrew | Safari extension bundled |
| 🪟 **Windows** | Installer / winget | Edge-compatible extension |

---

## 🔐 Trust & Verification Levels

*"It's not paranoia if they're actually watching."*

### Level 1: 🟢 Normal User
**Install from store, trust the process**
- Download from Firefox Add-ons or Chrome Web Store
- Store reviews extension code before publishing
- Auto-updates via store
- **Good for:** Most people who want basic privacy

### Level 2: 🟡 Security-Conscious
**Verify the build matches the source**
- Clone the repo: `git clone https://github.com/nexavision-tech/nss-communicator.git`
- Compare SHA-256 checksums of store version vs source:
  ```bash
  sha256sum src/**/*.js > checksums.txt
  # Compare against published checksums in CHECKSUMS.md
  ```
- Build from source and load as temporary extension
- **Good for:** Journalists, activists, security researchers

### Level 3: 🟠 Paranoid (Healthy)
**Build from source, verify every commit**
- Fork the repo to your own account
- Audit every commit: `git log --oneline --all`
- Verify GPG signatures on commits (when we add them)
- Build from YOUR fork, load as permanent unsigned extension
- Review the Web Crypto API calls yourself (< 500 lines)
- Run the test harness: `test/crypto_test.html`
- **Good for:** People in high-risk environments, security auditors

### Level 4: 🔴 Ultra-Paranoid
**Air-gapped key generation, physical key exchange**
- Generate keys on an **air-gapped machine** (no network)
- Export .nss public key to a **USB drive** (encrypted)
- Exchange .nss files **in person** or via **US Postal Service** 📬
- Verify fingerprints over a **phone call** (read 8 hex chars aloud)
- Consider: print the .nss file, mail it, re-type on the other end
- For the truly committed: **lemon juice** on paper, hold over candle 🕯️
- **Good for:** Whistleblowers, intelligence professionals, time travelers

### Level 5: 🟣 Tin Foil Hat
- Memorize your private key (good luck with RSA-4096)
- Communicate exclusively through interpretive dance
- We don't judge

---

## 📋 Build Verification

Every release includes a `CHECKSUMS.md` with SHA-256 hashes:

```bash
# Verify your download
cd nss-communicator/
sha256sum -c CHECKSUMS.md

# Or generate your own
find src/ -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.json" | sort | xargs sha256sum
```

### GPG Signing (Coming Soon)
Releases will be signed with the NexaVision GPG key:
```
Key ID: [TBD]
Fingerprint: [TBD]
Email: chris@gengeo.org
```

---

## 🏪 Store Submission Checklist

### Firefox Add-ons (AMO)
- [ ] Create developer account at addons.mozilla.org
- [ ] Package extension: `cd src && zip -r ../nss-communicator.xpi *`
- [ ] Submit for review
- [ ] Write privacy policy (no data collection, period)
- [ ] Provide source code link (GitHub)
- [ ] Wait for review (typically 1-3 days)

### Chrome Web Store
- [ ] Pay $5 registration fee
- [ ] Package as .zip
- [ ] Submit with privacy policy
- [ ] Justify permissions in review
- [ ] Note: Chrome may push back on content_scripts broad matching

### F-Droid (Android)
- [ ] Create build recipe (metadata/build.gradle)
- [ ] Submit to F-Droid repo
- [ ] F-Droid builds from source (reproducible builds)
- [ ] No Google Play dependency

---

*"Not so super sneaky — because the source code, the checksums, and the lemon juice recipe are all right here."* 🍋🔐
