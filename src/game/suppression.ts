/**
 * Converts a near miss into a short defensive reaction window for AI soldiers.
 * The 3.9s floor intentionally crosses the AI's existing under-fire threshold;
 * closer rounds produce a slightly longer reaction without applying damage.
 */
export function getNearMissSuppression(distance: number, radius = 4.5): number {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0) return 0;
  if (distance < 0 || distance >= radius) return 0;
  return 3.9 + 1.1 * (1 - distance / radius);
}


/** Returns a bounded aim-disruption intensity for a bullet passing near the player. */
export function getPlayerSuppressionIntensity(distance: number, radius = 4.5): number {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0) return 0;
  if (distance < 0 || distance >= radius) return 0;
  return 1 - distance / radius;
}
