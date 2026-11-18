import {
  CombatModeId,
  Faction,
  LanPeerPlayer,
  LanRoomSummary,
  NetworkPlayerSnapshot,
  WeaponId,
  WeatherType,
} from './types';

export interface LanCallbacks {
  onJoined: (data: {
    playerId: string;
    roomCode: string;
    combatMode: CombatModeId;
    weather: WeatherType;
    armyTickets: number;
    rebelTickets: number;
    lanIps: string[];
    port: number;
    players: NetworkPlayerSnapshot[];
  }) => void;
  onPlayerJoined: (player: NetworkPlayerSnapshot) => void;
  onPlayerLeft: (id: string) => void;
  onPlayerRespawned: (id: string, faction: Faction) => void;
  onSnapshot: (data: {
    players: NetworkPlayerSnapshot[];
    armyTickets: number;
    rebelTickets: number;
  }) => void;
  onRemoteShoot: (data: {
    id: string;
    faction: Faction;
    weaponId: WeaponId;
    origin: { x: number; y: number; z: number };
    dir: { x: number; y: number; z: number };
  }) => void;
  onRemoteGrenade: (data: {
    id: string;
    faction: Faction;
    kind?: 'frag' | 'smoke';
    pos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
  }) => void;
  onDamaged: (data: {
    damage: number;
    attackerId: string;
    attackerName: string;
    attackerFaction: Faction;
    sourcePos: { x: number; y: number; z: number };
    weaponLabel: string;
    isHeadshot: boolean;
  }) => void;
  onKilled: (data: {
    killerId: string;
    killerName: string;
    killerFaction: Faction;
    victimId: string;
    victimName: string;
    victimFaction: Faction;
    weaponLabel: string;
    isHeadshot: boolean;
    armyTickets: number;
    rebelTickets: number;
  }) => void;
  onWeatherChange: (weather: WeatherType) => void;
  onRemoteOrder: (data: {
    id: string;
    name: string;
    faction: Faction;
    order: string;
  }) => void;
  onDiscoveryUpdate: (data: {
    ips: string[];
    port: number;
    udpActive: boolean;
    udpPort: number;
    rooms: LanRoomSummary[];
    peers: LanPeerPlayer[];
  }) => void;
  onDisconnect: () => void;
}

export class LanMultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: LanCallbacks;
  private reconnectTimer: number | null = null;
  private pendingJoin: {
    roomCode: string;
    name: string;
    faction: Faction;
    combatMode: CombatModeId;
  } | null = null;
  private activeTargetHost: { ip: string; port: number } | null = null;
  private lastPresence: { name: string; faction: Faction } = {
    name: 'Soldat-Kivu',
    faction: 'army',
  };
  private disposed = false;

  public connected = false;
  public selfId: string | null = null;
  public roomCode: string | null = null;
  public lanIps: string[] = [];
  public port = 3000;

  constructor(callbacks: LanCallbacks) {
    this.callbacks = callbacks;
  }

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (this.activeTargetHost && window.location.protocol === 'http:') {
      return `ws://${this.activeTargetHost.ip}:${this.activeTargetHost.port}/ws`;
    }
    return `${proto}//${window.location.host}/ws`;
  }

  public connect(forceReconnect = false) {
    if (this.disposed) return;
    if (forceReconnect && this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
      this.connected = false;
    }
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const ws = new WebSocket(this.getWsUrl());
      this.ws = ws;

      ws.onopen = () => {
        this.connected = true;
        this.send({
          type: 'lobby:presence',
          name: this.lastPresence.name,
          faction: this.lastPresence.faction,
        });
        this.send({ type: 'lan:scan' });
        if (this.pendingJoin) {
          this.send({
            type: 'room:join',
            roomCode: this.pendingJoin.roomCode,
            name: this.pendingJoin.name,
            faction: this.pendingJoin.faction,
            combatMode: this.pendingJoin.combatMode,
          });
        }
      };

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const type = String(msg.type || '');

        if (type === 'lan:discovery' || type === 'rooms:list') {
          this.lanIps = (msg.ips as string[]) || [];
          this.port = Number(msg.port) || 3000;
          this.callbacks.onDiscoveryUpdate({
            ips: this.lanIps,
            port: this.port,
            udpActive: Boolean(msg.udpActive),
            udpPort: Number(msg.udpPort) || 41234,
            rooms: (msg.rooms as LanRoomSummary[]) || [],
            peers: (msg.peers as LanPeerPlayer[]) || [],
          });
        } else if (type === 'room:joined') {
          this.selfId = String(msg.playerId);
          this.roomCode = String(msg.roomCode);
          this.lanIps = (msg.lanIps as string[]) || [];
          this.port = Number(msg.port) || 3000;
          this.callbacks.onJoined({
            playerId: this.selfId,
            roomCode: this.roomCode,
            combatMode: (msg.combatMode as CombatModeId) || 'conquest',
            weather: msg.weather as WeatherType,
            armyTickets: Number(msg.armyTickets) || 120,
            rebelTickets: Number(msg.rebelTickets) || 120,
            lanIps: this.lanIps,
            port: this.port,
            players: (msg.players as NetworkPlayerSnapshot[]) || [],
          });
        } else if (type === 'player:joined') {
          this.callbacks.onPlayerJoined(msg.player as NetworkPlayerSnapshot);
        } else if (type === 'player:left') {
          this.callbacks.onPlayerLeft(String(msg.id));
        } else if (type === 'player:respawned') {
          this.callbacks.onPlayerRespawned(String(msg.id), msg.faction as Faction);
        } else if (type === 'players:snapshot') {
          this.callbacks.onSnapshot({
            players: (msg.players as NetworkPlayerSnapshot[]) || [],
            armyTickets: Number(msg.armyTickets) || 0,
            rebelTickets: Number(msg.rebelTickets) || 0,
          });
        } else if (type === 'remote:shoot') {
          this.callbacks.onRemoteShoot(
            msg as unknown as Parameters<LanCallbacks['onRemoteShoot']>[0]
          );
        } else if (type === 'remote:grenade') {
          this.callbacks.onRemoteGrenade(
            msg as unknown as Parameters<LanCallbacks['onRemoteGrenade']>[0]
          );
        } else if (type === 'player:damaged') {
          this.callbacks.onDamaged(
            msg as unknown as Parameters<LanCallbacks['onDamaged']>[0]
          );
        } else if (type === 'player:killed') {
          this.callbacks.onKilled(
            msg as unknown as Parameters<LanCallbacks['onKilled']>[0]
          );
        } else if (type === 'weather:update') {
          this.callbacks.onWeatherChange(msg.weather as WeatherType);
        } else if (type === 'remote:order') {
          this.callbacks.onRemoteOrder(
            msg as unknown as Parameters<LanCallbacks['onRemoteOrder']>[0]
          );
        }
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.connected = false;
        this.ws = null;
        if (this.roomCode) {
          this.roomCode = null;
          this.callbacks.onDisconnect();
        }
        if (!this.disposed && this.reconnectTimer === null) {
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 2200);
        }
      };

      ws.onerror = () => {
        // Handled cleanly by onclose reconnect loop
      };
    } catch {
      // Ignore WebSocket construction failures when offline
    }
  }

  private send(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public updatePresence(name: string, faction: Faction) {
    const clean = name.trim().slice(0, 18) || 'Soldat-Kivu';
    this.lastPresence = { name: clean, faction };
    this.send({ type: 'lobby:presence', name: clean, faction });
  }

  public requestRooms() {
    this.connect();
    this.send({ type: 'lan:scan' });
  }

  public joinRoom(
    roomCode: string,
    name: string,
    faction: Faction,
    combatMode: CombatModeId = 'conquest',
    targetHost?: { ip: string; port: number } | null
  ) {
    this.pendingJoin = { roomCode, name, faction, combatMode };
    this.lastPresence = { name: name.trim().slice(0, 18) || 'Soldat-Kivu', faction };

    if (
      targetHost &&
      window.location.protocol === 'http:' &&
      (targetHost.ip !== window.location.hostname ||
        String(targetHost.port) !== (window.location.port || '80'))
    ) {
      this.activeTargetHost = targetHost;
      this.connect(true);
      return;
    }

    this.connect();
    this.send({ type: 'room:join', roomCode, name, faction, combatMode });
  }

  public leaveRoom() {
    this.pendingJoin = null;
    this.roomCode = null;
    this.selfId = null;
    this.send({ type: 'room:leave' });
    if (this.activeTargetHost) {
      this.activeTargetHost = null;
      this.connect(true);
    }
  }

  public sendState(state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    vx: number;
    vz: number;
    weaponId: WeaponId;
    faction: Faction;
    rankLevel: number;
    hp: number;
    isCrouching: boolean;
    isProne: boolean;
    isSprinting: boolean;
    isTacSprinting: boolean;
    isSliding: boolean;
    isDiving: boolean;
  }) {
    if (!this.roomCode) return;
    this.send({ type: 'player:state', ...state });
  }

  public sendShoot(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    weaponId: WeaponId
  ) {
    if (!this.roomCode) return;
    this.send({ type: 'player:shoot', origin, dir, weaponId });
  }

  public sendGrenade(
    pos: { x: number; y: number; z: number },
    vel: { x: number; y: number; z: number },
    kind: 'frag' | 'smoke' = 'frag'
  ) {
    if (!this.roomCode) return;
    this.send({ type: 'player:grenade', pos, vel, kind });
  }

  public sendHit(
    targetId: string,
    damage: number,
    isHeadshot: boolean,
    weaponLabel: string
  ) {
    if (!this.roomCode) return;
    this.send({ type: 'player:hit', targetId, damage, isHeadshot, weaponLabel });
  }

  public sendRespawn(faction: Faction) {
    if (!this.roomCode) return;
    this.send({ type: 'player:respawn', faction });
  }

  public sendOrder(order: string, target: { x: number; y: number; z: number }) {
    if (!this.roomCode) return;
    this.send({ type: 'player:order', order, target });
  }

  public dispose() {
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
