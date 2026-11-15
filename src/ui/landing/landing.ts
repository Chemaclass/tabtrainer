import './landing.css';
import { byId, one } from '../dom';
import { leaveLanding, onLanding } from '../shell/landingMode';
import { isFamily, type Family } from '../../core/instruments';
import { DEMO_START_SPEED, landingEntries, type LandingEntries } from '../../app/landingDemo';
import { landingDemo } from './landingDemo';

const bundled = Object.fromEntries(Object.entries(import.meta.glob('../../songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)
  .map(([path, text]) => [path.replace(/^(\.\.\/)+/, './'), text]));
byId('landingCount').textContent = String(Object.keys(bundled).length);

if (onLanding()) history.replaceState(history.state, '', import.meta.env.BASE_URL);

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
let entries: LandingEntries = landingEntries(bundled, chosenFamily(), import.meta.env.BASE_URL);
const showEntries = () => {
  entries = landingEntries(bundled, chosenFamily(), import.meta.env.BASE_URL);
  landing.querySelectorAll<HTMLAnchorElement>('[data-entry]').forEach(row => {
    const entry = entries[row.dataset.entry as keyof LandingEntries];
    row.href = entry.href;
    const detail = row.querySelector('.landing-entry-detail');
    if (detail) detail.textContent = entry.detail;
  });
};
showEntries();

const play = byId('demoPlay', HTMLButtonElement), playLabel = one('#demoPlay span');
const speedButtons = [...landing.querySelectorAll<HTMLButtonElement>('[data-demo-speed]')];
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
const showSpeed = () => speedButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.demoSpeed) === speed)));
showSpeed();

const demo = landingDemo(byId('demoSheet'), showPlaying);
demo.setSpeed(speed);

if (!audioAvailable()) offerFirstSteps();
play.addEventListener('click', () => {
  if (!onLanding()) return;
  if (play.classList.contains('silent')) { location.assign(entries.firstSteps.href); return; }
  if (!demo.toggle()) offerFirstSteps();
});
speedButtons.forEach(button => button.addEventListener('click', () => {
  speed = Number(button.dataset.demoSpeed);
  showSpeed();
  demo.setSpeed(speed);
}));
familySwitch.addEventListener('click', () => {
  showEntries();
  demo.show(chosenFamily());
});
byId('tunerBtn').addEventListener('click', () => demo.stop());
document.addEventListener('visibilitychange', () => { if (document.hidden) demo.stop(); });

const whenIdle = (task: () => void) => 'requestIdleCallback' in window ? requestIdleCallback(task, { timeout: 1500 }) : setTimeout(task, 200);
const showDemo = () => whenIdle(() => { if (onLanding()) demo.show(chosenFamily()); });
new MutationObserver(() => {
  if (!onLanding()) { demo.stop(); return; }
  showEntries();
  showDemo();
}).observe(document.documentElement, { attributeFilter: ['class'] });
if (document.readyState === 'complete') showDemo(); else addEventListener('load', showDemo, { once: true });
