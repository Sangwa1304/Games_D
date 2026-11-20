export const VALID_WEAPONS = new Set<string>([
  'ak47', 'carbine', 'ak74m', 'fnfal', 'scar_l', 'hk416', 'famas', 'aug', 'galil', 'sg552',
  'sniper', 'm24', 'awm', 'barrett', 'mk20', 'vss', 'bazooka', 'at4', 'flamethrower', 'lpo50',
]);

const MAX_WORLD_COORDINATE = 10000;

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isVector3(value: unknown): value is Vector3Like {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const vector = value as Record<string, unknown>;
  return ['x', 'y', 'z'].every((key) =>
    isFiniteNumber(vector[key]) && Math.abs(vector[key] as number) <= MAX_WORLD_COORDINATE
  );
}

export function isValidDirection(value: unknown): value is Vector3Like {
  if (!isVector3(value)) return false;
  const length = Math.hypot(value.x, value.y, value.z);
  return length >= 0.95 && length <= 1.05;
}

export function distance3(a: Vector3Like, b: Vector3Like): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function isValidPlayerState(msg: Record<string, unknown>): boolean {
  const coordinates = ['x', 'y', 'z'] as const;
  const motion = ['yaw', 'pitch', 'vx', 'vz'] as const;
  const flags = [
    'isCrouching', 'isProne', 'isSprinting', 'isTacSprinting', 'isSliding', 'isDiving',
  ] as const;
  return (
    coordinates.every((key) => isFiniteNumber(msg[key]) && Math.abs(msg[key] as number) <= MAX_WORLD_COORDINATE) &&
    motion.every((key) => isFiniteNumber(msg[key]) && Math.abs(msg[key] as number) <= 1000) &&
    flags.every((key) => typeof msg[key] === 'boolean') &&
    isFiniteNumber(msg.rankLevel) && Number.isInteger(msg.rankLevel) && msg.rankLevel >= 1 && msg.rankLevel <= 7 &&
    typeof msg.weaponId === 'string' && VALID_WEAPONS.has(msg.weaponId)
  );
}
