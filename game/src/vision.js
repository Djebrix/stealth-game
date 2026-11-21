// vision.js — one question, asked for every guard every step: "can this guard see the
// player right now, and how fast does suspicion rise?" Range shrinks when the player
// sneaks or stands in shadow, grows when the player runs; the cone and the walls decide
// the rest.
import { GUARD, TILE } from './config.js';
import { hasLineOfSight, isShadowTile, blocksSight } from './level.js';

export function effectiveViewRange(playerSneaking, playerRunning, playerInShadow) {
  let range = GUARD.viewRange;
  if (playerSneaking) range *= 0.62;
  if (playerRunning) range *= 1.18;
  if (playerInShadow) range *= 0.55;
  return range;
}

// Returns { seen, distance, range } — seen is false outside the cone, beyond range, or
// behind a wall or tall shelf.
export function guardSeesPlayer(level, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  const range = effectiveViewRange(player.sneaking, player.running, player.inShadow);
  if (distance > range) return { seen: false, distance, range };
  const angleToPlayer = Math.atan2(dy, dx);
  let diff = angleToPlayer - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > GUARD.viewHalfAngle) return { seen: false, distance, range };
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) {
    return { seen: false, distance, range };
  }
  return { seen: true, distance, range };
}

// Suspicion gained per second while seen: close and in the open is fast, far or half-hidden
// is slow enough to duck back behind cover.
export function suspicionRisePerSecond(distance, range) {
  const closeness = 1 - distance / range; // 1 at touching, 0 at the edge of sight
  return GUARD.riseFarPerSecond + (GUARD.riseNearPerSecond - GUARD.riseFarPerSecond) * closeness;
}

// The cone polygon the renderer draws: the arc clipped by walls, so the lit floor is
// exactly the floor the guard can actually see.
export function conePolygon(level, guard, range) {
  const rays = 26;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.facing - GUARD.viewHalfAngle + (2 * GUARD.viewHalfAngle * i) / rays;
    let reach = range;
    const step = TILE / 4;
    for (let d = step; d <= range; d += step) {
      const tx = Math.floor((guard.x + Math.cos(angle) * d) / TILE);
      const ty = Math.floor((guard.y + Math.sin(angle) * d) / TILE);
      if (blocksSight(level, tx, ty)) {
        reach = d;
        break;
      }
    }
    points.push({ x: guard.x + Math.cos(angle) * reach, y: guard.y + Math.sin(angle) * reach });
  }
  return points;
}
