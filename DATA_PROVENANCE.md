# Asset & Dataset Provenance

This repository mixes code written for this project with avatar/image sources that have different provenance.

**Do not assume every bundled image is open-source or commercially redistributable.**

| Category | Current source / description | Current repository treatment | Release status |
|---|---|---|---|
| `custom` | User-provided local images + a small bundled default set | Browser-local import; bundled defaults need their own provenance | Verify bundled defaults |
| `dicebeer` | DiceBear-generated avatars | Generated assets; source/license/attribution should be retained | Verify generated style license/attribution |
| `voicemod` | Avatar material associated with Voicemod | Third-party branded/source material | **Unresolved redistribution gate** |
| `aiface` | Sample generated from a local dataset labelled `黄种人-FFHQ` | 300 derived PNG avatars are currently bundled | **Unresolved dataset/derivative redistribution gate** |
| `voice_previews` | Official voice-demo audio clips from `https://www.voicemod.net/voice-changer-demos` (68 clips matched to avatar names by exact name). Original source URL for every clip is recorded in `js/voice-preview-map.js` (`source` field) | Bundled as `.m4a`/`.mp3` under `assets/voice_previews/`; playable via ▶ buttons on matched avatar cards | **Third-party copyrighted audio — personal preview only. Before any public/commercial claim, confirm Voicemod ToS or replace files with source links only.** |

## Rules

1. A public download page is not proof of redistribution rights.
2. Dataset research availability does not automatically permit republishing derived images.
3. Model-generated/synthetic faces can still carry dataset/model/license restrictions.
4. Before commercial distribution or a “fully open” claim, verify each category's license and attribution requirements.
5. If provenance cannot be verified, replace the affected bundled assets with assets generated from a source whose redistribution terms are explicit.
6. Do not erase attribution/history merely to make the repository look cleaner.

## Current recommended migration

Prefer a clean default bundle composed of:
- project-authored assets;
- explicitly redistributable generated avatars;
- user-local custom uploads that never enter the repository.

Keep the current unresolved categories clearly marked until the owner chooses whether to replace/remove them.
