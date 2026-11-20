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
- Restrict tactical-order identifiers to the supported command set and apply a global per-player hit-claim rate limit.
- Extract packet-validation primitives into a pure module and cover malformed vectors, player snapshots, and direction vectors with automated unit tests.

## Gameplay expansion delivered in this pass

- Added five deterministic soldier specializations: assault, support, marksman, anti-armor, and combat medic.
- Assigned faction-specific weapon pools and class-specific health, movement, and tactical roles.
- Added autonomous medic field treatment: living medics periodically restore health to the nearest wounded ally within support range; they do not revive eliminated soldiers.

## Remaining work (required before public competitive multiplayer)

1. Move hit registration to the server. The current client-reported hit protocol is only constrained, not authoritative; the server still cannot prove line of sight, weapon cadence, ammo, recoil, or collision.
2. Simulate movement and collision on the server, with speed/acceleration envelopes and reconciliation.
3. Complete discriminated schema validation for every WebSocket message, including lobby presence and room joins; reject unknown or malformed payloads.
4. Add reconnect leases and cleanup/expiry for abandoned rooms.
5. Add authenticated room ownership and signed/expiring join tokens for internet-facing deployments.
6. Expand automated coverage to full WebSocket integration tests for forged state, respawn abuse, friendly fire, room limits, and combat rate limits.
7. Add observability for rejected packets, disconnect reasons, room lifecycle, and server tick health.

## Recommended server-authoritative migration

The next phase should be implemented in this order to avoid breaking LAN compatibility:

1. **Version the protocol.** Add a protocol version to room join and reject incompatible clients with a clear error.
2. **Make spawn authoritative.** Return the server-selected spawn transform in `room:joined` and apply it to the local player before the first state update. The current client join callback does not apply the server's spawn coordinates, so movement authority cannot be switched on safely yet.
3. **Replace pose uploads with input intents.** Clients send bounded movement inputs and aim intent; the server advances movement at a fixed tick and publishes authoritative snapshots. Add client prediction/reconciliation only after the server pose is stable.
4. **Share static collision data.** Extract deterministic collider definitions from the world builder into a representation usable by both the browser and Node server. Do not try to run the Three.js rendering scene on the server.
5. **Authorize weapons and shots.** Store server-side loadouts, ammo, reload state, and weapon fire intervals. A fire request should contain intent only; the server derives the muzzle origin from the authoritative player pose and performs ray/capsule and line-of-sight tests.
6. **Simulate explosives on the server.** Own grenade trajectories, fuse timing, blast radius, and damage server-side. Remove the client-reported `player:hit` path once equivalent authoritative explosion and flame damage exists.
7. **Retire compatibility paths.** After supported clients have migrated, reject legacy `player:state` and `player:hit` messages rather than keeping two competing authorities.

## Remaining gameplay expansion

- Build a full solo campaign with authored missions, progression, and persistent save data.
- Add extraction and escort modes with dedicated objective actors, extraction zones, timers, and victory conditions.
- Expand class-specific squad formations, suppression visual feedback, and sourced realistic audio/photogrammetry assets.

## Operational notes

The current hardening is a compatibility-preserving baseline. Shot and grenade packets are now structurally checked and rate-limited, but hit registration and movement are still client-influenced. The server does not yet simulate weapon cadence/ammunition, line of sight, projectile collisions, or player movement. Do not advertise the current LAN mode as cheat-proof.
