import './landing.css';
import { byId, one } from '../dom';
import { leaveLanding, onLanding } from '../shell/landingMode';
import { isFamily, type Family } from '../../core/instruments';
import { DEMO_START_SPEED, landingEntries, type LandingEntries } from '../../app/landingDemo';

const bundled = Object.fromEntries(Object.entries(import.meta.glob('../../songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)
  .map(([path, text]) => [path.replace(/^(\.\.\/)+/, './'), text]));
byId('landingCount').textContent = String(Object.keys(bundled).length);

if (onLanding()) history.replaceState(history.state, '', location.pathname);

one('.top').addEventListener('click', event => {
  if (event.target instanceof Element && event.target.closest('.library-nav button, #writeSongBtn')) leaveLanding();
}, { capture: true });

const landing = byId('landing');
landing.querySelector('[data-read-tab]')?.addEventListener('click', () => {
  leaveLanding();
  const guide = byId('tabHelp', HTMLDialogElement);
  guide.addEventListener('close', () => byId('libraryTitle').focus(), { once: true });
  guide.showModal();
});

landing.querySelector('[data-songs-guide]')?.addEventListener('click', () => byId('songsGuide', HTMLDialogElement).showModal());

const familySwitch = byId('familySwitch');
const chosenFamily = (): Family => {
  const family = familySwitch.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.family ?? '';
  return isFamily(family) ? family : 'bass';
};
let entries: LandingEntries = landingEntries(bundled, chosenFamily());
const showEntries = () => {
  entries = landingEntries(bundled, chosenFamily());
  landing.querySelectorAll<HTMLAnchorElement>('[data-entry]').forEach(row => {
    const entry = entries[row.dataset.entry as keyof LandingEntries];
    row.href = entry.href;
    const detail = row.querySelector('.landing-entry-detail');
    if (detail) detail.textContent = entry.detail;
  });
};
showEntries();

const play = byId('demoPlay', HTMLButtonElement), playLabel = one('#demoPlay span');
const sheet = byId('demoSheet');
const speedButtons = [...landing.querySelectorAll<HTMLButtonElement>('[data-speed]')];
const showPlaying = (on: boolean) => {
  if (play.classList.contains('silent')) return;
  play.classList.toggle('playing', on);
  playLabel.textContent = on ? 'Stop' : 'Play these two bars';
};
const offerFirstSteps = () => {
  play.classList.remove('playing');
  play.classList.add('silent');
  playLabel.textContent = 'Open First Steps';
  speedButtons.forEach(button => { button.disabled = true; });
};
const audioAvailable = () => typeof (window.AudioContext ?? (window as { webkitAudioContext?: unknown }).webkitAudioContext) === 'function';
let speed: number = DEMO_START_SPEED;
const showSpeed = () => speedButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === speed)));
showSpeed();

type Demo = ReturnType<typeof import('./landingDemo').landingDemo>;
let demo: Promise<Demo> | null = null, ready: Demo | null = null;
const loadDemo = () => demo ??= import('./landingDemo').then(({ landingDemo }) => {
  ready = landingDemo(sheet, showPlaying);
  ready.setSpeed(speed);
  ready.show(chosenFamily());
  return ready;
});

if (!audioAvailable()) offerFirstSteps();
play.addEventListener('click', () => {
  if (play.classList.contains('silent')) { location.assign(entries.firstSteps.href); return; }
  const start = (loaded: Demo) => { if (!loaded.toggle()) offerFirstSteps(); };
  if (ready) start(ready); else void loadDemo().then(start);
});
speedButtons.forEach(button => button.addEventListener('click', () => {
  speed = Number(button.dataset.speed);
  showSpeed();
  ready?.setSpeed(speed);
}));
familySwitch.addEventListener('click', () => {
  showEntries();
  ready?.show(chosenFamily());
});

const whenIdle = (task: () => void) => 'requestIdleCallback' in window ? requestIdleCallback(task, { timeout: 1500 }) : setTimeout(task, 200);
const prepare = () => whenIdle(() => { if (onLanding()) void loadDemo(); });
new MutationObserver(() => { if (onLanding()) prepare(); else ready?.stop(); }).observe(document.documentElement, { attributeFilter: ['class'] });
if (document.readyState === 'complete') prepare(); else addEventListener('load', prepare, { once: true });
