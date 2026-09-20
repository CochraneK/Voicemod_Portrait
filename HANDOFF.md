# Agent Handoff

## Current mission

Keep the microphone-driven portrait experience simple and local-first while making asset provenance and redistribution boundaries explicit.

## What exists now

- static browser app;
- local microphone energy → avatar animation;
- stage 1 / stage 2 motion modes;
- local background color/image controls;
- custom avatar upload/crop/rename/delete in browser storage;
- Voicemod, DiceBear, aiface, and custom avatar categories;
- GitHub Pages deployment.

## Current limitations / gates

- bundled third-party avatar/image provenance is not uniformly verified for redistribution/commercial use;
- the aiface set was generated from a local dataset sample whose redistribution status needs independent verification;
- GitHub Pages serves bundled static assets publicly, so provenance is a publication gate rather than a purely local concern;
- browser CI can check syntax/contracts, but microphone permission, IndexedDB, fullscreen, crop quality and animation still need real-browser validation.

## Immediate next actions

1. Resolve asset provenance category by category before claiming an open/commercial-safe bundle.
2. Prefer generated/licensed-for-redistribution avatar sources for future default assets.
3. Add browser smoke tests for load, category switching, custom uploads and microphone-denied states.
4. Keep microphone processing local unless a new architecture is deliberately approved.
5. Keep Pages workflow Actions pinned.

## Validation

```bash
node --check js/app.js
node --check js/data.js
node --check js/dicebeer-data.js
node --check js/aiface-data.js
python -m unittest discover -s tests -v
```

## Canonical files

`index.html`, `js/app.js`, avatar data files, `styles.css`, `DATA_PROVENANCE.md`, and Pages/quality workflows.
