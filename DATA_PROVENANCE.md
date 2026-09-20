# Asset & Dataset Provenance

This repository mixes code written for this project with avatar/image sources that have different provenance.

**Do not assume every bundled image is open-source or commercially redistributable.**

| Category | Current source / description | Current repository treatment | Release status |
|---|---|---|---|
| `custom` | User-provided local images + a small bundled default set | Browser-local import; bundled defaults need their own provenance | Verify bundled defaults |
| `dicebeer` | DiceBear-generated avatars | Generated assets; source/license/attribution should be retained | Verify generated style license/attribution |
| `voicemod` | Avatar material associated with Voicemod | Third-party branded/source material | **Unresolved redistribution gate** |
| `aiface` | Sample generated from a local dataset labelled `黄种人-FFHQ` | 300 derived PNG avatars are currently bundled | **Unresolved dataset/derivative redistribution gate** |

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
