import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter-tight/latin-800.css';
import '@fontsource/inter-tight/latin-ext-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import './style.css';
import './ui/library.css';
import './ui/practice.css';
import './ui/player.css';
import './ui/dropdown.css';
import { enhanceDropdowns, setSelectValue } from './ui/dropdown';
import { parseSong } from './core/parser';
import { buildTimeline, onsetAt, onsetKey, onsetsOf } from './core/timeline';
import { withVersion, type Song } from './core/model';
import { isSpeedPracticeConfig } from './core/speedPractice';
import { FAMILIES, familyOf, isFamily, type Family } from './core/instruments';
import { renderSong } from './render/notation';
import { Player } from './audio/player';
import { library, removeSong, pref, setPref, recentPractice, recordPractice } from './ui/storage';
import { findBySlug, normalizeSongReference, shareUrl, songSlug, versionSlug } from './ui/songLink';
import { AutoScroller } from './ui/scrolling';
import { Passage } from './ui/passage';
import { playbackShortcut } from './ui/playbackShortcut';
import { Navigation, navigationState, type Route } from './ui/navigation';
import { DraftSession, titleOf } from './ui/draftSession';
import { editorResize } from './ui/editorResize';
import { libraryView } from './ui/libraryView';
import { hasPracticeLevels } from './ui/practiceLevels';
import { categoryCounts, isLibraryKind, nextExercise, type CatalogueEntry, type LibraryKind } from './ui/catalogue';
import { dismissHelpOnBackdrop } from './ui/helpDialogs';

const demos = import.meta.glob('./songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
['help', 'tabHelp'].forEach(id => dismissHelpOnBackdrop($<HTMLDialogElement>(id)));

const resolvePick = (value: string) => normalizeSongReference(value, Object.keys(demos));
const storedNavigation = navigationState(history.state);
const initialNavigation = storedNavigation ? { ...storedNavigation, picked: resolvePick(storedNavigation.picked) } : null;
const navigation = new Navigation(history, location, Object.keys(demos));
const initialQuery = new URLSearchParams(location.search);
let screen: 'library' | 'practice' = initialQuery.has('song') || initialQuery.get('view') === 'practice' ? 'practice' : 'library';
const initialKind = initialQuery.get('kind') ?? pref('libraryKind', 'exercises');
let libraryKind: LibraryKind = isLibraryKind(initialKind) ? initialKind : 'exercises';
let catalogueEntries: CatalogueEntry[] = [], bundledEntries: CatalogueEntry[] | null = null;

const src = $<HTMLTextAreaElement>('src'), sheet = $('sheet'), player = new Player();
let song: Song | null = null;
let parsed: Song | null = null; // whole song with every version
let versionIdx = 0;
const passage = new Passage();
const draftSession = new DraftSession(() => src.value);
let continuationDismissed = false;
let zoom = pref('zoom', 1), showNota = pref('notation', matchMedia('(min-width:600px)').matches);

// ---------- song list ----------
// demo songs live in src/songs/<family>/<kind>/, kind being exercises or songs
const familyOfText = (t: string) => familyOf(parseSong(t).song.meta.instrument);
const demoFamily = (path: string) => path.split('/')[2];
const demoKind = (path: string) => path.split('/')[3];
const savedFamily = initialQuery.get('instrument') ?? pref('family', 'bass');
let family: Family = isFamily(savedFamily) ? savedFamily : 'bass';
let picked = '';

const newSong = () => `title: New song\ninstrument: ${FAMILIES[family]}\ntempo: 90\nkey: C\ntime: 4/4\n\n@Intro\n"C" :q 3.3 3.3 5.2 3.3 |\n`;
const songsFor = (f: Family) => ({
  demos: Object.keys(demos).filter(p => demoFamily(p) === f).sort(),
  mine: library().filter(s => familyOfText(s.text) === f),
});
const catalogue = libraryView(v => pickSong(v), () => $('newBtn').click(), () => $('openBtn').click(), () => { showLibrary('exercises'); $('libraryTitle').focus({ preventScroll: true }); });
function entryFor(value: string, text: string, kind: LibraryKind, instrument: string): CatalogueEntry {
  const parsed = parseSong(text).song;
  return { value, title: parsed.meta.title, artist: artistOf(text), levels: parsed.versions.flatMap(v => v.level ?? parsed.meta.level ?? []), about: parsed.meta.about, family: instrument, kind, tempo: parsed.meta.tempo, versions: parsed.versions.length, practiceLevels: hasPracticeLevels(parsed.versions.map(v => v.name)) };
}
function fillSongList() {
  bundledEntries ??= Object.keys(demos).sort().map(path => entryFor('demo:' + path, demos[path], demoKind(path) === 'exercises' ? 'exercises' : 'songs', demoFamily(path)));
  catalogueEntries = [...bundledEntries, ...library().map(item => entryFor('lib:' + item.title, item.text, 'mine', familyOfText(item.text)))];
  catalogue.show(catalogueEntries, family, libraryKind, recentPractice().map(resolvePick));
  renderPracticeNavigation();
}
function showFamily() { setSelectValue($<HTMLSelectElement>('familySelect'), family); fillSongList(); }
function chooseFamily(f: Family) {
  if (f === family) return;
  family = f; setPref('family', f); showFamily(); showLink();
}
const creditNames = (artist = '') => artist.replace(/\s*\(public domain\)\s*$/i, '').split(',').map(n => n.trim()).filter(Boolean);
// the list names who wrote a song, unless TabTrainer wrote it or nobody knows
const artistOf = (t: string) => creditNames(/^\s*artist\s*:\s*(.+)$/im.exec(t)?.[1]).filter(n => !/^tabtrainer$/i.test(n)).join(', ');
function loadText(text: string) { if (scrollMode === 'continuous') setScrollMode('off'); clearTimeout(timer); src.value = text; draftSession.accept(text); announceSave(''); update(true); persistDraft(); }
function pickSong(v: string) {
  if (v === picked) { setScreen('practice', true); showLink(true); }
  else replaceCurrent(() => loadPickedSong(v, true));
}
function loadPickedSong(v: string, push = false) {
  const text = v.startsWith('demo:') ? demos[v.slice(5)] : library().find(x => 'lib:' + x.title === v)?.text;
  if (text === undefined) return;
  picked = v; setPref('picked', v); screen = 'practice';
  libraryKind = v.startsWith('demo:') ? demoKind(v.slice(5)) === 'exercises' ? 'exercises' : 'songs' : 'mine';
  setScreen('practice'); loadText(text); fillSongList(); showLink(push);
  if (push) { window.scrollTo(0, 0); $('title').focus({ preventScroll: true }); }
}
function showLink(push = false) {
  const route: Route = screen === 'library' ? { screen, kind: libraryKind, family }
    : { screen, picked, version: parsed && parsed.versions.length > 1 ? versionSlug(parsed.versions[versionIdx].name) : null };
  navigation.show(route, picked, push);
}
const siteTitle = document.title;
function showTitle() { document.title = screen === 'practice' && song ? `${song.meta.title} · TabTrainer` : siteTitle; }
function setScreen(next: 'library' | 'practice', focus = false) {
  if (next === 'library') { player.stop(); if (scrollMode === 'continuous') setScrollMode('off'); }
  if (next === 'practice' && song) { family = familyOf(song.meta.instrument); setPref('family', family); setSelectValue($<HTMLSelectElement>('familySelect'), family); }
  screen = next; document.body.classList.toggle('library-view', next === 'library');
  $('libraryScreen').hidden = next !== 'library'; $('practiceScreen').hidden = next !== 'practice';
  document.querySelector<HTMLElement>('.player')!.hidden = next !== 'practice';
  showTitle(); fillSongList(); showDirtyState();
  if (next === 'practice') requestAnimationFrame(draw);
  if (focus) { window.scrollTo(0, 0); $(next === 'library' ? 'libraryTitle' : 'title').focus({ preventScroll: true }); }
}
function showLibrary(kind: LibraryKind = libraryKind, push = true) {
  libraryKind = kind; setPref('libraryKind', kind); setScreen('library', screen !== 'library'); showLink(push);
}
function renderPracticeNavigation() {
  const counts = categoryCounts(catalogueEntries, family);
  document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => {
    if (isLibraryKind(button.dataset.kind)) button.querySelector<HTMLElement>('.nav-count')!.textContent = String(counts[button.dataset.kind]);
    if (button.dataset.kind === libraryKind) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  const current = catalogueEntries.find(e => e.value === picked);
  const kind = current?.kind ?? 'mine';
  $('backLibraryBtn').textContent = kind === 'exercises' ? '← All exercises' : kind === 'songs' ? '← All songs' : '← My songs';
  $('practiceName').textContent = song?.meta.title ?? 'Your song';
  $('practiceContext').textContent = `${song ? familyOf(song.meta.instrument) : family} / ${kind === 'exercises' ? 'exercise' : kind === 'songs' ? 'song' : 'your song'}`;
  const next = nextExercise(catalogueEntries, picked);
  $('exerciseContinuation').hidden = screen !== 'practice' || kind !== 'exercises' || continuationDismissed;
  $('nextExerciseBtn').hidden = !next; $('allExercisesBtn').hidden = !!next;
  if (next) { $('nextExerciseTitle').textContent = next.title; $('nextExerciseBtn').onclick = () => pickSong(next.value); }
  $('backLibraryBtn').onclick = () => showLibrary(kind);
  showShare();
}
$('homeBtn').onclick = () => showLibrary();
$('allExercisesBtn').onclick = () => showLibrary('exercises');
$('returnDraftBtn').onclick = () => { setScreen('practice', true); showLink(true); };
$('libraryOpenBtn').onclick = () => $('openBtn').click();
$('readTabBtn').onclick = $('readTabMobileBtn').onclick = () => $<HTMLDialogElement>('tabHelp').showModal();
document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => { button.onclick = () => { if (isLibraryKind(button.dataset.kind)) showLibrary(button.dataset.kind); }; });
$<HTMLSelectElement>('familySelect').onchange = e => { const value = (e.target as HTMLSelectElement).value; if (isFamily(value)) chooseFamily(value); };
function openRoute(route: Route) {
  if (route.screen === 'practice') {
    if (route.picked && route.picked !== picked) loadPickedSong(route.picked); else setScreen('practice');
    if (route.picked?.startsWith('demo:')) chooseVersionNamed(route.version);
    showLink();
    return;
  }
  if (route.family) { family = route.family; setSelectValue($<HTMLSelectElement>('familySelect'), family); }
  showLibrary(route.kind, false);
}
window.addEventListener('popstate', event => navigation.visit(event.state, (route, accept, cancel) => {
  const open = () => { accept(); openRoute(route); };
  if (route.screen === 'practice' && route.picked && route.picked !== picked && hasChanges()) replaceCurrent(open, cancel);
  else open();
}));

// ---------- parse + render ----------
let timer = 0;
src.addEventListener('input', () => { if (selectedNote) player.stop(); persistDraft(); clearTimeout(timer); timer = window.setTimeout(() => update(false), 300); });
function update(resetLoop: boolean) {
  const { song: all, issues } = parseSong(src.value);
  parsed = all;
  if (resetLoop) versionIdx = 0;
  versionIdx = Math.min(versionIdx, all.versions.length - 1);
  const s = withVersion(all, versionIdx);
  song = s; passage.setSong(s.bars.length, resetLoop);
  renderVersions(all);
  const ul = $('issues'); ul.innerHTML = '';
  issues.forEach(i => {
    const li = document.createElement('li'); li.className = i.severity; li.textContent = `Line ${i.line}: ${i.message}`;
    li.onclick = () => jumpToLine(i.line); ul.appendChild(li);
  });
  const errs = issues.filter(i => i.severity === 'error').length;
  $('status').textContent = errs ? `${errs} error${errs > 1 ? 's' : ''}` : `${s.bars.length} bar${s.bars.length === 1 ? '' : 's'} · ${s.meta.instrument.name}`;
  $('status').classList.toggle('bad', errs > 0); $('status').title = $('status').textContent ?? '';
  $('title').textContent = s.meta.title;
  renderMeta(s);
  $('about').textContent = s.meta.about ?? ''; $('about').hidden = !s.meta.about;
  const f = familyOf(s.meta.instrument);
  if (screen === 'practice' && f !== family) { family = f; setPref('family', f); showFamily(); }
  $('barTotal').textContent = String(s.bars.length || '–');
  showTitle();
  const wasPlaying = player.playing;
  player.load(buildTimeline(s), s.meta.tempo); onsets = onsetsOf(player.notes);
  renderPracticeNavigation(); applyLoop(); draw(); showSpeed(); if (wasPlaying) setPlayLabel();
}
function renderVersions(all: Song) {
  const box = $('versions'); box.replaceChildren();
  const details = $('versionDetails'); details.hidden = all.versions.length < 2;
  if (details.hidden) return;
  const levels = hasPracticeLevels(all.versions.map(v => v.name));
  $('versionLabel').textContent = levels ? 'Practice level' : 'Arrangement';
  box.setAttribute('aria-label', levels ? 'Practice level' : 'Arrangement');
  const help = $('versionHelp');
  help.hidden = !levels;
  help.textContent = levels ? [
    'Start slowly and get comfortable with the pattern.',
    'Build a steady rhythm as you practise.',
    'Try the pattern, then raise the speed when you are ready.',
  ][versionIdx] : '';
  all.versions.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = v.name; b.className = 'seg' + (i === versionIdx ? ' on' : '');
    b.setAttribute('aria-pressed', String(i === versionIdx));
    b.title = `${v.bars.length} bar${v.bars.length === 1 ? '' : 's'}`;
    b.onclick = () => chooseVersion(i);
    box.appendChild(b);
  });
}
function chooseVersion(i: number) {
  if (!parsed || i === versionIdx) return;
  player.stop(); versionIdx = i;
  update(false); showLink();
  if (song) { passage.setSong(song.bars.length, true); player.stop(); applyLoop(); }
}
function chooseVersionNamed(slug: string | null) {
  const i = parsed?.versions.findIndex(v => versionSlug(v.name) === slug) ?? -1;
  if (i >= 0) chooseVersion(i);
}
function renderMeta(s: Song) {
  renderCredit(s);
  const parts: [string, boolean][] = [[`♩ = ${s.meta.tempo}`, true], [`key ${s.meta.key}`, true], [s.meta.instrument.name, false]];
  const facts = parts.filter(([t]) => t).map(([t, num]) => { const e = document.createElement('span'); if (num) e.className = 'num'; e.textContent = t; return e; });
  if (s.meta.level) { const l = document.createElement('span'); l.className = `lvl lvl-${s.meta.level}`; l.textContent = s.meta.level; facts.unshift(l); }
  $('subtitle').replaceChildren(...facts);
}
function renderCredit(s: Song) {
  const names = creditNames(s.meta.artist).filter(n => !/^tabtrainer$/i.test(n));
  const byline = $('byline'); byline.hidden = !names.length;
  const traditional = names.length === 1 && /^traditional$/i.test(names[0]);
  byline.replaceChildren(...(traditional ? [] : [document.createTextNode('by ')]), ...names.flatMap((n, i) => {
    const b = document.createElement('b'); b.textContent = n;
    const sep = i === names.length - 1 ? [] : [document.createTextNode(i === names.length - 2 ? ' and ' : ', ')];
    return [b, ...sep];
  }));
  const link = $<HTMLAnchorElement>('listen'); link.hidden = !s.meta.listen;
  if (s.meta.listen) { link.href = s.meta.listen; $('listenHost').textContent = new URL(s.meta.listen).hostname.replace(/^www\./, ''); }
  $('credit').hidden = byline.hidden && link.hidden;
}
function jumpToLine(line: number) {
  const lines = src.value.split('\n'); let pos = 0; for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  src.focus(); src.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
}
function draw() {
  if (!song || screen !== 'practice') return;
  // measure the unzoomed parent: browsers disagree on whether a zoomed element reports its own width zoomed
  const box = getComputedStyle(sheet.parentElement!);
  const w = sheet.parentElement!.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight) - 12;
  const perLine = Math.max(1, Math.min(8, Math.round((w / zoom) / (showNota ? 300 : 240))));
  sheet.style.setProperty('zoom', String(zoom));
  renderSong(sheet, song, { barsPerLine: perLine, showNotation: showNota, width: w / zoom });
  lit = litKey ? [...sheet.querySelectorAll(`[data-key="${litKey}"]`)] : [];
  lit.forEach(element => element.classList.add('on'));
  curSys = systemAt(Number($('barNo').textContent)); curSys?.classList.add('cur');
  showPassage();
}
function systemAt(bar: number) {
  return [...sheet.querySelectorAll<HTMLElement>('.system')].find(system => bar >= +system.dataset.first! && bar <= +system.dataset.last!) ?? null;
}
let rz = 0; let lastW = window.innerWidth;
window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) < 60) return; lastW = window.innerWidth; clearTimeout(rz); rz = window.setTimeout(draw, 250); });

// ---------- player wiring ----------
const setPlayLabel = () => {
  const b = $('playBtn'); b.classList.toggle('pause', player.playing);
  b.setAttribute('aria-label', player.playing ? 'Pause' : player.canResume ? 'Resume' : 'Play');
};
let lit: Element[] = [], litKey: string | null = null, curSys: Element | null = null;
let selectedNote: { key: string; beat: number; bar: number } | null = null;
let onsets: number[] = [];
let playbackWasActive = false;
let lastPhase = player.phase;
player.on(({ beat, playing, phase, countInRemaining }) => {
  const display = $('countInDisplay');
  display.hidden = phase !== 'counting-in';
  display.textContent = phase === 'counting-in' ? `Count-in: ${countInRemaining ?? ''}` : '';
  if (phase !== lastPhase) {
    $('playbackStatus').textContent = phase === 'counting-in' ? 'Counting in' : phase === 'playing' ? 'Playing' : phase === 'paused' ? 'Paused' : 'Stopped';
    lastPhase = phase;
  }
  setPlayLabel();
  if (phase === 'counting-in') { playbackWasActive = false; return; }
  const started = player.playing && !playbackWasActive; playbackWasActive = player.playing;
  if (started && picked) { recordPractice(picked); fillSongList(); }
  if (beat === null) { selectedNote = null; passage.deselect(); showPassage(); lit.forEach(e => e.classList.remove('on')); lit = []; litKey = null; curSys?.classList.remove('cur'); curSys = null; $('barNo').textContent = '–'; return; }
  const key = playing ? onsetAt(onsets, beat) : null;
  if (key !== litKey) {
    lit.forEach(e => e.classList.remove('on'));
    lit = key ? [...sheet.querySelectorAll(`[data-key="${key}"]`)] : []; lit.forEach(e => e.classList.add('on')); litKey = key;
  }
  const bar = player.barAt(beat); $('barNo').textContent = bar ? String(bar) : '–';
  if (bar) {
    const sys = systemAt(bar);
    if (sys) {
      const changed = sys !== curSys;
      if (changed) { curSys?.classList.remove('cur'); sys.classList.add('cur'); curSys = sys; }
      if (scrollMode === 'follow' && player.playing && (changed || started)) { const r = sys.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.28, behavior: 'smooth' }); }
    }
  }
});
$('playBtn').onclick = () => player.toggle();
function stopPlayback() {
  if (scrollMode === 'continuous') setScrollMode('off');
  const note = selectedNote, bar = passage.snapshot().selected;
  player.stop(); passage.deselect();
  if (note) selectNote(note.key, note.bar); else if (bar) selectBar(bar);
  showPassage();
}
$('stopBtn').onclick = stopPlayback;
const speed = $<HTMLInputElement>('speed');
const fillRange = (r: HTMLInputElement) => r.style.setProperty('--fill', `${((+r.value - +r.min) / (+r.max - +r.min)) * 100}%`);
const showSpeed = () => {
  speed.value = String(Math.round(player.speed * 100));
  const bpm = Math.round(player.tempo * player.speed), q = document.createElement('span'); q.textContent = `  ♩${bpm}`;
  $('speedOut').replaceChildren(speed.value + '%', q); fillRange(speed);
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.speed === speed.value)));
};
speed.value = String(pref('speed', 100)); player.speed = +speed.value / 100;
speed.oninput = () => { const value = +speed.value; player.setSpeed(value / 100); setPref('speed', value); showSpeed(); };
document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => { b.onclick = () => { speed.value = b.dataset.speed!; speed.dispatchEvent(new Event('input')); }; });
const panels = document.querySelectorAll<HTMLDetailsElement>('.timing, .speed-practice');
document.addEventListener('click', e => { panels.forEach(panel => { if (!panel.contains(e.target as Node)) panel.open = false; }); });
panels.forEach(panel => panel.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.stopPropagation(); panel.open = false; panel.querySelector('summary')!.focus(); }
}));
const practiceEnabled = $<HTMLInputElement>('speedPracticeChk');
const practiceRepetitions = $<HTMLInputElement>('speedPracticeRepetitions');
const practiceIncrease = $<HTMLInputElement>('speedPracticeIncrease');
const practiceTarget = $<HTMLInputElement>('speedPracticeTarget');
const practiceError = $('speedPracticeError');
const savedPractice = pref('speedPractice', { repetitions: 4, increase: 5, target: Math.max(100, Math.round(player.speed * 100)) });
practiceRepetitions.value = String(savedPractice.repetitions); practiceIncrease.value = String(savedPractice.increase); practiceTarget.value = String(savedPractice.target);
function practiceConfig() {
  return { repetitions: practiceRepetitions.valueAsNumber, increase: practiceIncrease.valueAsNumber, target: practiceTarget.valueAsNumber };
}
function validatePractice() {
  const config = practiceConfig();
  const error = !isSpeedPracticeConfig(config) ? 'Enter whole numbers within the shown limits.' : config.target < Math.round(player.speed * 100) ? 'Target must be at least the current speed.' : '';
  practiceError.textContent = error;
  return isSpeedPracticeConfig(config) && !error ? config : null;
}
function showPractice() {
  const state = player.speedPracticeState;
  practiceEnabled.checked = state.enabled;
  practiceEnabled.disabled = !passage.snapshot().repeat;
  const progress = $('speedPracticeProgress');
  progress.hidden = !state.enabled;
  progress.textContent = state.reached ? `Target reached: ${state.speed}%` : `${state.speed}%, repetition ${state.completed + 1} of ${state.repetitions}, target ${state.target}%`;
}
player.onSpeedPractice((state, reason) => {
  showSpeed(); showPractice();
  if (reason === 'increase' || reason === 'target' || reason === 'reset') setPref('speed', Math.round(player.speed * 100));
  if (reason === 'enabled' || reason === 'ended') $('speedPracticeStatus').textContent = '';
  if (reason === 'increase') $('speedPracticeStatus').textContent = `Speed increased to ${state.speed}%.`;
  if (reason === 'target') $('speedPracticeStatus').textContent = `Target reached: ${state.speed}%.`;
});
practiceEnabled.onchange = () => {
  if (!practiceEnabled.checked) { player.setSpeedPractice(null); showPractice(); return; }
  const config = validatePractice();
  if (!config || !player.setSpeedPractice(config)) {
    if (config) practiceError.textContent = 'Turn on Loop bars to enable gradual speed increases.';
    showPractice(); return;
  }
  setPref('speedPractice', config); showPractice();
};
[practiceRepetitions, practiceIncrease, practiceTarget].forEach(input => input.addEventListener('input', () => {
  if (player.speedPracticeState.enabled) player.setSpeedPractice(null);
  validatePractice();
  const config = practiceConfig();
  if (isSpeedPracticeConfig(config)) setPref('speedPractice', config);
  showPractice();
}));
showPractice();
const metronome = $<HTMLInputElement>('metronomeChk');
const countIn = $<HTMLSelectElement>('countInSelect');
const clickVolume = $<HTMLInputElement>('clickVolume');
metronome.checked = pref('metronome', false); player.setMetronome(metronome.checked);
setSelectValue(countIn, pref('countIn', false) ? 'bar' : 'off'); player.setCountIn(countIn.value === 'bar');
clickVolume.value = String(pref('clickVolume', 50)); player.setClickVolume(+clickVolume.value / 100);
const showClickVolume = () => { $('clickVolumeOut').textContent = `${clickVolume.value}%`; fillRange(clickVolume); };
showClickVolume();
metronome.onchange = () => { player.setMetronome(metronome.checked); setPref('metronome', metronome.checked); };
countIn.onchange = () => { const enabled = countIn.value === 'bar'; player.setCountIn(enabled); setPref('countIn', enabled); };
clickVolume.oninput = () => { player.setClickVolume(+clickVolume.value / 100); setPref('clickVolume', +clickVolume.value); showClickVolume(); };

function showPassage() {
  const state = passage.snapshot();
  $<HTMLInputElement>('loopA').value = String(state.first);
  $<HTMLInputElement>('loopB').value = String(state.last);
  $<HTMLInputElement>('loopA').max = $<HTMLInputElement>('loopB').max = String(state.count);
  $<HTMLInputElement>('loopChk').checked = state.repeat;
  showPractice();
  sheet.querySelectorAll<SVGElement>('.note-target').forEach(el => {
    const selected = el.dataset.key === selectedNote?.key;
    el.classList.toggle('selected', selected);
    el.setAttribute('aria-pressed', String(selected));
  });
  sheet.querySelectorAll<SVGElement>('.bar-target').forEach(el => {
    const bar = +el.dataset.bar!;
    el.classList.toggle('in-range', state.active && passage.includes(bar));
    el.classList.toggle('selected', bar === state.selected);
    el.setAttribute('aria-pressed', String(bar === state.selected));
  });
  for (const id of ['rangeStart', 'rangeEnd']) $<HTMLButtonElement>(id).disabled = !state.selected;
  $<HTMLButtonElement>('rangeReset').disabled = !state.selected && !state.active;
  const note = selectedNote;
  if (note) {
    const start = player.bars.find(bar => bar.bar === note.bar)?.start ?? 0;
    const beatValue = song?.bars.find(bar => bar.index === note.bar)?.beatValue ?? 4;
    const beat = Number(((note.beat - start) * beatValue / 4 + 1).toFixed(3));
    const range = state.active ? `Bars ${state.first}-${state.last}, ${state.repeat ? 'repeating' : 'play once'}.` : 'Whole song, play once.';
    $('rangeSummary').textContent = `Selected note in bar ${note.bar}, beat ${beat}. ${range}`;
  } else $('rangeSummary').textContent = passage.summary();
}
function setPlayerRange() {
  const range = passage.range();
  player.setRange(range ? player.barRange(...range) : null, passage.snapshot().repeat);
}
function applyLoop() {
  if (!song?.bars.length) return;
  setPlayerRange();
  if (selectedNote && player.range && (selectedNote.beat < player.range[0] || selectedNote.beat >= player.range[1])) selectedNote = null;
  const beat = player.pausedAt;
  if (!player.playing && player.range && (beat === null || beat < player.range[0] || beat >= player.range[1])) {
    passage.selectStart(); player.seek(player.range[0]);
  }
  showPassage();
}
function selectBar(bar: number) {
  if (!passage.select(bar)) return;
  selectedNote = null;
  setPlayerRange();
  const span = player.bars.find(span => span.bar === bar);
  if (span) player.seek(span.start);
  showPassage();
}
$('rangeStart').onclick = () => { passage.startAtSelection(); applyLoop(); };
$('rangeEnd').onclick = () => { passage.endAtSelection(); applyLoop(); };
$('rangeReset').onclick = () => {
  passage.clear(); applyLoop(); player.stop(); passage.deselect(); showPassage();
  const first = sheet.querySelector<SVGElement>('.bar-target'); if (first) first.focus(); else $('title').focus();
};
['loopChk', 'loopA', 'loopB'].forEach(id => $(id).addEventListener('change', () => {
  passage.setRange($<HTMLInputElement>('loopA').valueAsNumber, $<HTMLInputElement>('loopB').valueAsNumber, $<HTMLInputElement>('loopChk').checked);
  applyLoop();
}));

function selectNote(key: string, bar: number) {
  const note = player.noteAtKey(key);
  if (!note || note.bar !== bar || !passage.select(bar)) return false;
  selectedNote = { key: note.key, beat: note.beat, bar: note.bar };
  setPlayerRange();
  player.seekNote(key);
  showPassage();
  return true;
}
sheet.addEventListener('click', e => {
  const note = (e.target as Element).closest<SVGElement>('.note-target');
  if (note) { selectNote(note.dataset.key!, +note.dataset.bar!); return; }
  const bar = (e.target as Element).closest<SVGElement>('.bar-target');
  if (bar) selectBar(+bar.dataset.bar!);
});
sheet.addEventListener('dblclick', e => {
  const note = (e.target as Element).closest<SVGElement>('.note-target');
  if (note && selectNote(note.dataset.key!, +note.dataset.bar!)) player.play(selectedNote!.beat);
});
sheet.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const note = (e.target as Element).closest<SVGElement>('.note-target');
  const bar = (e.target as Element).closest<SVGElement>('.bar-target');
  if (note || bar) {
    e.preventDefault(); e.stopPropagation();
    if (note) selectNote(note.dataset.key!, +note.dataset.bar!);
    else if (bar) selectBar(+bar.dataset.bar!);
  }
});

// ---------- auto-scroll ----------
type ScrollMode = 'off' | 'follow' | 'continuous';
let scrollMode: ScrollMode = 'follow';
const sspeed = $<HTMLInputElement>('scrollSpeed'); sspeed.value = String(pref('scroll', 15));
fillRange(sspeed);
sspeed.oninput = () => { setPref('scroll', +sspeed.value); fillRange(sspeed); };
const scroller = new AutoScroller({
  request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
  scroll: pixels => window.scrollBy(0, pixels), speed: () => +sspeed.value,
  atBottom: () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2,
  ended: () => setScrollMode('off'),
});
function setScrollMode(mode: ScrollMode) {
  scroller.stop(); scrollMode = mode;
  setSelectValue($<HTMLSelectElement>('scrollMode'), mode);
  $('scrollRate').hidden = mode !== 'continuous';
  $('scrollHelp').textContent = { off: 'Scroll the score yourself.', follow: 'Keep the playing line in view.', continuous: 'Scroll without audio. Play and Pause keep scrolling; Stop and song changes turn it off.' }[mode];
  if (mode === 'continuous') scroller.start();
  if (mode === 'follow') { curSys?.classList.remove('cur'); curSys = null; }
}
$<HTMLSelectElement>('scrollMode').onchange = e => {
  const value = (e.target as HTMLSelectElement).value;
  if (value === 'off' || value === 'follow' || value === 'continuous') setScrollMode(value);
};

// ---------- keyboard ----------
const shortcut = playbackShortcut(() => screen === 'practice', () => player.playing, () => player.play(), () => player.pause());
document.addEventListener('keydown', shortcut.keydown, true);
document.addEventListener('keyup', shortcut.keyup, true);
window.addEventListener('blur', shortcut.blur);
document.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (screen !== 'practice' || t.closest('button, summary, input, select, textarea, dialog, [role=separator]') || t.isContentEditable) return;
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); setScrollMode(scrollMode === 'continuous' ? 'off' : 'continuous'); }
  else if (scrollMode === 'continuous' && e.key === 'ArrowUp') { e.preventDefault(); sspeed.value = String(Math.min(80, +sspeed.value + 2)); sspeed.dispatchEvent(new Event('input')); }
  else if (scrollMode === 'continuous' && e.key === 'ArrowDown') { e.preventDefault(); sspeed.value = String(Math.max(3, +sspeed.value - 2)); sspeed.dispatchEvent(new Event('input')); }
});

// ---------- toolbar ----------
const unpick = () => { picked = ''; libraryKind = 'mine'; setPref('picked', ''); fillSongList(); };
const fileMenu = document.querySelector<HTMLDetailsElement>('.file-menu')!;
$('openBtn').onclick = () => $<HTMLInputElement>('openFile').click();
fileMenu.addEventListener('click', e => {
  if ((e.target as Element).closest('button')) {
    const returnFocus = fileMenu.contains(document.activeElement);
    fileMenu.open = false;
    if (returnFocus) fileMenu.querySelector('summary')!.focus();
  }
});
document.addEventListener('click', e => {
  if (!fileMenu.contains(e.target as Node)) fileMenu.open = false;
});
fileMenu.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.stopPropagation(); fileMenu.open = false; fileMenu.querySelector('summary')!.focus();
  }
});
const hasChanges = () => draftSession.hasChanges();
// The link opens the bundled song, so it would drop unsaved edits.
function showShare() { $('shareBtn').hidden = !picked.startsWith('demo:') || draftSession.hasChanges(); }
function showDirtyState() {
  $('returnDraftBtn').hidden = screen !== 'library' || !hasChanges();
  document.querySelector<HTMLElement>('.save-state')!.hidden = !hasChanges() && !$('saveFeedback').textContent;
  showShare();
  $('dirtyState').textContent = hasChanges() ? `Unsaved changes${draftSession.stored ? '' : ' (draft recovery unavailable)'}` : 'No unsaved changes';
}
function announceSave(message: string, failed = false, offerDownload = failed) {
  $('saveFeedback').textContent = message;
  $('saveFeedback').classList.toggle('bad', failed);
  $('recoverDownload').hidden = !offerDownload; showDirtyState();
}
function persistDraft() {
  draftSession.persist(picked);
  showDirtyState();
  if (!draftSession.stored && hasChanges()) announceSave('Could not keep this draft in the browser. Download a copy.', true);
}
function replaceCurrent(action: () => void, cancel: (() => void) | null = null) {
  draftSession.replace(action, cancel, () => {
    const dialog = $<HTMLDialogElement>('replaceDialog'); dialog.returnValue = 'cancel'; dialog.showModal();
  });
}
$<HTMLDialogElement>('replaceDialog').addEventListener('close', () => {
  draftSession.resolve($<HTMLDialogElement>('replaceDialog').returnValue, saveCurrent, showLink);
});
function saveCurrent(): boolean {
  const result = draftSession.save(title => window.confirm(`Replace "${title}" in your library?`));
  if (result.status === 'cancelled') return false;
  if (result.status === 'failed') { announceSave('Could not save in this browser. Your text is still here. Download a copy.', true); return false; }
  const { title } = result;
  picked = 'lib:' + title; libraryKind = 'mine'; setPref('picked', picked); persistDraft(); fillSongList(); showLink();
  announceSave(`Saved "${title}" in this browser`); return true;
}
$('newBtn').onclick = () => replaceCurrent(() => { const text = newSong(); unpick(); setScreen('practice'); loadText(text); showLink(true); showEditor(true); src.focus(); });
$('saveBtn').onclick = () => { saveCurrent(); };
$('recoverDownload').onclick = () => $('dlBtn').click();
$('dlBtn').onclick = () => {
  const blob = new Blob([src.value], { type: 'text/plain' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = titleOf(src.value).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.txt';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$<HTMLInputElement>('openFile').onchange = async e => {
  const input = e.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
  const generation = draftSession.beginNavigation(); input.value = '';
  try {
    const text = await file.text();
    if (draftSession.isCurrent(generation)) replaceCurrent(() => { unpick(); setScreen('practice'); loadText(text); showLink(true); });
  } catch { announceSave('Could not open that file. Your current text is still here.', true); }
};
const showEditor = (on: boolean) => { document.querySelector('.layout')!.classList.toggle('noedit', !on); $('editBtn').classList.toggle('on', on); $('editBtn').setAttribute('aria-pressed', String(on)); setPref('editor', on); setTimeout(draw, 50); };
editorResize($('editorPane'), $('editorResize'), draw);
$('hideEditorBtn').onclick = () => { showEditor(false); $('editBtn').focus(); };
$('shareBtn').onclick = async () => {
  const version = parsed && parsed.versions.length > 1 ? versionSlug(parsed.versions[versionIdx].name) : null;
  const root = new URL(import.meta.env.BASE_URL, location.origin).href;
  // Only the build writes the per-song pages.
  const url = import.meta.env.DEV ? `${root}?${new URLSearchParams({ song: songSlug(picked.slice(5)), ...version && { version } })}` : shareUrl(root, picked.slice(5), version);
  try {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    announceSave(`Link copied: ${url}`);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) announceSave(`Could not copy the link: ${url}`, true, false);
  }
};
$('editBtn').onclick = () => showEditor(document.querySelector('.layout')!.classList.contains('noedit'));
const showNotationState = () => { $('notaBtn').setAttribute('aria-pressed', String(showNota)); $('tabBtn').setAttribute('aria-pressed', String(!showNota)); };
const setNotation = (on: boolean) => { showNota = on; setPref('notation', on); $('notaBtn').classList.toggle('on', on); $('tabBtn').classList.toggle('on', !on); showNotationState(); draw(); };
$('notaBtn').onclick = () => setNotation(true);
$('tabBtn').onclick = () => setNotation(false);
$('zoomIn').onclick = () => { zoom = Math.min(1.8, +(zoom + 0.1).toFixed(2)); setPref('zoom', zoom); draw(); };
$('zoomOut').onclick = () => { zoom = Math.max(0.6, +(zoom - 0.1).toFixed(2)); setPref('zoom', zoom); draw(); };
const setPlayerExpanded = (open: boolean) => { document.querySelector('.player')!.classList.toggle('open', open); $('moreBtn').setAttribute('aria-expanded', String(open)); setPref('playerExpanded', open); };
setPlayerExpanded(pref('playerExpanded', false));
$('moreBtn').onclick = () => setPlayerExpanded($('moreBtn').getAttribute('aria-expanded') !== 'true');
const setPlayerMinimized = (minimized: boolean) => {
  document.documentElement.classList.toggle('player-min', minimized);
  const label = minimized ? 'Show the controls' : 'Hide the controls', button = $('minimizeBtn');
  button.setAttribute('aria-expanded', String(!minimized)); button.setAttribute('aria-label', label); button.title = label;
  setPref('playerMinimized', minimized);
};
setPlayerMinimized(pref('playerMinimized', false));
$('minimizeBtn').onclick = () => { setPlayerMinimized(!document.documentElement.classList.contains('player-min')); draw(); };
$('closeContinuationBtn').onclick = () => { continuationDismissed = true; $('playBtn').focus(); $('exerciseContinuation').hidden = true; };
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const showTheme = (theme: 'light' | 'dark') => {
  document.documentElement.dataset.theme = theme;
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  $('themeBtn').setAttribute('aria-label', label); $('themeBtn').title = label;
};
showTheme(pref('theme', null) ?? (systemDark.matches ? 'dark' : 'light'));
systemDark.addEventListener('change', e => { if (pref('theme', null) === null) showTheme(e.matches ? 'dark' : 'light'); });
$('themeBtn').onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setPref('theme', next === (systemDark.matches ? 'dark' : 'light') ? null : next); showTheme(next);
};
$('syntaxHelpBtn').onclick = () => $<HTMLDialogElement>('help').showModal();
(window as never as { tabtrainer: unknown }).tabtrainer = { player, removeSong, onsetKey };

// the player wraps at narrow widths; reserve exactly its height below the page and the sticky editor
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--deck-h', `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)).observe(document.querySelector('.player')!);
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--top-h', `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)).observe(document.querySelector('.top')!);
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--continuation-h', `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)).observe($('exerciseContinuation'));
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--save-state-h', `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)).observe(document.querySelector('.save-state')!);

// ---------- start ----------
$('notaBtn').classList.toggle('on', showNota); $('tabBtn').classList.toggle('on', !showNota);
showNotationState();
setPlayLabel();
showEditor(pref('editor', false));
const lastText = pref('last', null), lastPick = resolvePick(pref('picked', ''));
const link = new URLSearchParams(location.search);
const linked = findBySlug(Object.keys(demos), link.get('song') ?? '');
const storedDraft = pref('draft', null);
const draft = storedDraft ? { ...storedDraft, picked: resolvePick(storedDraft.picked) } : null;
const requested = linked ? 'demo:' + linked : initialQuery.get('view') === 'practice' && initialNavigation?.picked.startsWith('lib:') && library().some(s => 'lib:' + s.title === initialNavigation.picked) ? initialNavigation.picked : null;
const recover = draft && (draft.text !== draft.base || !requested || draft.picked === requested);
if (recover) {
  picked = draft.picked; src.value = draft.text; draftSession.recover(draft);
  update(true); showDirtyState();
  if (requested && draft.picked !== requested) replaceCurrent(() => { loadPickedSong(requested); chooseVersionNamed(link.get('version')); });
  else if (linked) chooseVersionNamed(link.get('version'));
} else if (requested) {
  loadPickedSong(requested);
  chooseVersionNamed(link.get('version'));
} else if (lastText) {
  const pickedText = lastPick.startsWith('demo:') ? demos[lastPick.slice(5)] : library().find(x => 'lib:' + x.title === lastPick)?.text;
  picked = pickedText === undefined ? '' : lastPick;
  loadText(lastText); draftSession.accept(pickedText ?? lastText); persistDraft();
} else {
  picked = 'demo:' + songsFor(family).demos[0];
  loadText(demos[picked.slice(5)]);
}
showFamily();
setScreen(screen);
showLink();

enhanceDropdowns();
