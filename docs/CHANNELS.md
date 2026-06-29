# NSS Channel Allocation & Skin System

## 📡 Channel Map (16 Channels)

| Channel | Name | Type | Purpose |
|---------|------|------|---------|
| **0** | `BROADCAST` | 🔓 Open/Signed | Public signed messages — anyone with NSS can read. Not encrypted, just verified. |
| **1** | `NEXA-OPS` | 🔒 Reserved | NexaVision operational comms — consortium members only |
| **2** | `NEXA-ATLAS` | 🔒 Reserved | NexaVision Atlas / GeoServer data alerts |
| **3** | `NEXA-OSINT` | 🔒 Reserved | SEC/FEC intelligence pipeline alerts |
| **4** | `PRESS` | 🔓 Open | Journalist channel — press releases, tips |
| **5** | `CIVIC` | 🔓 Open | Civic engagement — Congress, EFF, advocacy |
| **6** | `OPEN-1` | 🔓 Open | Community channel — anyone can create groups |
| **7** | `OPEN-2` | 🔓 Open | Community channel |
| **8** | `OPEN-3` | 🔓 Open | Community channel |
| **9** | `OPEN-4` | 🔓 Open | Community channel |
| **10** | `RESEARCH` | 🔒 Reserved | gengeo.org research comms |
| **11** | `DEV` | 🔓 Open | Developer channel — open source coordination |
| **12** | `EMERGENCY` | 🔓 Open | Emergency broadcast — high priority |
| **13** | `RESERVED` | 🔒 Reserved | Future use |
| **14** | `RESERVED` | 🔒 Reserved | Future use |
| **15** | `DM` | 🔐 Direct | 1:1 encrypted direct messages |

### How It Works
- **Open channels (🔓)**: Anyone with the NSS extension can join. Messages are encrypted with a shared channel key that gets distributed when you join.
- **Reserved channels (🔒)**: NexaVision-issued channel keys only. You need an invite from a channel admin.
- **Direct messages (🔐)**: 1:1 using recipient's public key. No channel key needed.
- **Broadcast (Channel 0)**: Special — messages are SIGNED but not encrypted. Anyone can read. Think of it as a verified public broadcast.

---

## 🎨 Skin System (Walkie-Talkie Vibes)

### Concept
The NSS popup/composer gets **swappable visual skins** — different visual themes that change the look without changing the crypto. Pure CSS + icon swaps.

### Default Skins

| Skin | Vibe | Colors |
|------|------|--------|
| `default` | NexaVision cyberpunk | Dark navy + green (#00ff88) |
| `walkie-talkie` | Retro military radio | Olive drab + amber LCD |
| `terminal` | Hacker terminal | Black + green phosphor |
| `stealth` | Minimal, invisible | Matches platform native UI |
| `neon` | Cyberpunk 2077 | Purple + cyan + pink |

### Future: AI-Generated Skins
- Users can request custom skins via prompt
- Generated with image AI (DALL-E, Stable Diffusion, etc.)
- Skin = CSS file + icon pack + optional background texture
- Community can share skins via `.nss-skin` files
- **Easter egg skins** — fun stuff, keeping it light 😄

### Skin File Format
```
my-skin.nss-skin/
├── skin.json         # Name, author, version
├── popup.css         # Override popup styles
├── inline.css        # Override in-page styles
├── icons/
│   ├── lock.svg      # Custom lock icon
│   ├── unlock.svg    # Custom unlock icon
│   └── channel.svg   # Custom channel badge
└── preview.png       # Thumbnail for skin picker
```

---

## 🔮 Future: Profile Behavior Detection

### Phase 2+ Feature
Detect anomalous behavior that might indicate a compromised account:

| Signal | What It Means |
|--------|---------------|
| Sudden key change | Someone replaced the user's keypair — possible account takeover |
| Message frequency spike | Bot behavior — automated posting |
| Geolocation mismatch | User claims to be in NYC but metadata suggests Moscow |
| Signing key mismatch | Message signed with a different key than the user's registered .nss |
| Channel flooding | One user spamming a channel — rate limiting |

### How It Would Work
```
Normal: Chris posts 3-5 messages/day from Vientiane IP
Alert:  Chris posts 47 messages in 1 hour from Shenzhen IP
        → NSS flags: "⚠️ This user's behavior has changed significantly"
        → Other users see the warning before trusting messages
```

### Privacy-Preserving Detection
- All detection runs **locally in the browser** — no server-side tracking
- Based on **public observable patterns** only (posting frequency, key changes)
- Users can opt out of behavioral warnings
- No personal data is collected or transmitted

---

*Walkie-talkie vibes with serious crypto underneath. 📻🔐*
