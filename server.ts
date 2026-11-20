import crypto from 'crypto';
import dgram from 'dgram';
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

type Faction = 'army' | 'rebels';
type WeaponId = string;
type WeatherType = 'clear' | 'mist' | 'rain' | 'storm';

const MAX_WS_PAYLOAD_BYTES = 16 * 1024;
const MAX_MESSAGES_PER_SECOND = 120;
const MAX_WORLD_COORDINATE = 10000;
const MAX_HIT_DISTANCE = 60;
const MAX_ROOM_PLAYERS = 16;
const MAX_CONNECTIONS_PER_IP = 8;
const MIN_JOIN_INTERVAL_MS = 1000;
const RESPAWN_DELAY_MS = 3000;
const VALID_WEAPONS = new Set([
  'ak47', 'carbine', 'ak74m', 'fnfal', 'scar_l', 'hk416', 'famas', 'aug', 'galil', 'sg552',
  'sniper', 'm24', 'awm', 'barrett', 'mk20', 'vss', 'bazooka', 'at4', 'flamethrower', 'lpo50',
]);

function isVector3(value: unknown): value is { x: number; y: number; z: number } {
  if (!value || typeof value !== 'object') return false;
  const vector = value as Record<string, unknown>;
  return ['x', 'y', 'z'].every((key) =>
    isFiniteNumber(vector[key]) && Math.abs(vector[key] as number) <= MAX_WORLD_COORDINATE
  );
}

function isValidDirection(value: unknown): value is { x: number; y: number; z: number } {
  if (!isVector3(value)) return false;
  const length = Math.hypot(value.x, value.y, value.z);
  return length >= 0.95 && length <= 1.05;
}

function distance3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPlayerState(msg: Record<string, unknown>): boolean {
  const coordinates = ['x', 'y', 'z'] as const;
  const motion = ['yaw', 'pitch', 'vx', 'vz'] as const;
  const flags = [
    'isCrouching', 'isProne', 'isSprinting', 'isTacSprinting', 'isSliding', 'isDiving',
  ] as const;
  return (
    coordinates.every((key) => isFiniteNumber(msg[key]) && Math.abs(msg[key] as number) <= MAX_WORLD_COORDINATE) &&
    motion.every((key) => isFiniteNumber(msg[key]) && Math.abs(msg[key] as number) <= 1000) &&
    flags.every((key) => typeof msg[key] === 'boolean') &&
    isFiniteNumber(msg.rankLevel) && msg.rankLevel >= 1 && msg.rankLevel <= 7 &&
    typeof msg.weaponId === 'string' && VALID_WEAPONS.has(msg.weaponId)
  );
}
type CombatModeId = 'conquest' | 'domination' | 'tdm' | 'assault' | 'cqc' | 'sniper';

const VALID_MODES: CombatModeId[] = ['conquest', 'domination', 'tdm', 'assault', 'cqc', 'sniper'];
function sanitizeCombatMode(raw: unknown): CombatModeId {
  return VALID_MODES.includes(raw as CombatModeId) ? (raw as CombatModeId) : 'conquest';
}

const WEATHER_LIST: WeatherType[] = ['clear', 'mist', 'rain', 'storm'];
const UDP_DISCOVERY_PORT = Number(process.env.KIVU_UDP_PORT || 41234);
const UDP_MULTICAST_GROUP = '239.255.77.88';
const DISCOVERY_MAGIC = 'KIVU_LAN_V1';
const INSTANCE_ID = `srv_${crypto.randomBytes(4).toString('hex')}`;

function pickRandomWeather(exclude?: WeatherType): WeatherType {
  const pool = exclude ? WEATHER_LIST.filter((w) => w !== exclude) : WEATHER_LIST;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface RoomPlayer {
  id: string;
  name: string;
  faction: Faction;
  rankLevel: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  weaponId: WeaponId;
  hp: number;
  alive: boolean;
  deathAt: number | null;
  isCrouching: boolean;
  isProne: boolean;
  isSprinting: boolean;
  isTacSprinting: boolean;
  isSliding: boolean;
  isDiving: boolean;
  kills: number;
  deaths: number;
  lastSeen: number;
}

interface LanRoom {
  code: string;
  hostId: string;
  hostName: string;
  combatMode: CombatModeId;
  weather: WeatherType;
  weatherNextChangeAt: number;
  armyTickets: number;
  rebelTickets: number;
  players: Map<string, RoomPlayer>;
  sockets: Map<string, WebSocket>;
}

interface LobbyClient {
  id: string;
  ws: WebSocket;
  name: string;
  faction: Faction;
  ip: string;
  status: 'lobby' | 'playing';
  roomCode: string | null;
}

interface RoomSummaryPayload {
  code: string;
  hostName: string;
  playerCount: number;
  armyCount: number;
  rebelCount: number;
  weather: WeatherType;
  combatMode: CombatModeId;
  hostIp: string;
  port: number;
  isRemoteHost: boolean;
  playerNames: string[];
}

interface PeerPlayerPayload {
  id: string;
  name: string;
  faction: Faction;
  ip: string;
  status: 'lobby' | 'playing';
  roomCode: string | null;
  hostIp: string;
  port: number;
  isRemoteHost: boolean;
}

interface DiscoveredUdpHost {
  instanceId: string;
  ip: string;
  port: number;
  hostLabel: string;
  rooms: RoomSummaryPayload[];
  peers: PeerPlayerPayload[];
  lastSeen: number;
}

const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rooms = new Map<string, LanRoom>();
const allClients = new Map<string, LobbyClient>();
const discoveredUdpHosts = new Map<string, DiscoveredUdpHost>();
let udpDiscoveryActive = false;

function getLocalWifiIps(): string[] {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        ips.push(info.address);
      }
    }
  }
  return ips;
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return 0;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function intToIpv4(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

function getUdpBroadcastTargets(): string[] {
  const targets = new Set<string>(['255.255.255.255', UDP_MULTICAST_GROUP]);
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal && info.netmask) {
        const ipInt = ipv4ToInt(info.address);
        const maskInt = ipv4ToInt(info.netmask);
        if (ipInt && maskInt) {
          const bcast = (ipInt | (~maskInt >>> 0)) >>> 0;
          targets.add(intToIpv4(bcast));
        }
      }
    }
  }
  return Array.from(targets);
}

function normalizeRemoteIp(raw: string | undefined): string {
  if (!raw) return '127.0.0.1';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

function getPrimaryHostIp(): string {
  return getLocalWifiIps()[0] || '127.0.0.1';
}

function getOrCreateRoom(
  rawCode: string,
  hostId: string,
  hostName: string,
  combatMode: CombatModeId
): LanRoom {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || 'KIVU-LAN';
  let room = rooms.get(code);
  if (!room) {
    const startTickets =
      combatMode === 'conquest' ? 160 : combatMode === 'assault' ? 140 : combatMode === 'tdm' ? 45 : 120;
    room = {
      code,
      hostId,
      hostName,
      combatMode,
      weather: pickRandomWeather(),
      weatherNextChangeAt: Date.now() + (38000 + Math.random() * 24000),
      armyTickets: startTickets,
      rebelTickets: startTickets,
      players: new Map(),
      sockets: new Map(),
    };
    rooms.set(code, room);
  }
  return room;
}

function broadcastRoom(room: LanRoom, payload: unknown, excludeId?: string) {
  const msg = JSON.stringify(payload);
  for (const [pid, sock] of room.sockets.entries()) {
    if (pid === excludeId) continue;
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(msg);
    }
  }
}

function serializeLocalRoomSummaries(): RoomSummaryPayload[] {
  const hostIp = getPrimaryHostIp();
  const list: RoomSummaryPayload[] = [];
  for (const r of rooms.values()) {
    let armyCount = 0;
    let rebelCount = 0;
    const playerNames: string[] = [];
    for (const p of r.players.values()) {
      if (p.faction === 'army') armyCount++;
      else rebelCount++;
      playerNames.push(p.name);
    }
    list.push({
      code: r.code,
      hostName: r.hostName,
      playerCount: r.players.size,
      armyCount,
      rebelCount,
      weather: r.weather,
      combatMode: r.combatMode,
      hostIp,
      port: PORT,
      isRemoteHost: false,
      playerNames,
    });
  }
  return list;
}

function serializeLocalPeers(): PeerPlayerPayload[] {
  const hostIp = getPrimaryHostIp();
  const list: PeerPlayerPayload[] = [];
  for (const c of allClients.values()) {
    list.push({
      id: c.id,
      name: c.name,
      faction: c.faction,
      ip: c.ip === '::1' || c.ip === '127.0.0.1' ? hostIp : c.ip,
      status: c.status,
      roomCode: c.roomCode,
      hostIp,
      port: PORT,
      isRemoteHost: false,
    });
  }
  return list;
}

function getCombinedDiscovery() {
  const localRooms = serializeLocalRoomSummaries();
  const localPeers = serializeLocalPeers();

  const mergedRooms: RoomSummaryPayload[] = [...localRooms];
  const mergedPeers: PeerPlayerPayload[] = [...localPeers];

  for (const host of discoveredUdpHosts.values()) {
    for (const r of host.rooms) {
      mergedRooms.push({
        ...r,
        hostIp: host.ip,
        port: host.port,
        isRemoteHost: true,
      });
    }
    for (const p of host.peers) {
      mergedPeers.push({
        ...p,
        hostIp: host.ip,
        port: host.port,
        isRemoteHost: true,
      });
    }
  }

  return {
    ips: getLocalWifiIps(),
    port: PORT,
    udpActive: udpDiscoveryActive,
    udpPort: UDP_DISCOVERY_PORT,
    rooms: mergedRooms,
    peers: mergedPeers,
  };
}

function pushDiscoveryToAllClients() {
  const payload = JSON.stringify({
    type: 'lan:discovery',
    ...getCombinedDiscovery(),
  });
  for (const client of allClients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb', strict: true }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', rooms: rooms.size, clients: allClients.size, udpDiscoveryActive });
  });

  app.get('/api/lan-info', (_req, res) => {
    res.json(getCombinedDiscovery());
  });

  app.get('/api/rooms', (_req, res) => {
    const info = getCombinedDiscovery();
    res.json({ rooms: info.rooms, peers: info.peers, udpActive: info.udpActive });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_WS_PAYLOAD_BYTES });

  // UDP Broadcast + Multicast LAN Auto-Discovery Socket
  const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  const sendUdpPacket = (kind: 'beacon' | 'probe', targetIp?: string) => {
    if (!udpDiscoveryActive) return;
    const packet = Buffer.from(
      JSON.stringify({
        magic: DISCOVERY_MAGIC,
        kind,
        instanceId: INSTANCE_ID,
        port: PORT,
        primaryIp: getPrimaryHostIp(),
        hostLabel: os.hostname(),
        rooms: serializeLocalRoomSummaries(),
        peers: serializeLocalPeers(),
        ts: Date.now(),
      })
    );
    if (targetIp) {
      udpSocket.send(packet, 0, packet.length, UDP_DISCOVERY_PORT, targetIp, () => {
        // Ignore transient per-NIC send errors
      });
      return;
    }
    for (const addr of getUdpBroadcastTargets()) {
      udpSocket.send(packet, 0, packet.length, UDP_DISCOVERY_PORT, addr, () => {
        // Ignore transient per-NIC send errors
      });
    }
  };

  udpSocket.on('error', (err) => {
    console.warn('UDP LAN Discovery disabled:', err.message);
    udpDiscoveryActive = false;
  });

  udpSocket.on('message', (buf, rinfo) => {
    try {
      const msg = JSON.parse(buf.toString('utf8')) as {
        magic?: string;
        kind?: 'beacon' | 'probe';
        instanceId?: string;
        port?: number;
        primaryIp?: string;
        hostLabel?: string;
        rooms?: RoomSummaryPayload[];
        peers?: PeerPlayerPayload[];
      };
      if (msg.magic !== DISCOVERY_MAGIC || !msg.instanceId || msg.instanceId === INSTANCE_ID) {
        return;
      }

      const senderIp = normalizeRemoteIp(rinfo.address) || msg.primaryIp || '127.0.0.1';
      if (msg.kind === 'probe') {
        sendUdpPacket('beacon', senderIp);
      }

      const prev = discoveredUdpHosts.get(msg.instanceId);
      const nextHost: DiscoveredUdpHost = {
        instanceId: msg.instanceId,
        ip: senderIp,
        port: Number(msg.port) || 3000,
        hostLabel: String(msg.hostLabel || senderIp),
        rooms: Array.isArray(msg.rooms) ? msg.rooms : [],
        peers: Array.isArray(msg.peers) ? msg.peers : [],
        lastSeen: Date.now(),
      };
      const prevSig = prev ? JSON.stringify({ r: prev.rooms, p: prev.peers }) : '';
      const nextSig = JSON.stringify({ r: nextHost.rooms, p: nextHost.peers });
      discoveredUdpHosts.set(msg.instanceId, nextHost);

      if (prevSig !== nextSig) {
        pushDiscoveryToAllClients();
      }
    } catch {
      // Ignore malformed non-Kivu UDP packets on the same port
    }
  });

  udpSocket.bind(UDP_DISCOVERY_PORT, '0.0.0.0', () => {
    udpDiscoveryActive = true;
    try {
      udpSocket.setBroadcast(true);
    } catch {
      // Ignore if unsupported
    }
    try {
      udpSocket.setMulticastTTL(2);
      udpSocket.addMembership(UDP_MULTICAST_GROUP);
    } catch {
      // Ignore if multicast membership unavailable on current NIC
    }
    sendUdpPacket('probe');
    console.log(`UDP LAN Auto-Discovery listening on port ${UDP_DISCOVERY_PORT}`);
  });

  // Periodic UDP broadcast + TTL expiration every 1.5s
  setInterval(() => {
    const now = Date.now();
    let pruned = false;
    for (const [id, host] of discoveredUdpHosts.entries()) {
      if (now - host.lastSeen > 6500) {
        discoveredUdpHosts.delete(id);
        pruned = true;
      }
    }
    if (pruned) {
      pushDiscoveryToAllClients();
    }
    sendUdpPacket('beacon');
  }, 1500);

  let nextClientSeq = 1;

  wss.on('connection', (ws: WebSocket, req) => {
    const clientSeq = nextClientSeq++;
    const clientId = `p_${Date.now().toString(36)}_${clientSeq}`;
    const clientIp = normalizeRemoteIp(req.socket.remoteAddress);
    const existingConnectionsFromIp = Array.from(allClients.values()).filter((client) => client.ip === clientIp).length;
    if (existingConnectionsFromIp >= MAX_CONNECTIONS_PER_IP) {
      ws.close(1008, 'Connection limit exceeded');
      return;
    }
    let currentRoom: LanRoom | null = null;
    let messageWindowStartedAt = Date.now();
    let messageCountInWindow = 0;
    let lastJoinAt = 0;
    const lastHitAtByTarget = new Map<string, number>();
    const lastActionAt = new Map<string, number>();
    const canAct = (action: string, intervalMs: number) => {
      const previous = lastActionAt.get(action) || 0;
      if (Date.now() - previous < intervalMs) return false;
      lastActionAt.set(action, Date.now());
      return true;
    };

    const lobbyClient: LobbyClient = {
      id: clientId,
      ws,
      name: `Soldat-${clientSeq}`,
      faction: 'army',
      ip: clientIp,
      status: 'lobby',
      roomCode: null,
    };
    allClients.set(clientId, lobbyClient);

    const sendSelf = (payload: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    const leaveCurrentRoom = () => {
      if (!currentRoom) return;
      const room = currentRoom;
      currentRoom = null;
      lobbyClient.status = 'lobby';
      lobbyClient.roomCode = null;
      room.sockets.delete(clientId);
      const removed = room.players.delete(clientId);
      if (removed) {
        broadcastRoom(room, { type: 'player:left', id: clientId });
      }
      if (room.players.size === 0) {
        rooms.delete(room.code);
      } else if (room.hostId === clientId) {
        const nextHost = room.players.values().next().value;
        if (nextHost) {
          room.hostId = nextHost.id;
          room.hostName = nextHost.name;
        }
      }
      pushDiscoveryToAllClients();
      sendUdpPacket('beacon');
    };

    // Immediately announce network state & probe UDP peers upon client connection
    sendUdpPacket('probe');
    pushDiscoveryToAllClients();

    ws.on('message', (raw) => {
      const now = Date.now();
      if (now - messageWindowStartedAt >= 1000) {
        messageWindowStartedAt = now;
        messageCountInWindow = 0;
      }
      messageCountInWindow += 1;
      if (messageCountInWindow > MAX_MESSAGES_PER_SECOND) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'lobby:presence') {
        const nextName =
          typeof msg.name === 'string' && msg.name.trim().length > 0
            ? msg.name.trim().slice(0, 18)
            : lobbyClient.name;
        const nextFaction: Faction = msg.faction === 'rebels' ? 'rebels' : 'army';
        if (lobbyClient.name !== nextName || lobbyClient.faction !== nextFaction) {
          lobbyClient.name = nextName;
          lobbyClient.faction = nextFaction;
          pushDiscoveryToAllClients();
          sendUdpPacket('beacon');
        }
        return;
      }

      if (type === 'rooms:list' || type === 'lan:scan') {
        sendUdpPacket('probe');
        sendSelf({
          type: 'lan:discovery',
          ...getCombinedDiscovery(),
        });
        return;
      }

      if (type === 'room:join') {
        if (Date.now() - lastJoinAt < MIN_JOIN_INTERVAL_MS) {
          sendSelf({ type: 'network:error', code: 'JOIN_RATE_LIMIT', message: 'Réessayez dans un instant.' });
          return;
        }
        lastJoinAt = Date.now();
        leaveCurrentRoom();
        const rawCode = typeof msg.roomCode === 'string' ? msg.roomCode : 'KIVU-LAN';
        const playerName =
          typeof msg.name === 'string' && msg.name.trim().length > 0
            ? msg.name.trim().slice(0, 18)
            : lobbyClient.name;
        const faction: Faction = msg.faction === 'rebels' ? 'rebels' : 'army';
        const requestedMode = sanitizeCombatMode(msg.combatMode);
        const room = getOrCreateRoom(rawCode, clientId, playerName, requestedMode);
        if (room.players.size >= MAX_ROOM_PLAYERS) {
          if (room.players.size === 0) rooms.delete(room.code);
          sendSelf({ type: 'network:error', code: 'ROOM_FULL', message: 'Cette salle est complète.' });
          return;
        }
        currentRoom = room;

        lobbyClient.name = playerName;
        lobbyClient.faction = faction;
        lobbyClient.status = 'playing';
        lobbyClient.roomCode = room.code;

        const spawnZ =
          room.combatMode === 'cqc' ? (faction === 'army' ? 38 : -38) : faction === 'army' ? 102 : -102;
        const spawnX = (Math.random() - 0.5) * 14;
        const player: RoomPlayer = {
          id: clientId,
          name: playerName,
          faction,
          rankLevel: 3,
          x: spawnX,
          y: 5.5,
          z: spawnZ,
          yaw: faction === 'army' ? 0 : Math.PI,
          pitch: 0,
          vx: 0,
          vz: 0,
          weaponId: faction === 'army' ? 'carbine' : 'ak47',
          hp: 100,
          alive: true,
          deathAt: null,
          isCrouching: false,
          isProne: false,
          isSprinting: false,
          isTacSprinting: false,
          isSliding: false,
          isDiving: false,
          kills: 0,
          deaths: 0,
          lastSeen: Date.now(),
        };

        room.players.set(clientId, player);
        room.sockets.set(clientId, ws);

        sendSelf({
          type: 'room:joined',
          playerId: clientId,
          roomCode: room.code,
          combatMode: room.combatMode,
          weather: room.weather,
          armyTickets: room.armyTickets,
          rebelTickets: room.rebelTickets,
          lanIps: getLocalWifiIps(),
          port: PORT,
          players: Array.from(room.players.values()),
        });

        broadcastRoom(room, { type: 'player:joined', player }, clientId);
        pushDiscoveryToAllClients();
        sendUdpPacket('beacon');
        return;
      }

      if (type === 'room:leave') {
        leaveCurrentRoom();
        return;
      }

      if (!currentRoom) return;
      const sender = currentRoom.players.get(clientId);
      if (!sender) return;
      sender.lastSeen = Date.now();

      if (type === 'player:state') {
        if (!isValidPlayerState(msg)) return;
        sender.x = msg.x as number;
        sender.y = msg.y as number;
        sender.z = msg.z as number;
        sender.yaw = msg.yaw as number;
        sender.pitch = msg.pitch as number;
        sender.vx = msg.vx as number;
        sender.vz = msg.vz as number;
        if (typeof msg.weaponId === 'string' && VALID_WEAPONS.has(msg.weaponId)) {
          sender.weaponId = msg.weaponId;
        }
        sender.rankLevel = Math.max(1, Math.min(7, Number(msg.rankLevel) || sender.rankLevel));
        sender.isCrouching = Boolean(msg.isCrouching);
        sender.isProne = Boolean(msg.isProne);
        sender.isSprinting = Boolean(msg.isSprinting);
        sender.isTacSprinting = Boolean(msg.isTacSprinting);
        sender.isSliding = Boolean(msg.isSliding);
        sender.isDiving = Boolean(msg.isDiving);
        return;
      }

      if (type === 'player:respawn') {
        if (sender.alive || sender.deathAt === null || Date.now() - sender.deathAt < RESPAWN_DELAY_MS) {
          return;
        }
        sender.hp = 100;
        sender.alive = true;
        sender.deathAt = null;
        broadcastRoom(
          currentRoom,
          { type: 'player:respawned', id: clientId, faction: sender.faction },
          clientId
        );
        return;
      }

      if (type === 'player:shoot') {
        if (
          !sender.alive ||
          !canAct('shoot', 60) ||
          typeof msg.weaponId !== 'string' ||
          !VALID_WEAPONS.has(msg.weaponId) ||
          !isVector3(msg.origin) ||
          !isValidDirection(msg.dir) ||
          distance3(msg.origin, sender) > 8
        ) return;
        broadcastRoom(
          currentRoom,
          {
            type: 'remote:shoot',
            id: clientId,
            faction: sender.faction,
            weaponId: msg.weaponId,
            origin: msg.origin,
            dir: msg.dir,
          },
          clientId
        );
        return;
      }

      if (type === 'player:grenade') {
        if (
          !sender.alive ||
          !canAct('grenade', 350) ||
          !isVector3(msg.pos) ||
          !isVector3(msg.vel) ||
          distance3(msg.pos, sender) > 8 ||
          Math.hypot(msg.vel.x, msg.vel.y, msg.vel.z) > 45
        ) return;
        broadcastRoom(
          currentRoom,
          {
            type: 'remote:grenade',
            id: clientId,
            faction: sender.faction,
            kind: msg.kind === 'smoke' ? 'smoke' : 'frag',
            pos: msg.pos,
            vel: msg.vel,
          },
          clientId
        );
        return;
      }

      if (type === 'player:hit') {
        // Transitional validation: final authority must move to server-side world raycasts.
        const targetId = typeof msg.targetId === 'string' ? msg.targetId : '';
        const dmg = isFiniteNumber(msg.damage) ? Math.max(0, Math.min(100, msg.damage)) : 0;
        if (typeof msg.isHeadshot !== 'boolean') return;
        if (typeof msg.weaponLabel !== 'string' || msg.weaponLabel.length > 48) return;
        const isHeadshot = msg.isHeadshot;
        const weaponLabel = msg.weaponLabel || 'Tir';
        const target = currentRoom.players.get(targetId);
        const now = Date.now();
        const lastHitAt = lastHitAtByTarget.get(targetId) || 0;
        const distance = target
          ? Math.hypot(target.x - sender.x, target.y - sender.y, target.z - sender.z)
          : Infinity;
        if (
          !sender.alive ||
          !target ||
          !target.alive ||
          target.faction === sender.faction ||
          dmg <= 0 ||
          now - lastHitAt < 100 ||
          distance > MAX_HIT_DISTANCE
        ) return;

        lastHitAtByTarget.set(targetId, now);
        target.hp = Math.max(0, target.hp - dmg);
        const targetSocket = currentRoom.sockets.get(targetId);
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(
            JSON.stringify({
              type: 'player:damaged',
              damage: dmg,
              attackerId: clientId,
              attackerName: sender.name,
              attackerFaction: sender.faction,
              sourcePos: { x: sender.x, y: sender.y, z: sender.z },
              weaponLabel,
              isHeadshot,
            })
          );
        }

        if (target.hp <= 0) {
          target.alive = false;
          target.deathAt = Date.now();
          target.deaths++;
          sender.kills++;
          if (target.faction === 'army') {
            currentRoom.armyTickets = Math.max(0, currentRoom.armyTickets - 1);
          } else {
            currentRoom.rebelTickets = Math.max(0, currentRoom.rebelTickets - 1);
          }

          broadcastRoom(currentRoom, {
            type: 'player:killed',
            killerId: sender.id,
            killerName: sender.name,
            killerFaction: sender.faction,
            victimId: target.id,
            victimName: target.name,
            victimFaction: target.faction,
            weaponLabel,
            isHeadshot,
            armyTickets: currentRoom.armyTickets,
            rebelTickets: currentRoom.rebelTickets,
          });
        }
        return;
      }


      if (type === 'player:order') {
        if (
          !sender.alive ||
          !canAct('order', 500) ||
          typeof msg.order !== 'string' ||
          msg.order.length > 32 ||
          !isVector3(msg.target)
        ) return;
        broadcastRoom(
          currentRoom,
          {
            type: 'remote:order',
            id: clientId,
            name: sender.name,
            faction: sender.faction,
            order: msg.order,
            target: msg.target,
          },
          clientId
        );
      }
    });

    ws.on('close', () => {
      allClients.delete(clientId);
      leaveCurrentRoom();
      pushDiscoveryToAllClients();
      sendUdpPacket('beacon');
    });
  });

  // 20 Hz state snapshot broadcast + random server-authoritative weather rotation
  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.players.size === 0) continue;

      if (now >= room.weatherNextChangeAt) {
        room.weather = pickRandomWeather(room.weather);
        room.weatherNextChangeAt = now + (38000 + Math.random() * 24000);
        broadcastRoom(room, {
          type: 'weather:update',
          weather: room.weather,
        });
      }

      const snapshot = Array.from(room.players.values());
      broadcastRoom(room, {
        type: 'players:snapshot',
        players: snapshot,
        armyTickets: room.armyTickets,
        rebelTickets: room.rebelTickets,
      });
    }
  }, 50);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalWifiIps();
    console.log(`Kivu LAN Server running on http://0.0.0.0:${PORT}`);
    if (ips.length > 0) {
      console.log(`Wi-Fi LAN URLs: ${ips.map((ip) => `http://${ip}:${PORT}`).join(', ')}`);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
