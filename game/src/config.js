// Ember Archive: every fixed number for the level lives here.
// Tile legend: # wall, . floor, S shadow floor, C crate (low cover, blocks sight when crouched
// behind it only in the sense that it blocks movement and breaks line of sight at eye level),
// H tall shelf (blocks movement and line of sight), I intel file, E exit, P player start.
// Guards walk the waypoint routes below; each route is a closed loop of tile centres.
export const TILE = 40;
export const STEP = 1 / 60;
export const BEST_KEY = 'ember-archive-best';

// One open archive floor: three ways across (north corridor, central hall, west shadow lane),
// so a patient player can always pick a route a patrol has just left.
export const MAP = [
  '########################',
  '#P.#..S....##.....I....#',
  '#..........##..........#',
  '#.####..C......C...###.#',
  '#.#......##.........I..#',
  '#.#..S...##..####......#',
  '#.#......##..#......C..#',
  '#....C.......#...S..I..#',
  '#..........###....##...#',
  '#.####...........#..#..#',
  '#.#..I...C....S..#..#..#',
  '#.#......##......#.....#',
  '#...C....##..C...#.##..#',
  '#....I......##........#',
  '#..S....I.......C...E.#',
  '########################',
];

export const MAP_WIDTH = 24;
export const MAP_HEIGHT = 16;

// Five guards, five learnable patrol loops. Waypoints are tile coordinates.
export const GUARD_ROUTES = [
  { name: 'Warden', waypoints: [[4, 1], [9, 1], [9, 2], [4, 2]], speed: 52 },
  { name: 'Keeper', waypoints: [[14, 1], [21, 1], [21, 2], [14, 2]], speed: 48 },
  { name: 'Sentry', waypoints: [[18, 4], [21, 4], [21, 5], [18, 5]], speed: 55 },
  { name: 'Lookout', waypoints: [[2, 12], [10, 13], [10, 14], [2, 14]], speed: 46 },
  { name: 'Patroller', waypoints: [[3, 6], [6, 6], [6, 8], [3, 8]], speed: 50 },
];

export const PLAYER = {
  radius: 13,
  walkSpeed: 132,
  sneakSpeed: 62,
  runSpeed: 168,
};

export const GUARD = {
  radius: 14,
  viewRange: 175,
  viewHalfAngle: 0.61, // about 35 degrees each side of facing
  chaseSpeed: 118,
  investigateSpeed: 78,
  catchDistance: 20,
  // Suspicion 0..100. Rises while the player is seen, falls while hidden.
  riseNearPerSecond: 62,
  riseFarPerSecond: 26,
  fallPerSecond: 20,
  // Seconds of no sight before a chasing guard gives up and investigates the last seen spot.
  loseSightSeconds: 2.5,
  lookAroundSeconds: 2.0,
};

export const COINS = 3;
export const INTEL_TOTAL = 6;
export const SCORE_PER_INTEL = 500;
export const WIN_TIME_BONUS = 3000;
export const ALARM_PENALTY = 150;
