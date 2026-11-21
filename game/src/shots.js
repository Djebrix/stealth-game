// shots.js — the four staged screenshot scenes behind ?shot=cover|patrol|alarm|exit.
// Each one sets up a real game state (positions, suspicion, intel) and returns the screen
// to paint, so every screenshot is a deterministic render of the game code itself.
import { GUARD_CHASE, GUARD_INVESTIGATE } from './guards.js';
import { SCREEN_PLAY } from './render.js';
import { TILE } from './config.js';

function placePlayer(world, tx, ty, facing) {
  world.player.x = tx * TILE + TILE / 2;
  world.player.y = ty * TILE + TILE / 2;
  world.player.facing = facing;
  world.player.moveTarget = null;
}

function placeGuard(world, index, tx, ty, facing, suspicion, state) {
  const guard = world.guards[index];
  guard.x = tx * TILE + TILE / 2;
  guard.y = ty * TILE + TILE / 2;
  guard.facing = facing;
  guard.suspicion = suspicion;
  guard.state = state;
  guard.lastSeen = { x: world.player.x, y: world.player.y };
  guard.unseenFor = 0;
}

export function stageShot(name, world) {
  world.reset();
  world.screen = SCREEN_PLAY;
  if (name === 'patrol') {
    // Mid-play: the player crouches in shadow while a warden's cone sweeps just past.
    world.player.sneaking = true;
    placePlayer(world, 6, 1, 0);
    placeGuard(world, 0, 9, 1, Math.PI, 55, 'patrol');
    placeGuard(world, 1, 11, 6, -Math.PI / 2, 0, 'patrol');
    placeGuard(world, 2, 19, 4, Math.PI / 2, 0, 'patrol');
    placeGuard(world, 3, 7, 13, 0, 0, 'patrol');
    placeGuard(world, 4, 3, 8, Math.PI / 2, 0, 'patrol');
    world.player.intel = 2;
    world.level.intel[0].taken = true;
    world.level.intel[1].taken = true;
    world.score = 1000;
    world.elapsed = 74;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'alarm') {
    // The alarm moment: a warden has spotted the player and gives chase, meter full.
    placePlayer(world, 12, 7, Math.PI);
    placeGuard(world, 0, 10, 7, 0, 100, GUARD_CHASE);
    placeGuard(world, 1, 14, 8, -Math.PI / 2, 88, GUARD_INVESTIGATE);
    placeGuard(world, 2, 19, 4, Math.PI / 2, 0, 'patrol');
    placeGuard(world, 3, 7, 13, 0, 0, 'patrol');
    placeGuard(world, 4, 3, 8, Math.PI / 2, 0, 'patrol');
    world.player.intel = 3;
    world.level.intel[0].taken = true;
    world.level.intel[1].taken = true;
    world.level.intel[2].taken = true;
    world.score = 1500;
    world.elapsed = 121;
    world.alarms = 1;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'exit') {
    // The finish: all six files stolen, the exit open, the player one step from freedom.
    placePlayer(world, 20, 14, 0);
    placeGuard(world, 0, 9, 1, Math.PI, 0, 'patrol');
    placeGuard(world, 1, 11, 6, -Math.PI / 2, 0, 'patrol');
    placeGuard(world, 2, 19, 4, Math.PI / 2, 0, 'patrol');
    placeGuard(world, 3, 7, 13, 0, 0, 'patrol');
    placeGuard(world, 4, 3, 8, Math.PI / 2, 0, 'patrol');
    for (const file of world.level.intel) file.taken = true;
    world.player.intel = 6;
    world.score = 3000;
    world.elapsed = 203;
    return { screen: SCREEN_PLAY };
  }
  // cover: the whole level at a glance — player at the start, cones, cover, intel, exit.
  placePlayer(world, 1, 1, 0);
  placeGuard(world, 0, 8, 1, 0, 0, 'patrol');
  placeGuard(world, 1, 11, 6, Math.PI / 2, 0, 'patrol');
  placeGuard(world, 2, 19, 4, Math.PI, 0, 'patrol');
  placeGuard(world, 3, 7, 13, Math.PI / 2, 0, 'patrol');
  placeGuard(world, 4, 3, 8, 0, 0, 'patrol');
  world.score = 0;
  world.elapsed = 12;
  return { screen: SCREEN_PLAY };
}
