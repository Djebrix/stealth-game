// guards.js — the five wardens. Each walks its patrol loop, pauses at every waypoint to
// look around, and carries a suspicion meter (0..100). A full meter sounds the alarm: the
// guard chases the player, and on losing sight investigates the last seen spot, looks
// around, then walks back to its patrol. Suspicion drains while the player stays hidden,
// so a near miss is a recovery, not a death sentence.
import { GUARD_ROUTES, GUARD, TILE, STEP } from './config.js';
import { moveCircle } from './level.js';
import { guardSeesPlayer, suspicionRisePerSecond } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_PAUSE = 'pause';
export const GUARD_CHASE = 'chase';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_RETURN = 'return';
export const GUARD_LOOK = 'look';

export const EVENT_ALARM = 1;
export const EVENT_CAUGHT = 2;

function tileCentre(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function createGuards() {
  return GUARD_ROUTES.map((route, index) => {
    const start = tileCentre(route.waypoints[0][0], route.waypoints[0][1]);
    const second = tileCentre(route.waypoints[1][0], route.waypoints[1][1]);
    return {
      index,
      name: route.name,
      route: route.waypoints.map(([tx, ty]) => tileCentre(tx, ty)),
      speed: route.speed,
      x: start.x,
      y: start.y,
      facing: Math.atan2(second.y - start.y, second.x - start.x),
      waypointIndex: 1,
      state: GUARD_PATROL,
      suspicion: 0,
      pauseLeft: 0,
      lookLeft: 0,
      unseenFor: 0,
      lastSeen: null,
      target: null,
      alarmRaised: false,
    };
  });
}

function moveToward(level, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return true;
  const step = Math.min(distance, speed * dt);
  moveCircle(level, guard, (dx / distance) * step, (dy / distance) * step, GUARD.radius);
  guard.facing = Math.atan2(dy, dx);
  return distance <= step + 0.5;
}

function turnToward(guard, targetAngle, dt) {
  let diff = targetAngle - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
  guard.facing += turn;
}

// One fixed step for every guard. Returns an event bitmask (alarm raised / player caught).
export function stepGuards(level, guards, player, dt) {
  let events = 0;
  for (const guard of guards) {
    const sight = guardSeesPlayer(level, guard, player);
    if (sight.seen) {
      guard.suspicion = Math.min(
        100,
        guard.suspicion + suspicionRisePerSecond(sight.distance, sight.range) * dt,
      );
      guard.lastSeen = { x: player.x, y: player.y };
      guard.unseenFor = 0;
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.fallPerSecond * dt);
      guard.unseenFor += dt;
    }

    if (guard.suspicion >= 100 && guard.state !== GUARD_CHASE) {
      guard.state = GUARD_CHASE;
      guard.unseenFor = 0;
      if (!guard.alarmRaised) {
        guard.alarmRaised = true;
        events |= EVENT_ALARM;
      }
    }

    if (guard.state === GUARD_CHASE) {
      if (sight.seen) {
        moveToward(level, guard, player.x, player.y, GUARD.chaseSpeed, dt);
        if (Math.hypot(player.x - guard.x, player.y - guard.y) <= GUARD.catchDistance) {
          events |= EVENT_CAUGHT;
        }
      } else if (guard.unseenFor >= GUARD.loseSightSeconds) {
        // Lost the trail: go and check where the player was last seen.
        guard.state = GUARD_INVESTIGATE;
        guard.target = guard.lastSeen ? { ...guard.lastSeen } : { x: guard.x, y: guard.y };
      } else {
        moveToward(level, guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.chaseSpeed, dt);
      }
      continue;
    }

    if (guard.state === GUARD_INVESTIGATE) {
      if (guard.target && moveToward(level, guard, guard.target.x, guard.target.y, GUARD.investigateSpeed, dt)) {
        guard.state = GUARD_LOOK;
        guard.lookLeft = GUARD.lookAroundSeconds;
      }
      continue;
    }

    if (guard.state === GUARD_LOOK) {
      guard.facing += 1.6 * dt; // scan the room before giving up
      guard.lookLeft -= dt;
      if (guard.lookLeft <= 0) {
        guard.state = GUARD_RETURN;
        guard.alarmRaised = false;
        guard.target = null;
      }
      continue;
    }

    if (guard.state === GUARD_RETURN) {
      // Walk back to the nearest waypoint, then resume the loop from there.
      let nearest = 0;
      let nearestDistance = Infinity;
      guard.route.forEach((point, i) => {
        const d = Math.hypot(point.x - guard.x, point.y - guard.y);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = i;
        }
      });
      const point = guard.route[nearest];
      if (moveToward(level, guard, point.x, point.y, guard.speed, dt)) {
        guard.waypointIndex = (nearest + 1) % guard.route.length;
        guard.state = GUARD_PATROL;
      }
      continue;
    }

    if (guard.state === GUARD_PAUSE) {
      guard.pauseLeft -= dt;
      // Look where the patrol goes next instead of spinning: a guard that sweeps a full
      // circle would spot a player hiding behind its own back for no good reason.
      const next = guard.route[guard.waypointIndex];
      turnToward(guard, Math.atan2(next.y - guard.y, next.x - guard.x), dt);
      if (guard.pauseLeft <= 0) guard.state = GUARD_PATROL;
      continue;
    }

    // GUARD_PATROL: walk the loop, pausing a beat at each waypoint.
    const point = guard.route[guard.waypointIndex];
    if (moveToward(level, guard, point.x, point.y, guard.speed, dt)) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.route.length;
      guard.state = GUARD_PAUSE;
      guard.pauseLeft = 0.9;
    }
  }
  return events;
}

// A thrown coin distracts: the nearest guard in earshot goes to look at where it landed.
export function distractGuards(guards, x, y) {
  let best = null;
  let bestDistance = 300;
  for (const guard of guards) {
    if (guard.state === GUARD_CHASE) continue;
    const d = Math.hypot(guard.x - x, guard.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = guard;
    }
  }
  if (!best) return false;
  best.state = GUARD_INVESTIGATE;
  best.target = { x, y };
  best.suspicion = Math.max(0, best.suspicion - 30);
  return true;
}

export function maxSuspicion(guards) {
  let max = 0;
  for (const guard of guards) max = Math.max(max, guard.suspicion);
  return max;
}

export function anyAlarmed(guards) {
  return guards.some((guard) => guard.state === GUARD_CHASE);
}
