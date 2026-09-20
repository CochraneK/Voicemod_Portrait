# Architecture

```mermaid
flowchart LR
  M[Microphone] --> W[Web Audio analyser]
  W --> E[Local energy / state]
  E --> A[Avatar animation]
  L[Bundled avatar library] --> A
  U[Local custom avatar] --> I[Browser storage]
  I --> A
  B[Local background image] --> D[IndexedDB]
  D --> A
```

## Privacy boundary

```mermaid
flowchart TB
  MIC[Microphone stream] --> BROWSER[Browser]
  BROWSER --> VIS[Animation state]
  MIC -. not uploaded .-> NET[Network service]
  CUSTOM[Custom images] --> LOCAL[Browser storage]
  LOCAL -. not server-synced .-> NET
```

## Publication boundary

GitHub Pages publishes tracked static assets. That makes image provenance/licensing part of the release surface even though microphone processing itself stays local.

See `DATA_PROVENANCE.md`.
