# AGENTS.md

## Mission

Voicemod Portrait is a browser-only, microphone-reactive avatar stage. Audio analysis stays local in the browser; the app does not require an AI service or backend.

## Read first

1. `README.md`
2. `HANDOFF.md`
3. `STATUS.md`
4. `DECISIONS.md`
5. `DATA_PROVENANCE.md`
6. `docs/architecture.md`
7. `index.html`
8. `js/app.js`
9. `.github/workflows/`

## Non-negotiable boundaries

- Do not add audio upload, recording, analytics, or remote microphone processing without an explicit privacy design.
- Keep the default static runtime local-only: Web Audio API + browser storage.
- Do not assume bundled avatars or referenced face datasets are open for redistribution/commercial use. Follow `DATA_PROVENANCE.md`.
- Do not describe a third-party dataset as “open” merely because a download link exists.
- Do not silently increase local-storage/IndexedDB retention or add tracking.
- Keep custom-avatar/background imports client-side.
- Pin GitHub Actions to immutable SHAs.
- Repository-facing identity is **CochraneK**.

## Validation

```bash
node --check js/app.js
node --check js/data.js
node --check js/dicebeer-data.js
node --check js/aiface-data.js
python -m unittest discover -s tests -v
```

Visual/microphone behavior still needs a real browser for end-to-end validation.

## Checkpoint rule

Change canonical implementation first, run portable checks, update STATUS/DECISIONS/HANDOFF when state changes, and commit before switching agent/project.
