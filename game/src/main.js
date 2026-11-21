// main.js — boot and the one loop. The world advances in fixed 1/60 s steps, the renderer
// paints what is there, and the game moves between five screens: title, play, paused,
// caught and escaped. ?shot=cover|patrol|alarm|exit stages that scene instead of running
// the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP, BEST_KEY, SCORE_PER_INTEL, WIN_TIME_BONUS, ALARM_PENALTY } from './config.js';
import { parseLevel } from './level.js';
import { createPlayer, stepPlayer, tryCollectIntel, exitIsOpen, playerAtExit, throwCoin } from './player.js';
import { createGuards, stepGuards, distractGuards, EVENT_ALARM, EVENT_CAUGHT } from './guards.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_COIN, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CAUGHT, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function createWorld() {
  const world = {
    level: null,
    player: null,
    guards: [],
    elapsed: 0,
    score: 0,
    alarms: 0,
    exitOpen: false,
    nearExit: false,
    reset() {
      this.level = parseLevel();
      this.player = createPlayer(this.level.playerStart);
      this.guards = createGuards();
      this.elapsed = 0;
      this.score = 0;
      this.alarms = 0;
      this.exitOpen = false;
      this.nearExit = false;
    },
  };
  world.reset();
  return world;
}

const world = createWorld();

// Test and debug hook: the play-test driver reads state through window.__game.
window.__game = {
  world,
  get screen() {
    return currentScreen;
  },
};

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

let currentScreen = SCREEN_TITLE;

function runShot(name) {
  const scene = stageShot(name, world);
  currentScreen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(world, currentScreen, readBest());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pointer = { x: 0, y: 0 };
  canvas.addEventListener('mousemove', (event) => {
    pointer = input.pointerGamePoint(event.clientX, event.clientY);
  });

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    currentScreen = SCREEN_PLAY;
    announce('Playing. Steal 6 intel files, then reach the exit unseen.');
  }

  function endGame(win) {
    if (win) {
      const timeBonus = Math.max(0, WIN_TIME_BONUS - Math.floor(world.elapsed) * 10);
      world.score += timeBonus - world.alarms * ALARM_PENALTY;
      if (world.score < 0) world.score = 0;
      currentScreen = SCREEN_WIN;
      audio.win();
      announce(`Escaped unseen. Score ${world.score}.`);
    } else {
      currentScreen = SCREEN_CAUGHT;
      audio.caught();
      announce(`Caught. Score ${world.score}.`);
    }
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
  }

  function nearestGuardDistance() {
    let nearest = Infinity;
    for (const guard of world.guards) {
      nearest = Math.min(nearest, Math.hypot(guard.x - world.player.x, guard.y - world.player.y));
    }
    return nearest;
  }

  function step(actions) {
    if (actions & ACTION_PAUSE && currentScreen === SCREEN_PLAY) {
      currentScreen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && currentScreen === SCREEN_PAUSED) {
      currentScreen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    if (currentScreen !== SCREEN_PLAY) return;

    const clickTarget = input.takeClickTarget();
    if (clickTarget) world.player.moveTarget = clickTarget;

    if (actions & ACTION_COIN) {
      const target = input.takeCoinTarget() || pointer;
      const landing = throwCoin(world.player, target.x, target.y);
      if (landing) {
        audio.coin();
        distractGuards(world.guards, landing.x, landing.y);
      }
    }
    if (actions & ACTION_INTERACT) {
      const file = tryCollectIntel(world.level, world.player);
      if (file) {
        world.score += SCORE_PER_INTEL;
        audio.pickup();
        announce(`Intel ${world.player.intel} of 6.`);
      }
    }

    stepPlayer(world.level, world.player, input.direction(), STEP);
    const events = stepGuards(world.level, world.guards, world.player, STEP);
    if (events & EVENT_ALARM) {
      world.alarms += 1;
      audio.alert();
      announce('Spotted! Break line of sight.');
    }
    if (events & EVENT_CAUGHT) {
      endGame(false);
      return;
    }
    audio.footstep(world.player.stepPhase, world.player.sneaking, world.player.running, nearestGuardDistance());

    world.elapsed += STEP;
    world.exitOpen = exitIsOpen(world.player);
    world.nearExit = !world.exitOpen && world.level.exit
      && Math.hypot(world.level.exit.x - world.player.x, world.level.exit.y - world.player.y) < 120;
    if (world.exitOpen && playerAtExit(world.level, world.player)) endGame(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Actions are read once per frame and handed to the first step, so a key press is
    // never eaten by the loop or applied twice.
    let actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (currentScreen === SCREEN_TITLE || currentScreen === SCREEN_CAUGHT || currentScreen === SCREEN_WIN)) {
      audio.unlock();
      startGame();
      actions = 0;
    } else if (currentScreen === SCREEN_TITLE || currentScreen === SCREEN_PLAY) {
      while (accumulator >= STEP && (currentScreen === SCREEN_TITLE || currentScreen === SCREEN_PLAY)) {
        if (currentScreen === SCREEN_TITLE) {
          // The title screen shows the level alive behind the overlay: guards patrol.
          stepGuards(world.level, world.guards, world.player, STEP);
          accumulator -= STEP;
        } else {
          step(actions);
          actions = 0;
          accumulator -= STEP;
        }
      }
      if (currentScreen === SCREEN_PAUSED) accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(world, currentScreen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentScreen === SCREEN_PLAY) {
      currentScreen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  canvas.addEventListener('mousedown', () => audio.unlock());
  announce('Ember Archive. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
