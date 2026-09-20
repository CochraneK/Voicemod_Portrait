# Status

## State

**Active static browser avatar prototype.**

## Current capabilities

- microphone-reactive avatar animation;
- local-only Web Audio processing;
- no backend / no AI requirement;
- multiple avatar categories;
- local custom avatar/background persistence;
- fullscreen stage;
- GitHub Pages deployment.

## Current validation level

Portable CI covers JavaScript syntax and repository/privacy/provenance contracts. It does not prove microphone permission behavior, real-device animation quality, browser storage quotas, or visual quality.

## Current provenance gate

The repository includes third-party/bundled avatar assets. Their redistribution/commercial-use rights are not treated as globally resolved. See `DATA_PROVENANCE.md`.

This is a **publication/IP gate**, not a code-quality failure.

## Canonical state

Runtime behavior lives in `index.html`, `js/`, and `styles.css`. This file summarizes current operational state.
