// input.js — keyboard and mouse, nothing else. WASD or arrows to move, Shift to sneak,
// hold the run key to hurry (louder, easier to spot), E to pick up intel, C or a right
// click to toss a coin toward the cursor, left click to walk there. Space / Enter confirms
// on the title and end screens, P or Escape pauses.
import { TILE } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_COIN = 8;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
  KeyR: 'run',
  KeyE: 'interact',
  KeyC: 'coin',
  Space: 'confirm', Enter: 'confirm',
  KeyP: 'pause', Escape: 'pause',
};

export function createInput(canvas) {
  const keys = new Set();
  const actions = { bits: 0 };
  let clickTarget = null;
  let coinTarget = null;

  function toGamePoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (!name) return;
    if (name === 'confirm' || name === 'pause' || name === 'interact' || name === 'coin') {
      if (!event.repeat) {
        if (name === 'confirm') actions.bits |= ACTION_CONFIRM;
        if (name === 'pause') actions.bits |= ACTION_PAUSE;
        if (name === 'interact') actions.bits |= ACTION_INTERACT;
        if (name === 'coin') actions.bits |= ACTION_COIN;
      }
    }
    keys.add(name);
    event.preventDefault();
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) keys.delete(name);
  }

  function onMouseDown(event) {
    const point = toGamePoint(event.clientX, event.clientY);
    if (event.button === 2) {
      coinTarget = point;
      actions.bits |= ACTION_COIN;
    } else if (event.button === 0) {
      clickTarget = point;
    }
    event.preventDefault();
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    // Normalised movement direction from the keys held this frame.
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('left')) x -= 1;
      if (keys.has('right')) x += 1;
      if (keys.has('up')) y -= 1;
      if (keys.has('down')) y += 1;
      return { x, y, sneak: keys.has('sneak'), run: keys.has('run') };
    },
    takeActions() {
      const bits = actions.bits;
      actions.bits = 0;
      return bits;
    },
    takeClickTarget() {
      const target = clickTarget;
      clickTarget = null;
      return target;
    },
    takeCoinTarget() {
      const target = coinTarget;
      coinTarget = null;
      return target;
    },
    // Where the pointer is in game coordinates, for the coin-aim hint.
    pointerGamePoint(clientX, clientY) {
      return toGamePoint(clientX, clientY);
    },
  };
}
