# Security and reliability roadmap

This roadmap tracks the hardening work for the Kivu LAN multiplayer server.

## Delivered in the initial hardening pass

- Set a 16 KiB maximum WebSocket message size.
- Enforce a per-connection message-rate ceiling and close clients that exceed it.
- Reject player-state packets containing non-finite values or coordinates outside the supported world envelope.
- Stop accepting client-provided health and faction changes through routine movement snapshots.
- Prevent living players from requesting a respawn and enforce a three-second minimum respawn delay after death.
- Bound damage values, reject hits from dead players and teammates, limit hit frequency per target, and reject claims against targets outside the configured combat envelope.
- Limit rooms to 16 players and throttle repeated room-join attempts per connection.
- Cap concurrent connections per source IP and validate weapon identifiers against the game's known weapon set.
- Validate shot origins/directions, grenade position/velocity, and tactical-order payloads before relaying them.
- Apply per-connection action cooldowns to shooting, grenades, and tactical orders.
- Strictly type-check movement posture/rank/weapon fields and bound hit claims to a 60-unit combat envelope.
- Validate and cap incoming UDP discovery beacons, including room/peer counts, names, identifiers, and ports; restrict discovery to private LAN peers and cap the discovered-host cache.
- Bound JSON request bodies, add baseline HTTP security headers, and expose a lightweight health endpoint.
- Handle WebSocket server/client transport errors explicitly and log them without leaving unhandled error events.
- Throttle lobby-presence updates and LAN discovery scans to prevent probe/broadcast flooding.

## Remaining work (required before public competitive multiplayer)

1. Move hit registration to the server. The current client-reported hit protocol is only constrained, not authoritative; the server still cannot prove line of sight, weapon cadence, ammo, recoil, or collision.
2. Simulate movement and collision on the server, with speed/acceleration envelopes and reconciliation.
3. Complete discriminated schema validation for every WebSocket message, including lobby presence and room joins; reject unknown or malformed payloads.
4. Add reconnect leases and cleanup/expiry for abandoned rooms.
5. Add authenticated room ownership and signed/expiring join tokens for internet-facing deployments.
6. Add integration tests for forged state, invalid payloads, respawn abuse, friendly fire, and combat rate limits.
7. Add observability for rejected packets, disconnect reasons, room lifecycle, and server tick health.

## Operational notes

The current hardening is a compatibility-preserving baseline. Shot and grenade packets are now structurally checked and rate-limited, but hit registration and movement are still client-influenced. The server does not yet simulate weapon cadence/ammunition, line of sight, projectile collisions, or player movement. Do not advertise the current LAN mode as cheat-proof.
