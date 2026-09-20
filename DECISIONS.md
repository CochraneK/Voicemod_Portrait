# Decisions

## Local microphone boundary

Microphone input is analyzed with browser Web Audio APIs and is not uploaded or recorded by the application. Any future remote processing requires a separate privacy/security decision.

## Browser persistence

Custom avatars and backgrounds may be retained in browser-local storage/IndexedDB. No server-side account or cloud persistence is implied.

## Asset provenance

A download link or public repository does not imply unrestricted redistribution. Third-party avatar/data assets must be evaluated by source, license, attribution, and intended use. Unresolved provenance remains explicit rather than being silently labeled “open”.

## Pages publication

GitHub Pages publishes the bundled static asset set. Therefore third-party asset provenance is part of the release/publication gate.

## Agent continuity

Git is canonical. AGENTS/HANDOFF/STATUS/DECISIONS preserve cross-agent state without overriding runtime implementation.

## Identity

Repository-facing identity is **CochraneK**.
