import type { Family, Instrument } from '../../core/instruments';
import { PitchTracker } from '../../core/pitch';
import { TunerTuning, readTuning, type TunerReading } from '../../app/tuning';
import { pref, setPref } from '../../app/storage';
import { PitchListener, type MicProblem } from '../../audio/pitchListener';
import { Synth } from '../../audio/synth';
import { byId } from '../dom';
import { dismissHelpOnBackdrop } from '../shell/helpDialogs';

export interface TunerContext { family: Family; instrument: Instrument | null }

const PROBLEM_TEXT: Record<MicProblem, string> = {
  denied: 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.',
  missing: 'No microphone found. Connect one, then try again.',
  busy: 'Another app is using the microphone. Close it, then try again.',
  unsupported: 'This browser cannot use a microphone here. Try a recent browser on a secure (https) page.',
  failed: 'The microphone did not start. Try again.',
};
const TONE_SECONDS = 4;
const ANNOUNCE_EVERY = 1000;

const hz = (frequency: number) => `${frequency.toFixed(1)} Hz`;
const signed = (cents: number) => { const whole = Math.round(cents); return `${whole > 0 ? '+' : whole < 0 ? '−' : ''}${Math.abs(whole)}`; };

export function tuner(current: () => TunerContext, beforeOpen: () => void) {
  const dialog = byId('tuner', HTMLDialogElement), list = byId('tunerStrings', HTMLOListElement);
  const auto = byId('tunerAuto', HTMLButtonElement), reset = byId('tunerReset', HTMLButtonElement), stopTone = byId('tunerStopTone', HTMLButtonElement);
  const listen = byId('tunerListen', HTMLButtonElement), status = byId('tunerStatus'), live = byId('tunerLive');
  const deck = dialog.querySelector('.tuner-deck') as HTMLElement, direction = byId('tunerDirection');
  const listener = new PitchListener(), tracker = new PitchTracker(), synth = new Synth();
  let tuning = new TunerTuning('bass', null, {});
  let locked: number | null = null, shown: TunerReading | null = null;
  let toneTimer: ReturnType<typeof setTimeout> | null = null;
  let announced = '', announcedAt = 0;

  byId('tunerBtn').onclick = () => { beforeOpen(); open(); dialog.showModal(); };
  dialog.addEventListener('close', () => { stopListening(); silence(); status.textContent = ''; });
  dismissHelpOnBackdrop(dialog);
  auto.onclick = () => { locked = null; showStrings(); showReading(); };
  reset.onclick = () => { tuning.reset(); save(); showStrings(); showReading(); };
  stopTone.onclick = silence;
  listen.onclick = () => { if (listener.listening) { stopListening(); status.textContent = 'Stopped listening.'; } else void startListening(); };

  function open() {
    const { family, instrument } = current();
    tuning = new TunerTuning(family, instrument, pref('tunings', {}));
    locked = null; shown = null; tracker.reset(); announced = '';
    listen.disabled = false; listen.textContent = 'Start listening'; status.textContent = '';
    showStrings(); showReading();
  }
  function showSetup() {
    const family = tuning.key.startsWith('bass') ? 'Bass' : 'Guitar';
    byId('tunerSetup').textContent = `${family}, ${tuning.strings.length} strings, ${tuning.isStandard ? 'standard tuning' : 'custom tuning'}.`;
  }

  function save() { if (tuning.saves) setPref('tunings', tuning.saveInto(pref('tunings', {}))); }

  function showStrings() {
    const target = locked ?? shown?.target ?? null;
    const items = tuning.strings.map((_, index) => {
      const item = document.createElement('li'), name = tuning.name(index), number = index + 1;
      item.classList.toggle('target', index === target);
      const down = stepButton('−', `Lower string ${number} by a half step`, () => tuning.shift(index, -1));
      const up = stepButton('+', `Raise string ${number} by a half step`, () => tuning.shift(index, 1));
      const note = document.createElement('button');
      note.className = 'tuner-note'; note.dataset.key = `note-${index}`;
      note.setAttribute('aria-pressed', String(locked === index));
      note.setAttribute('aria-label', `String ${number}, ${name}. Play it and tune to it`);
      note.innerHTML = `<b></b><small>String ${number}</small>`;
      note.querySelector('b')!.textContent = name;
      note.onclick = () => { locked = index; playTone(index); showStrings(); showReading(); };
      item.append(up, note, down);
      return item;
    }).reverse();
    const focused = document.activeElement instanceof HTMLElement && list.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    list.replaceChildren(...items);
    if (focused) list.querySelector<HTMLElement>(`[data-key="${focused}"]`)?.focus();
    auto.setAttribute('aria-pressed', String(locked === null));
    reset.disabled = tuning.isStandard;
    showSetup();
  }

  function stepButton(label: string, description: string, step: () => boolean) {
    const button = document.createElement('button');
    button.className = 'tuner-step'; button.textContent = label;
    button.setAttribute('aria-label', description); button.title = description;
    button.dataset.key = description;
    button.onclick = () => { if (step()) { save(); silence(); showStrings(); showReading(); } };
    return button;
  }

  function playTone(index: number) {
    silence();
    if (!synth.started && !synth.ensure()) return;
    synth.voice(synth.now + 0.03, tuning.strings[index], TONE_SECONDS, 0.3);
    stopTone.hidden = false;
    toneTimer = setTimeout(silence, TONE_SECONDS * 1000);
  }
  function silence() {
    if (synth.started) synth.cancel('instrument');
    if (toneTimer !== null) clearTimeout(toneTimer);
    toneTimer = null;
    const hadFocus = document.activeElement === stopTone;
    stopTone.hidden = true;
    if (hadFocus) auto.focus();
  }

  async function startListening() {
    listen.disabled = true;
    status.textContent = 'Waiting for the microphone. Your browser may ask for permission.';
    const problem = await listener.start(reading => {
      if (toneTimer !== null) return;
      const frequency = tracker.push(reading?.frequency ?? null);
      const next = frequency === null ? null : readTuning(frequency, tuning.strings, locked);
      const before = shown?.target ?? null;
      shown = next;
      if ((next?.target ?? null) !== before && locked === null) showStrings();
      showReading();
    }, lost => { stopListening(); status.textContent = PROBLEM_TEXT[lost]; });
    if (problem === 'superseded') return;
    listen.disabled = false;
    if (!dialog.open) { stopListening(); return; }
    if (problem) { status.textContent = PROBLEM_TEXT[problem]; return; }
    if (!listener.listening) return;
    listen.textContent = 'Stop listening';
    status.textContent = 'Listening. Play one open string at a time.';
  }
  function stopListening() {
    listener.stop(); tracker.reset(); shown = null;
    listen.textContent = 'Start listening';
    if (dialog.open) { showStrings(); showReading(); }
  }

  function showReading() {
    const reading = shown ? readTuning(shown.frequency, tuning.strings, locked) : null;
    const target = reading?.target ?? locked;
    byId('tunerNote').textContent = target === null ? '–' : tuning.name(target);
    byId('tunerHz').textContent = target === null ? 'Choose a string' : hz(tuning.frequency(target));
    const state = reading?.direction ?? 'idle';
    deck.dataset.direction = state; direction.dataset.direction = state;
    deck.style.setProperty('--offset', String(reading ? Math.max(-1, Math.min(1, reading.cents / 50)) : 0));
    byId('tunerAdvice').textContent = { idle: listener.listening ? 'Play a string' : 'Waiting for a note', up: 'Tune up', down: 'Tune down', 'in-tune': 'In tune' }[state];
    byId('tunerCents').textContent = reading ? `${signed(reading.cents)} cents` : '– cents';
    byId('tunerHeard').textContent = reading ? `Heard ${hz(reading.frequency)}, ${reading.heard}` : 'Heard nothing yet';
    announce(reading);
  }

  function announce(reading: TunerReading | null) {
    if (!reading) return;
    const key = `${reading.target} ${reading.direction}`, now = performance.now();
    if (key === announced || now - announcedAt < ANNOUNCE_EVERY) return;
    const cents = Math.abs(Math.round(reading.cents));
    announced = key; announcedAt = now;
    live.textContent = reading.direction === 'in-tune' ? `${reading.targetName} in tune` : `${reading.targetName}, ${cents} cents ${reading.direction === 'up' ? 'flat, tune up' : 'sharp, tune down'}`;
  }
}
