// level.js — turns the text map in config.js into a walkable level: walls, cover, shadow
// floor, intel files, the exit and the player start. Also answers the two questions the
// rest of the game keeps asking: "is this tile solid?" and "can a guard see across here?"
import { MAP, MAP_WIDTH, MAP_HEIGHT, TILE } from './config.js';

export const KIND_WALL = '#';
export const KIND_CRATE = 'C';
export const KIND_SHELF = 'H';

function tileAt(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return '#';
  return map[ty][tx];
}

export function parseLevel(map = MAP) {
  const walls = new Set();
  const crates = [];
  const shelves = [];
  const shadows = new Set();
  const intel = [];
  let exit = null;
  let playerStart = { x: TILE * 1.5, y: TILE * 1.5 };
  for (let ty = 0; ty < MAP_HEIGHT; ty += 1) {
    for (let tx = 0; tx < MAP_WIDTH; tx += 1) {
      const ch = tileAt(map, tx, ty);
      const key = `${tx},${ty}`;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      if (ch === '#') walls.add(key);
      else if (ch === 'C') crates.push({ tx, ty, x: cx, y: cy });
      else if (ch === 'H') shelves.push({ tx, ty, x: cx, y: cy });
      else if (ch === 'S') shadows.add(key);
      else if (ch === 'I') intel.push({ tx, ty, x: cx, y: cy, taken: false });
      else if (ch === 'E') exit = { tx, ty, x: cx, y: cy };
      else if (ch === 'P') playerStart = { x: cx, y: cy };
    }
  }
  return { walls, crates, shelves, shadows, intel, exit, playerStart };
}

// Solid for movement: walls, crates and shelves. Shadow floor is walkable.
export function isSolidTile(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return true;
  const ch = tileAt(MAP, tx, ty);
  return ch === '#' || ch === 'C' || ch === 'H';
}

// A circle (the player or a guard) may stand at (x, y) with this radius if none of the tiles
// its edge touches is solid.
export function canStand(level, x, y, radius) {
  const left = Math.floor((x - radius) / TILE);
  const right = Math.floor((x + radius) / TILE);
  const top = Math.floor((y - radius) / TILE);
  const bottom = Math.floor((y + radius) / TILE);
  for (let ty = top; ty <= bottom; ty += 1) {
    for (let tx = left; tx <= right; tx += 1) {
      if (isSolidTile(level, tx, ty)) return false;
    }
  }
  return true;
}

// Move a circle axis by axis so it slides along walls instead of sticking on corners.
export function moveCircle(level, pos, dx, dy, radius) {
  const nextX = pos.x + dx;
  if (canStand(level, nextX, pos.y, radius)) pos.x = nextX;
  const nextY = pos.y + dy;
  if (canStand(level, pos.x, nextY, radius)) pos.y = nextY;
}

export function isShadowTile(level, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return level.shadows.has(`${tx},${ty}`);
}

// Line of sight: walls and tall shelves block a guard's gaze; low crates do not.
export function blocksSight(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_WIDTH || ty >= MAP_HEIGHT) return true;
  const ch = tileAt(MAP, tx, ty);
  return ch === '#' || ch === 'H';
}

// Step along the segment in small hops; a hop landing in a sight-blocking tile ends the view.
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const hops = Math.max(1, Math.ceil(distance / (TILE / 4)));
  for (let i = 1; i < hops; i += 1) {
    const t = i / hops;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (blocksSight(level, tx, ty)) return false;
  }
  return true;
}

// Count of hiding spots: crates plus shelves plus shadow tiles, for the README facts.
export function countHidingSpots(level) {
  return level.crates.length + level.shelves.length + level.shadows.size;
}
