// render.js — paints the whole game on one canvas: the archive floor, shadow pools and
// cover, the guards with their vision cones, the player, the intel files and the exit,
// then the HUD (intel, timer, score, coins and the detection meter) and the screens
// (title, paused, caught, escaped). Colours are chosen so a guard and its cone read at a
// glance against the floor, and the lit floor is exactly the floor a guard can see.
import { MAP_WIDTH, MAP_HEIGHT, TILE, INTEL_TOTAL, GUARD } from './config.js';
import { conePolygon } from './vision.js';
import { GUARD_CHASE, GUARD_INVESTIGATE, maxSuspicion, anyAlarmed } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const FLOOR_A = '#2a2f3a';
const FLOOR_B = '#262b35';
const SHADOW_FLOOR = '#171d2b';
const WALL = '#10131a';
const WALL_TOP = '#3a4152';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const width = MAP_WIDTH * TILE;
  const height = MAP_HEIGHT * TILE;

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    // The bitmap keeps the game's 3:2 aspect; the stylesheet centres it, never stretches it.
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  function drawFloor(level) {
    for (let ty = 0; ty < MAP_HEIGHT; ty += 1) {
      for (let tx = 0; tx < MAP_WIDTH; tx += 1) {
        const key = `${tx},${ty}`;
        if (level.walls.has(key)) continue;
        ctx.fillStyle = level.shadows.has(key) ? SHADOW_FLOOR : (tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        if (level.shadows.has(key)) {
          ctx.fillStyle = 'rgba(90, 130, 255, 0.10)';
          ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        }
      }
    }
    // Faint tile grid so distances and cover read at a glance.
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let tx = 0; tx <= MAP_WIDTH; tx += 1) {
      ctx.moveTo(tx * TILE, 0);
      ctx.lineTo(tx * TILE, height);
    }
    for (let ty = 0; ty <= MAP_HEIGHT; ty += 1) {
      ctx.moveTo(0, ty * TILE);
      ctx.lineTo(width, ty * TILE);
    }
    ctx.stroke();
  }

  function drawCover(level) {
    for (const crate of level.crates) {
      ctx.fillStyle = '#6b4a26';
      ctx.fillRect(crate.x - 17, crate.y - 17, 34, 34);
      ctx.strokeStyle = '#8a6234';
      ctx.lineWidth = 2;
      ctx.strokeRect(crate.x - 17, crate.y - 17, 34, 34);
      ctx.beginPath();
      ctx.moveTo(crate.x - 17, crate.y);
      ctx.lineTo(crate.x + 17, crate.y);
      ctx.moveTo(crate.x, crate.y - 17);
      ctx.lineTo(crate.x, crate.y + 17);
      ctx.stroke();
    }
    for (const shelf of level.shelves) {
      ctx.fillStyle = '#4d3a5e';
      ctx.fillRect(shelf.x - 18, shelf.y - 18, 36, 36);
      ctx.strokeStyle = '#7a5c94';
      ctx.lineWidth = 2;
      ctx.strokeRect(shelf.x - 18, shelf.y - 18, 36, 36);
      ctx.fillStyle = '#6b4f85';
      ctx.fillRect(shelf.x - 12, shelf.y - 4, 24, 8);
    }
    for (const key of level.walls) {
      const [tx, ty] = key.split(',').map(Number);
      ctx.fillStyle = WALL;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      ctx.fillStyle = WALL_TOP;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, 4);
    }
  }

  function drawExit(level, exitOpen) {
    const exit = level.exit;
    if (!exit) return;
    ctx.fillStyle = exitOpen ? '#1f7a44' : '#5c3a1e';
    ctx.fillRect(exit.x - 18, exit.y - 18, 36, 36);
    ctx.strokeStyle = exitOpen ? '#37d67a' : '#c98a3a';
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x - 18, exit.y - 18, 36, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', exit.x, exit.y - 1);
    if (!exitOpen) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#e8c88a';
      ctx.fillText('LOCKED', exit.x, exit.y + 30);
    }
  }

  function drawIntel(level) {
    for (const file of level.intel) {
      if (file.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 280);
      ctx.fillStyle = `rgba(255, 214, 90, ${0.25 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.arc(file.x, file.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5e6b8';
      ctx.fillRect(file.x - 7, file.y - 9, 14, 18);
      ctx.strokeStyle = '#8a7a4a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(file.x - 7, file.y - 9, 14, 18);
      ctx.strokeStyle = '#5a6a9a';
      ctx.beginPath();
      ctx.moveTo(file.x - 4, file.y - 4);
      ctx.lineTo(file.x + 4, file.y - 4);
      ctx.moveTo(file.x - 4, file.y);
      ctx.lineTo(file.x + 4, file.y);
      ctx.moveTo(file.x - 4, file.y + 4);
      ctx.lineTo(file.x + 1, file.y + 4);
      ctx.stroke();
    }
  }

  function drawCone(level, guard) {
    const range = GUARD.viewRange;
    const points = conePolygon(level, guard, range);
    const alarmed = guard.state === GUARD_CHASE;
    const suspicious = guard.suspicion > 35;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = alarmed
      ? 'rgba(255, 60, 60, 0.30)'
      : suspicious
        ? 'rgba(255, 190, 60, 0.22)'
        : 'rgba(255, 220, 90, 0.15)';
    ctx.fill();
    ctx.strokeStyle = alarmed ? 'rgba(255, 80, 80, 0.5)' : 'rgba(255, 220, 90, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawGuard(guard) {
    const alarmed = guard.state === GUARD_CHASE;
    const investigating = guard.state === GUARD_INVESTIGATE;
    // Body: a warden in a red coat, visible against the floor at any zoom.
    ctx.fillStyle = alarmed ? '#e03131' : '#c2502e';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b0d0d';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick and helmet lamp.
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * (GUARD.radius + 7), guard.y + Math.sin(guard.facing) * (GUARD.radius + 7));
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.facing) * 6, guard.y + Math.sin(guard.facing) * 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // State mark: ? while suspicious, ! while chasing or investigating.
    if (alarmed || guard.suspicion > 35 || investigating) {
      ctx.fillStyle = alarmed ? '#ff4040' : '#ffd166';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(alarmed ? '!' : '?', guard.x, guard.y - GUARD.radius - 4);
    }
    // Personal suspicion arc over the guard's head.
    if (guard.suspicion > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius + 6, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayer(player) {
    // A soft ring shows the shadow bonus when the player stands in the dark.
    if (player.inShadow) {
      ctx.fillStyle = 'rgba(90, 130, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = player.sneaking ? '#1f9d8a' : '#2ec4b6';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#062a26';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#e0fbfc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.facing) * 18, player.y + Math.sin(player.facing) * 18);
    ctx.stroke();
    // Coin in flight, and the coin sitting where it landed.
    if (player.coinFlight) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(player.coinFlight.x, player.coinFlight.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (player.landedCoin) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(player.landedCoin.x, player.landedCoin.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6d1f';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Click-to-move marker.
    if (player.moveTarget) {
      ctx.strokeStyle = 'rgba(46, 196, 182, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.moveTarget.x, player.moveTarget.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(player.moveTarget.x - 12, player.moveTarget.y);
      ctx.lineTo(player.moveTarget.x + 12, player.moveTarget.y);
      ctx.moveTo(player.moveTarget.x, player.moveTarget.y - 12);
      ctx.lineTo(player.moveTarget.x, player.moveTarget.y + 12);
      ctx.stroke();
    }
  }

  function drawHud(world, screen) {
    const { player, guards, elapsed, score, alarms } = world;
    const suspicion = maxSuspicion(guards);
    const alarmed = anyAlarmed(guards);
    ctx.fillStyle = 'rgba(8, 10, 16, 0.82)';
    ctx.fillRect(0, 0, width, 44);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('EMBER ARCHIVE', 12, 15);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`INTEL ${player.intel}/${INTEL_TOTAL}`, 12, 33);
    ctx.fillStyle = '#e0fbfc';
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    ctx.fillText(`TIME ${minutes}:${String(seconds).padStart(2, '0')}`, 150, 22);
    ctx.fillText(`SCORE ${score}`, 250, 22);
    ctx.fillText(`COINS ${player.coins}`, 360, 22);
    ctx.fillText(`ALARMS ${alarms}`, 440, 22);
    // Detection meter: the worst suspicion of any guard, with a word for its state.
    const meterX = 560;
    const meterWidth = 220;
    ctx.fillStyle = '#222';
    ctx.fillRect(meterX, 14, meterWidth, 16);
    ctx.fillStyle = suspicion >= 100 || alarmed ? '#e03131' : suspicion > 35 ? '#f0a020' : '#2ec4b6';
    ctx.fillRect(meterX, 14, (meterWidth * Math.min(100, suspicion)) / 100, 16);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, 14, meterWidth, 16);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = 'bold 12px sans-serif';
    const label = alarmed ? 'SPOTTED — RUN!' : suspicion > 35 ? 'SUSPICIOUS' : 'HIDDEN';
    ctx.fillText(`DETECTION ${label}`, meterX, 42);
    if (screen === SCREEN_PLAY && !world.exitOpen && world.nearExit) {
      ctx.fillStyle = '#e8c88a';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`EXIT LOCKED — STEAL ${INTEL_TOTAL - player.intel} MORE INTEL`, width / 2, 62);
    }
  }

  function drawOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(6, 8, 14, 0.72)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, width / 2, height / 2 - 90);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '17px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, height / 2 - 30 + i * 28);
    });
  }

  return {
    draw(world, screen, best) {
      fitCanvas();
      const { level, player, guards } = world;
      ctx.clearRect(0, 0, width, height);
      drawFloor(level);
      drawExit(level, world.exitOpen);
      drawIntel(level);
      for (const guard of guards) drawCone(level, guard);
      drawCover(level);
      for (const guard of guards) drawGuard(guard);
      drawPlayer(player);
      drawHud(world, screen);
      if (screen === SCREEN_TITLE) {
        drawOverlay('EMBER ARCHIVE', [
          'Steal all 6 intel files from the night archive, then slip out the EXIT unseen.',
          '5 wardens walk fixed patrols — learn them, wait in the shadows, break line of sight to cool down.',
          'WASD / arrows move · SHIFT sneak · E grab intel · C or right-click toss a coin · left-click walk there · P pause',
          'A full detection meter sounds the alarm. Lose the guard, and it searches your last seen spot, then goes back.',
          'Press SPACE or click to begin.',
        ], '#ffd166');
      } else if (screen === SCREEN_PAUSED) {
        drawOverlay('PAUSED', ['Press P or SPACE to keep sneaking.'], '#e0fbfc');
      } else if (screen === SCREEN_CAUGHT) {
        drawOverlay('CAUGHT', [
          `The wardens found you with ${player.intel}/${INTEL_TOTAL} intel files.`,
          `Score ${world.score} · Best ${best}`,
          'Press SPACE to try again.',
        ], '#ff5a5a');
      } else if (screen === SCREEN_WIN) {
        drawOverlay('ESCAPED UNSEEN', [
          `All ${INTEL_TOTAL} intel files stolen in ${Math.floor(world.elapsed)}s.`,
          `Score ${world.score} · Best ${best}`,
          'Press SPACE to run it again.',
        ], '#37d67a');
      }
    },
  };
}
