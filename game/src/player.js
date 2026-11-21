// player.js — the infiltrator. Walks, sneaks (slow, quiet, harder to spot) and runs
// (fast, loud, easy to spot). Collects intel with E, throws one of three coins to distract
// a guard, and reaches the exit — which only opens once every intel file is in hand.
import { PLAYER, COINS, INTEL_TOTAL, TILE } from './config.js';
import { moveCircle, isShadowTile } from './level.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    facing: 0,
    sneaking: false,
    running: false,
    moving: false,
    inShadow: false,
    intel: 0,
    coins: COINS,
    moveTarget: null, // click-to-move destination, or null
    coinFlight: null, // { x, y, tx, ty, t } while a thrown coin is in the air
    stepPhase: 0, // drives the footstep sound
  };
}

export function stepPlayer(level, player, input, dt) {
  const dx = input.x;
  const dy = input.y;
  player.sneaking = input.sneak;
  player.running = input.run && !input.sneak;
  const speed = player.sneaking ? PLAYER.sneakSpeed : player.running ? PLAYER.runSpeed : PLAYER.walkSpeed;

  let moved = false;
  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    const nx = (dx / length) * speed * dt;
    const ny = (dy / length) * speed * dt;
    moveCircle(level, player, nx, ny, PLAYER.radius);
    player.facing = Math.atan2(dy, dx);
    player.moveTarget = null;
    moved = true;
  } else if (player.moveTarget) {
    const tx = player.moveTarget.x - player.x;
    const ty = player.moveTarget.y - player.y;
    const distance = Math.hypot(tx, ty);
    if (distance < 6) {
      player.moveTarget = null;
    } else {
      const step = Math.min(distance, speed * dt);
      moveCircle(level, player, (tx / distance) * step, (ty / distance) * step, PLAYER.radius);
      player.facing = Math.atan2(ty, tx);
      moved = true;
    }
  }
  player.moving = moved;
  player.inShadow = isShadowTile(level, player.x, player.y);
  if (moved) player.stepPhase += (speed * dt) / 26;

  // A thrown coin arcs to its landing spot, then sits there until a guard comes to look.
  if (player.coinFlight) {
    const coin = player.coinFlight;
    coin.t += dt / 0.45;
    if (coin.t >= 1) {
      coin.x = coin.tx;
      coin.y = coin.ty;
      player.coinFlight = null;
      player.landedCoin = { x: coin.tx, y: coin.ty, ttl: 6 };
    } else {
      coin.x = coin.x0 + (coin.tx - coin.x0) * coin.t;
      coin.y = coin.y0 + (coin.ty - coin.y0) * coin.t;
    }
  }
  if (player.landedCoin) {
    player.landedCoin.ttl -= dt;
    if (player.landedCoin.ttl <= 0) player.landedCoin = null;
  }
  return moved;
}

// Pick up an intel file the player is standing close to. Returns the file, or null.
export function tryCollectIntel(level, player) {
  for (const file of level.intel) {
    if (file.taken) continue;
    if (Math.hypot(file.x - player.x, file.y - player.y) <= TILE * 0.9) {
      file.taken = true;
      player.intel += 1;
      return file;
    }
  }
  return null;
}

export function exitIsOpen(player) {
  return player.intel >= INTEL_TOTAL;
}

export function playerAtExit(level, player) {
  if (!level.exit) return false;
  return Math.hypot(level.exit.x - player.x, level.exit.y - player.y) <= TILE * 0.8;
}

// Throw a coin toward a point (clamped to a short toss). Returns the landing spot, or null.
export function throwCoin(player, tx, ty) {
  if (player.coins <= 0 || player.coinFlight) return null;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 20) return null;
  const reach = Math.min(distance, 230);
  const lx = player.x + (dx / distance) * reach;
  const ly = player.y + (dy / distance) * reach;
  player.coins -= 1;
  player.coinFlight = { x0: player.x, y0: player.y, x: player.x, y: player.y, tx: lx, ty: ly, t: 0 };
  return { x: lx, y: ly };
}
