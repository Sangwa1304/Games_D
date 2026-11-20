# Security and reliability roadmap

This roadmap tracks the hardening work for the Kivu LAN multiplayer server.

## Delivered in the initial hardening pass

- Set a 16 KiB maximum WebSocket message size.
- Enforce a per-connection message-rate ceiling and close clients that exceed it.
- Reject player-state packets containing non-finite values or coordinates outside the supported world envelope.
- Stop accepting client-provided health and faction changes through routine movement snapshots.
- Prevent living players from requesting a respawn and enforce a three-second minimum respawn delay after death.
- Bound damage values, reject hits from dead players and teammates, limit hit frequency per target, and reject claims against targets outside the configured combat envelope.

## Remaining work (required before public competitive multiplayer)

1. Move hit registration to the server. The current client-reported hit protocol is only constrained, not authoritative; the server still cannot prove line of sight, weapon cadence, ammo, recoil, or collision.
2. Simulate movement and collision on the server, with speed/acceleration envelopes and reconciliation.
3. Validate every message against a discriminated schema and reject unknown or malformed payloads.
4. Add room capacity, join throttling, reconnect leases, and per-IP connection limits.
5. Add authenticated room ownership and signed/expiring join tokens for internet-facing deployments.
6. Add integration tests for forged state, invalid payloads, respawn abuse, friendly fire, and combat rate limits.
7. Add observability for rejected packets, disconnect reasons, room lifecycle, and server tick health.

## Operational notes

The current hardening is a compatibility-preserving first pass. It reduces obvious client-side abuse but is not a substitute for server-authoritative simulation. Do not advertise the current LAN mode as cheat-proof.
