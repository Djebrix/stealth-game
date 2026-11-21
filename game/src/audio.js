// audio.js — every sound is synthesised with WebAudio in code; no sound files, no
// network. Footsteps are short filtered noise ticks whose rate and loudness follow the
// player's pace and how close the nearest guard is; the alert is a two-tone stinger, a
// pickup is a soft blip, winning is a small rising figure.
export function createAudio() {
  let context = null;
  let master = null;
  let lastStep = -1;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noiseTick(volume, lowpass) {
    if (!ensure()) return;
    const duration = 0.07;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    // Called every frame with the player's step phase; ticks once per stride.
    footstep(stepPhase, sneaking, running, nearestGuardDistance) {
      const stride = Math.floor(stepPhase);
      if (stride === lastStep) return;
      lastStep = stride;
      // A guard's own steps are the loudest thing in the room when it is close.
      const closeness = Math.max(0, 1 - nearestGuardDistance / 320);
      const volume = sneaking ? 0.05 : running ? 0.22 : 0.12;
      noiseTick(volume, sneaking ? 500 : 900);
      if (closeness > 0.25) noiseTick(0.06 + closeness * 0.14, 700);
    },
    alert() {
      tone(392, 0.16, 'square', 0.16);
      tone(523, 0.24, 'square', 0.16, 0.14);
    },
    spotted() {
      tone(660, 0.12, 'sawtooth', 0.1);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.18);
      tone(1318, 0.14, 'sine', 0.14, 0.08);
    },
    coin() {
      tone(1567, 0.08, 'triangle', 0.16);
      tone(1174, 0.1, 'triangle', 0.12, 0.07);
    },
    locked() {
      tone(220, 0.12, 'square', 0.1);
    },
    win() {
      [523, 659, 784, 1046].forEach((frequency, i) => tone(frequency, 0.22, 'triangle', 0.16, i * 0.12));
    },
    caught() {
      tone(311, 0.3, 'sawtooth', 0.16);
      tone(233, 0.45, 'sawtooth', 0.16, 0.22);
    },
  };
}
