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
import './ui/library/library.css';
import './ui/practice/practice.css';
import './ui/player/player.css';
import './ui/shell/dropdown.css';
import { enhanceDropdowns, setSelectValue } from './ui/shell/dropdown';
import { buildTimeline, onsetAt, onsetKey, onsetsOf } from './core/timeline';
import type { Song } from './core/model';
import { FAMILIES, familyOf, isFamily, type Family } from './core/instruments';
import { Player } from './audio/player';
import { library, removeSong, pref, recentPractice, recordPractice } from './app/storage';
import { normalizeSongReference, shareUrl, songSlug } from './app/songLink';
import { bundledPath, savedRef } from './app/songRef';
import { shownCredits } from './app/credits';
import { Songbook } from './app/songbook';
import { OpenSong } from './app/openSong';
import { Workspace, type Screen } from './app/workspace';
import { startupPlan } from './app/startup';
import { Passage } from './app/passage';
import { PassagePlayback, beatInBar } from './app/passagePlayback';
import { passageControls } from './ui/player/passageControls';
import { playbackShortcut } from './app/playbackShortcut';
import { Navigation, navigationState, type Route } from './app/navigation';
import { DraftSession, titleOf } from './app/draftSession';
import { editorPane } from './ui/editor/editorPane';
import { playerPanel } from './ui/player/playerPanel';
import { theme } from './ui/shell/theme';
import { closeOnChoice, closeOnOutside } from './ui/shell/disclosure';
import { publishHeight } from './ui/shell/layoutMetrics';
import { libraryView } from './ui/library/libraryView';
import { hasPracticeLevels } from './app/practiceLevels';
import { categoryCounts, isLibraryKind, nextExercise, type CatalogueEntry, type LibraryKind } from './app/catalogue';
import { dismissHelpOnBackdrop } from './ui/shell/helpDialogs';
import { byId, one } from './ui/dom';
import { scrollControls } from './ui/player/scrollControls';
import { speedControls } from './ui/player/speedControls';
import { speedPracticePanel } from './ui/player/speedPracticePanel';
import { timingPanel } from './ui/player/timingPanel';
import { transport } from './ui/player/transport';
import { scoreView } from './ui/practice/scoreView';

const songbook = new Songbook(import.meta.glob('./songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>, library);
const $ = byId;
['help', 'tabHelp'].forEach(id => dismissHelpOnBackdrop($(id, HTMLDialogElement)));

const resolvePick = (value: string) => normalizeSongReference(value, songbook.paths);
const storedNavigation = navigationState(history.state);
const navigation = new Navigation(history, location, songbook.paths);
const workspace = Workspace.fromQuery(location.search);
let catalogueEntries: CatalogueEntry[] = [];

const src = $('src', HTMLTextAreaElement), player = new Player();
const openSong = new OpenSong();
const passage = new Passage();
const passagePlayback = new PassagePlayback(player, passage);
const draftSession = new DraftSession(() => src.value);
let continuationDismissed = false;
const score = scoreView({
  redraw: draw,
  onBar: selectBar,
  onNote: selectNote,
  onPlayNote: (key, bar) => { const chosen = selectNote(key, bar) ? passagePlayback.selectedNote : null; if (chosen) player.play(chosen.beat); },
});

// ---------- song list ----------

const newSong = () => `title: New song\ninstrument: ${FAMILIES[workspace.family]}\ntempo: 90\nkey: C\ntime: 4/4\n\n@Intro\n"C" :q 3.3 3.3 5.2 3.3 |\n`;
const catalogue = libraryView(v => pickSong(v), () => $('newBtn').click(), () => $('openBtn').click(), () => { showLibrary('exercises'); $('libraryTitle').focus({ preventScroll: true }); });
function fillSongList() {
  catalogueEntries = songbook.entries();
  catalogue.show(catalogueEntries, workspace.family, workspace.kind, recentPractice().map(resolvePick));
  renderPracticeNavigation();
}
function showFamily() { setSelectValue($('familySelect', HTMLSelectElement), workspace.family); fillSongList(); }
function chooseFamily(f: Family) {
  if (workspace.chooseFamily(f)) { showFamily(); showLink(); }
}
function loadText(text: string) { scrolling.stopContinuous(); clearTimeout(timer); src.value = text; draftSession.accept(text); announceSave(''); update(true); persistDraft(); }
function pickSong(v: string) {
  if (v === workspace.picked) { setScreen('practice', true); showLink(true); }
  else replaceCurrent(() => loadPickedSong(v, true));
}
function loadPickedSong(v: string, push = false) {
  const text = songbook.text(v);
  if (text === undefined) return;
  workspace.openSong(v, songbook.kind(v));
  setScreen('practice'); loadText(text); fillSongList(); showLink(push);
  if (push) { window.scrollTo(0, 0); $('title').focus({ preventScroll: true }); }
}
function showLink(push = false) {
  navigation.show(workspace.route(openSong.versionSlug()), workspace.picked, push);
}
const siteTitle = document.title;
function showTitle() { const song = openSong.song; document.title = workspace.screen === 'practice' && song ? `${song.meta.title} · TabTrainer` : siteTitle; }
function setScreen(next: Screen, focus = false) {
  if (next === 'library') { player.stop(); scrolling.stopContinuous(); }
  const song = openSong.song;
  workspace.enter(next, song ? familyOf(song.meta.instrument) : null);
  if (next === 'practice' && song) setSelectValue($('familySelect', HTMLSelectElement), workspace.family);
  document.body.classList.toggle('library-view', next === 'library');
  $('libraryScreen').hidden = next !== 'library'; $('practiceScreen').hidden = next !== 'practice';
  one('.player').hidden = next !== 'practice';
  showTitle(); fillSongList(); showDirtyState();
  if (next === 'practice') requestAnimationFrame(draw);
  if (focus) { window.scrollTo(0, 0); $(next === 'library' ? 'libraryTitle' : 'title').focus({ preventScroll: true }); }
}
function showLibrary(kind: LibraryKind = workspace.kind, push = true) {
  const arriving = workspace.screen !== 'library';
  workspace.chooseKind(kind); setScreen('library', arriving); showLink(push);
}
function renderPracticeNavigation() {
  const counts = categoryCounts(catalogueEntries, workspace.family);
  document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => {
    if (isLibraryKind(button.dataset.kind)) button.querySelector<HTMLElement>('.nav-count')!.textContent = String(counts[button.dataset.kind]);
    if (button.dataset.kind === workspace.kind) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  const current = catalogueEntries.find(e => e.value === workspace.picked);
  const kind = current?.kind ?? 'mine';
  $('backLibraryBtn').textContent = kind === 'exercises' ? '← All exercises' : kind === 'songs' ? '← All songs' : '← My songs';
  const song = openSong.song;
  $('practiceName').textContent = song?.meta.title ?? 'Your song';
  $('practiceContext').textContent = `${song ? familyOf(song.meta.instrument) : workspace.family} / ${kind === 'exercises' ? 'exercise' : kind === 'songs' ? 'song' : 'your song'}`;
  const next = nextExercise(catalogueEntries, workspace.picked);
  $('exerciseContinuation').hidden = workspace.screen !== 'practice' || kind !== 'exercises' || continuationDismissed;
  $('nextExerciseBtn').hidden = !next; $('allExercisesBtn').hidden = !!next;
  if (next) { $('nextExerciseTitle').textContent = next.title; $('nextExerciseBtn').onclick = () => pickSong(next.value); }
  $('backLibraryBtn').onclick = () => showLibrary(kind);
  showShare();
}
$('homeBtn').onclick = () => showLibrary();
$('allExercisesBtn').onclick = () => showLibrary('exercises');
$('returnDraftBtn').onclick = () => { setScreen('practice', true); showLink(true); };
$('libraryOpenBtn').onclick = () => $('openBtn').click();
$('readTabBtn').onclick = $('readTabMobileBtn').onclick = () => $('tabHelp', HTMLDialogElement).showModal();
document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => { button.onclick = () => { if (isLibraryKind(button.dataset.kind)) showLibrary(button.dataset.kind); }; });
$('familySelect', HTMLSelectElement).onchange = e => { const value = (e.target as HTMLSelectElement).value; if (isFamily(value)) chooseFamily(value); };
function openRoute(route: Route) {
  if (route.screen === 'practice') {
    if (route.picked && route.picked !== workspace.picked) loadPickedSong(route.picked); else setScreen('practice');
    if (route.picked && bundledPath(route.picked) !== null) chooseVersionNamed(route.version);
    showLink();
    return;
  }
  if (route.family) { workspace.visitFamily(route.family); setSelectValue($('familySelect', HTMLSelectElement), workspace.family); }
  showLibrary(route.kind, false);
}
window.addEventListener('popstate', event => navigation.visit(event.state, (route, accept, cancel) => {
  const open = () => { accept(); openRoute(route); };
  if (route.screen === 'practice' && route.picked && route.picked !== workspace.picked && hasChanges()) replaceCurrent(open, cancel);
  else open();
}));

// ---------- parse + render ----------
let timer = 0;
src.addEventListener('input', () => { if (passagePlayback.selectedNote) player.stop(); persistDraft(); clearTimeout(timer); timer = window.setTimeout(() => update(false), 300); });
function update(resetLoop: boolean) {
  const { song: s, issues } = openSong.read(src.value, resetLoop);
  passage.setSong(s.bars.length, resetLoop);
  renderVersions();
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
  if (workspace.followSong(f)) showFamily();
  $('barTotal').textContent = String(s.bars.length || '–');
  showTitle();
  const wasPlaying = player.playing;
  player.load(buildTimeline(s), s.meta.tempo); onsets = onsetsOf(player.notes);
  renderPracticeNavigation(); applyLoop(); draw(); speed.show(); if (wasPlaying) transportView.showPlayButton();
}
function renderVersions() {
  const versions = openSong.versions, versionIdx = openSong.versionIndex;
  const box = $('versions'); box.replaceChildren();
  const details = $('versionDetails'); details.hidden = versions.length < 2;
  if (details.hidden) return;
  const levels = hasPracticeLevels(versions.map(v => v.name));
  $('versionLabel').textContent = levels ? 'Practice level' : 'Arrangement';
  box.setAttribute('aria-label', levels ? 'Practice level' : 'Arrangement');
  const help = $('versionHelp');
  help.hidden = !levels;
  help.textContent = levels ? [
    'Start slowly and get comfortable with the pattern.',
    'Build a steady rhythm as you practise.',
    'Try the pattern, then raise the speed when you are ready.',
  ][versionIdx] : '';
  versions.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = v.name; b.className = 'seg' + (i === versionIdx ? ' on' : '');
    b.setAttribute('aria-pressed', String(i === versionIdx));
    b.title = `${v.bars.length} bar${v.bars.length === 1 ? '' : 's'}`;
    b.onclick = () => chooseVersion(i);
    box.appendChild(b);
  });
}
function chooseVersion(i: number) { if (openSong.choose(i)) showVersion(); }
function chooseVersionNamed(slug: string | null) { if (openSong.chooseNamed(slug)) showVersion(); }
function showVersion() {
  player.stop();
  update(false); showLink();
  const song = openSong.song;
  if (song) { passage.setSong(song.bars.length, true); player.stop(); applyLoop(); }
}
function renderMeta(s: Song) {
  renderCredit(s);
  const parts: [string, boolean][] = [[`♩ = ${s.meta.tempo}`, true], [`key ${s.meta.key}`, true], [s.meta.instrument.name, false]];
  const facts = parts.filter(([t]) => t).map(([t, num]) => { const e = document.createElement('span'); if (num) e.className = 'num'; e.textContent = t; return e; });
  if (s.meta.level) { const l = document.createElement('span'); l.className = `lvl lvl-${s.meta.level}`; l.textContent = s.meta.level; facts.unshift(l); }
  $('subtitle').replaceChildren(...facts);
}
function renderCredit(s: Song) {
  const names = shownCredits(s.meta.artist);
  const byline = $('byline'); byline.hidden = !names.length;
  const traditional = names.length === 1 && /^traditional$/i.test(names[0]);
  byline.replaceChildren(...(traditional ? [] : [document.createTextNode('by ')]), ...names.flatMap((n, i) => {
    const b = document.createElement('b'); b.textContent = n;
    const sep = i === names.length - 1 ? [] : [document.createTextNode(i === names.length - 2 ? ' and ' : ', ')];
    return [b, ...sep];
  }));
  const link = $('listen', HTMLAnchorElement); link.hidden = !s.meta.listen;
  if (s.meta.listen) { link.href = s.meta.listen; $('listenHost').textContent = new URL(s.meta.listen).hostname.replace(/^www\./, ''); }
  $('credit').hidden = byline.hidden && link.hidden;
}
function jumpToLine(line: number) {
  const lines = src.value.split('\n'); let pos = 0; for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  src.focus(); src.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
}
function draw() {
  const song = openSong.song;
  if (!song || workspace.screen !== 'practice') return;
  score.draw(song);
  showPassage();
}

// ---------- player wiring ----------
let onsets: number[] = [];
let playbackWasActive = false;
player.on(state => {
  transportView.show(state);
  if (state.phase === 'counting-in') { playbackWasActive = false; return; }
  const started = player.playing && !playbackWasActive; playbackWasActive = player.playing;
  if (started && workspace.picked) { recordPractice(workspace.picked); fillSongList(); }
  if (state.beat === null) { passagePlayback.deselect(); showPassage(); score.clear(); transportView.showBar(null); return; }
  score.highlight(state.playing ? onsetAt(onsets, state.beat) : null);
  const bar = player.barAt(state.beat); transportView.showBar(bar);
  const newLine = score.showBar(bar);
  if (scrolling.follows() && player.playing && (newLine || started)) score.followLine();
});
function stopPlayback() {
  scrolling.stopContinuous();
  passagePlayback.stop();
  showPassage();
}
const transportView = transport(player, stopPlayback);
const speed = speedControls(player);
document.querySelectorAll<HTMLDetailsElement>('.timing, .speed-practice').forEach(closeOnOutside);
const speedPractice = speedPracticePanel(player, () => passage.snapshot().repeat, speed.show);
timingPanel(player);

function showPassage() {
  const state = passage.snapshot();
  speedPractice.show();
  score.markPassage({ selectedNote: passagePlayback.selectedNote?.key, selectedBar: state.selected, inPassage: bar => state.active && passage.includes(bar) });
  const note = passagePlayback.selectedNote;
  let summary = passage.summary();
  if (note) {
    const start = player.bars.find(bar => bar.bar === note.bar)?.start ?? 0;
    const beatValue = openSong.song?.bars.find(bar => bar.index === note.bar)?.beatValue ?? 4;
    const range = state.active ? `Bars ${state.first}-${state.last}, ${state.repeat ? 'repeating' : 'play once'}.` : 'Whole song, play once.';
    summary = `Selected note in bar ${note.bar}, beat ${beatInBar(note.beat, start, beatValue)}. ${range}`;
  }
  passageView.show(state, summary);
}
function applyLoop() {
  if (!openSong.song?.bars.length) return;
  passagePlayback.apply();
  showPassage();
}
function selectBar(bar: number) { if (passagePlayback.selectBar(bar)) showPassage(); }
const passageView = passageControls({
  onRange: (first, last, repeat) => { passage.setRange(first, last, repeat); applyLoop(); },
  onStart: () => { passage.startAtSelection(); applyLoop(); },
  onEnd: () => { passage.endAtSelection(); applyLoop(); },
  onReset: () => {
    passage.clear(); applyLoop(); player.stop(); passage.deselect(); showPassage();
    if (!score.focusFirstBar()) $('title').focus();
  },
});

function selectNote(key: string, bar: number) {
  if (!passagePlayback.selectNote(key, bar)) return false;
  showPassage();
  return true;
}

// ---------- auto-scroll ----------
const scrolling = scrollControls(() => workspace.screen === 'practice', score.forgetLine);

// ---------- keyboard ----------
const shortcut = playbackShortcut(() => workspace.screen === 'practice', () => player.playing, () => player.play(), () => player.pause());
document.addEventListener('keydown', shortcut.keydown, true);
document.addEventListener('keyup', shortcut.keyup, true);
window.addEventListener('blur', shortcut.blur);

// ---------- toolbar ----------
const unpick = () => { workspace.unpick(); fillSongList(); };
const fileMenu = one('.file-menu', HTMLDetailsElement);
$('openBtn').onclick = () => $('openFile', HTMLInputElement).click();
closeOnChoice(fileMenu); closeOnOutside(fileMenu);
const hasChanges = () => draftSession.hasChanges();
// The link opens the bundled song, so it would drop unsaved edits.
function showShare() { $('shareBtn').hidden = bundledPath(workspace.picked) === null || draftSession.hasChanges(); }
function showDirtyState() {
  $('returnDraftBtn').hidden = workspace.screen !== 'library' || !hasChanges();
  one('.save-state').hidden = !hasChanges() && !$('saveFeedback').textContent;
  showShare();
  $('dirtyState').textContent = hasChanges() ? `Unsaved changes${draftSession.stored ? '' : ' (draft recovery unavailable)'}` : 'No unsaved changes';
}
function announceSave(message: string, failed = false, offerDownload = failed) {
  $('saveFeedback').textContent = message;
  $('saveFeedback').classList.toggle('bad', failed);
  $('recoverDownload').hidden = !offerDownload; showDirtyState();
}
function persistDraft() {
  draftSession.persist(workspace.picked);
  showDirtyState();
  if (!draftSession.stored && hasChanges()) announceSave('Could not keep this draft in the browser. Download a copy.', true);
}
function replaceCurrent(action: () => void, cancel: (() => void) | null = null) {
  draftSession.replace(action, cancel, () => {
    const dialog = $('replaceDialog', HTMLDialogElement); dialog.returnValue = 'cancel'; dialog.showModal();
  });
}
$('replaceDialog', HTMLDialogElement).addEventListener('close', () => {
  draftSession.resolve($('replaceDialog', HTMLDialogElement).returnValue, saveCurrent, showLink);
});
function saveCurrent(): boolean {
  const result = draftSession.save(title => window.confirm(`Replace "${title}" in your library?`));
  if (result.status === 'cancelled') return false;
  if (result.status === 'failed') { announceSave('Could not save in this browser. Your text is still here. Download a copy.', true); return false; }
  const { title } = result;
  workspace.pick(savedRef(title), 'mine'); persistDraft(); fillSongList(); showLink();
  announceSave(`Saved "${title}" in this browser`); return true;
}
$('newBtn').onclick = () => replaceCurrent(() => { const text = newSong(); unpick(); setScreen('practice'); loadText(text); showLink(true); editor.show(true); src.focus(); });
$('saveBtn').onclick = () => { saveCurrent(); };
$('recoverDownload').onclick = () => $('dlBtn').click();
$('dlBtn').onclick = () => {
  const blob = new Blob([src.value], { type: 'text/plain' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = titleOf(src.value).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.txt';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('openFile', HTMLInputElement).onchange = async e => {
  const input = e.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
  const generation = draftSession.beginNavigation(); input.value = '';
  try {
    const text = await file.text();
    if (draftSession.isCurrent(generation)) replaceCurrent(() => { unpick(); setScreen('practice'); loadText(text); showLink(true); });
  } catch { announceSave('Could not open that file. Your current text is still here.', true); }
};
const editor = editorPane(draw);
$('shareBtn').onclick = async () => {
  const version = openSong.versionSlug();
  const root = new URL(import.meta.env.BASE_URL, location.origin).href;
  // Only the build writes the per-song pages.
  const path = bundledPath(workspace.picked);
  if (path === null) return;
  const url = import.meta.env.DEV ? `${root}?${new URLSearchParams({ song: songSlug(path), ...version && { version } })}` : shareUrl(root, path, version);
  try {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: document.title, url }); return; }
    await navigator.clipboard.writeText(url);
    announceSave(`Link copied: ${url}`);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) announceSave(`Could not copy the link: ${url}`, true, false);
  }
};
playerPanel(draw);
$('closeContinuationBtn').onclick = () => { continuationDismissed = true; $('playBtn').focus(); $('exerciseContinuation').hidden = true; };
theme();
$('syntaxHelpBtn').onclick = () => $('help', HTMLDialogElement).showModal();
(window as never as { tabtrainer: unknown }).tabtrainer = { player, removeSong, onsetKey };

// the player wraps at narrow widths; reserve exactly its height below the page and the sticky editor
publishHeight(one('.player'), '--deck-h');
publishHeight(one('.top'), '--top-h');
publishHeight($('exerciseContinuation'), '--continuation-h');
publishHeight(one('.save-state'), '--save-state-h');

// ---------- start ----------
transportView.showPlayButton();
editor.show(pref('editor', false));
const plan = startupPlan({ search: location.search, historyPick: storedNavigation?.picked ?? null, draft: pref('draft', null), last: pref('last', null), lastPick: pref('picked', '') }, songbook);
const linkedVersion = new URLSearchParams(location.search).get('version');
switch (plan.kind) {
  case 'recover': {
    const { draft, offer } = plan;
    workspace.restore(draft.picked); src.value = draft.text; draftSession.recover(draft);
    update(true); showDirtyState();
    if (offer) replaceCurrent(() => { loadPickedSong(offer); chooseVersionNamed(linkedVersion); });
    else if (plan.followLink) chooseVersionNamed(linkedVersion);
    break;
  }
  case 'open':
    loadPickedSong(plan.ref);
    chooseVersionNamed(linkedVersion);
    break;
  case 'last':
    workspace.restore(plan.ref);
    loadText(plan.text); draftSession.accept(plan.base); persistDraft();
    break;
  case 'first':
    workspace.restore(songbook.firstBundled(workspace.family) ?? '');
    loadText(songbook.text(workspace.picked) ?? '');
}
showFamily();
setScreen(workspace.screen);
showLink();

enhanceDropdowns();
