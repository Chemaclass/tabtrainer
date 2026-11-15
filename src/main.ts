import './styles';
import { enhanceDropdowns } from './ui/shell/dropdown';
import { buildTimeline, onsetKey } from './core/timeline';
import { familyOf, type Family } from './core/instruments';
import { Player } from './audio/player';
import { LoopEngine } from './audio/loopEngine';
import { library, removeSong, pref, practiceStore, savedGrooves, savedSongs } from './app/storage';
import { PlayTime, PracticeLog } from './app/practiceLog';
import type { PickUp } from './app/practiceProgress';
import { PracticeSession } from './app/practiceSession';
import { Backups } from './app/backup';
import { songShareLink, songSource } from './app/songLink';
import { bundledPath, savedRef } from './app/songRef';
import { Songbook } from './app/songbook';
import { shareState, withOpenDraft } from './app/songProposal';
import { templateText, titleRange, type SongTemplateId, type TemplateInstrument } from './app/songTemplates';
import { OpenSong } from './app/openSong';
import { Workspace, type Screen } from './app/workspace';
import { startupPlan } from './app/startup';
import { Passage } from './app/passage';
import { PassagePlayback } from './app/passagePlayback';
import { Navigation, asksForNewSong, navigationState, readRoute, type Route } from './app/navigation';
import { DraftSession } from './app/draftSession';
import { Jam, Mixer, bundledGrooves } from './app/jam';
import { JamFretboardSettings } from './app/jamFretboard';
import { jamShareLink, type JamSetup } from './app/jamLink';
import { draftFlow } from './ui/editor/draftFlow';
import { editorPane } from './ui/editor/editorPane';
import { proposeSongDialog } from './ui/editor/proposeSong';
import { saveState } from './ui/editor/saveState';
import { songFile } from './ui/editor/songFile';
import { fretboardSheet } from './ui/fretboard/fretboardSheet';
import { songList } from './ui/library/songList';
import { clearedSheet } from './ui/player/clearedSheet';
import { passageView } from './ui/player/passageView';
import { playbackView } from './ui/player/playbackView';
import { playerPanel } from './ui/player/playerPanel';
import { screenWakeLock } from './ui/player/wakeLock';
import { playShortcut, practiceShortcuts } from './ui/player/playShortcut';
import { scrollControls } from './ui/player/scrollControls';
import { speedControls } from './ui/player/speedControls';
import { speedPracticePanel } from './ui/player/speedPracticePanel';
import { timingPanel } from './ui/player/timingPanel';
import { thumbDeck } from './ui/player/thumbDeck';
import { transport } from './ui/player/transport';
import { scoreView } from './ui/practice/scoreView';
import { songHeader } from './ui/practice/songHeader';
import { helpDialogs } from './ui/shell/helpDialogs';
import { jamFretboardView } from './ui/jam/jamFretboard';
import { grooveEditor } from './ui/jam/grooveEditor';
import { jamView } from './ui/jam/jamView';
import { mixerView } from './ui/jam/mixer';
import { publishLayoutHeights } from './ui/shell/layoutMetrics';
import { followLanding, onLanding } from './ui/shell/landingMode';
import { offlineCache } from './ui/shell/offline';
import { screens } from './ui/shell/screens';
import { theme } from './ui/shell/theme';
import { tuner } from './ui/tuner/tuner';

const songbook = new Songbook(import.meta.glob('./songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>, library);
const storedNavigation = navigationState(history.state);
const navigation = new Navigation(history, location, songbook.paths, import.meta.env.BASE_URL);
const workspace = Workspace.fromQuery(navigation.search());
const player = new Player();
const openSong = new OpenSong();
const passage = new Passage();
const passagePlayback = new PassagePlayback(player, passage);
const draftSession = new DraftSession(() => editor.text());
const jam = new Jam(bundledGrooves(import.meta.glob('./grooves/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>), () => savedGrooves.list());
const linkedRoute = readRoute(navigation.search(), songbook.paths);
if (linkedRoute.screen === 'jam') jam.open(linkedRoute.groove, linkedRoute.setup);
const loop = new LoopEngine();
const practiceLog = new PracticeLog(practiceStore);
const playTime = new PlayTime(practiceLog);
const practiceSession = new PracticeSession();

const help = helpDialogs();
const sharedSongs = () => withOpenDraft(library(), workspace.picked, draftSession.hasChanges() ? editor.text() : null);
const proposal = proposeSongDialog(songbook.paths, () => editor.text(), sharedSongs, { goToLine: showSongLine });
const view = screens(chooseFamily, () => showJam(jam.slug));
const mixer = new Mixer(workspace.family);
const jamFretboard = jamFretboardView(jam, mixer, new JamFretboardSettings(), loop);
const jamming = jamView(jam, loop, {
  active: () => workspace.screen === 'jam',
  choose: chooseGroove,
  changed: () => showLink(),
  chordsChanged: bars => jamFretboard.show(bars),
  shareLink: () => jamShareLink(new URL(import.meta.env.BASE_URL, location.origin).href, jam.slug, jam.setup),
});
const mixing = mixerView(mixer, loop, chooseFamily);
const grooveEditing = grooveEditor(jam, { played: showJamGroove, saved: keepSavedGroove, deleted: showAfterDelete });
const saveView = saveState(draftSession, workspace, () => files.download(), () => { setScreen('practice', true); showLink(true); }, { state: () => shareState(editor.text(), songbook.paths), propose: proposal.openEditorSong });
const score = scoreView({
  redraw: draw,
  onBar: bar => { passages.selectBar(bar); const problem = editor.open() ? openSong.problemBars().get(bar) : undefined; if (problem) editor.goTo(problem); },
  onBarNumber: bar => passages.loopTo(bar),
  onNote: (key, bar) => passages.selectNote(key, bar),
  onPlayNote: (key, bar) => { const chosen = passages.selectNote(key, bar) ? passagePlayback.selectedNote : null; if (chosen) player.play(chosen.beat); },
});
const header = songHeader(index => { if (openSong.choose(index)) showVersion(); });
const songs = songList(songbook, workspace, openSong, practiceLog, { pick: pickSong, continue: continuePractice, showLibrary, newSong: () => startNewSong(), startFrom: startFromTemplate, openFile: () => files.open(), shown: saveView.showShare, propose: () => proposal.open(), shared: sharedSongs, proposeSaved: proposal.openSaved, backup: () => files.backup() });
window.addEventListener('popstate', event => navigation.visit(event.state, (route, accept, cancel) => {
  draftSession.beginNavigation();
  if (followLanding(navigation.search())) { accept(); setScreen('library'); return; }
  const open = () => accept(() => openRoute(route));
  if (route.screen === 'practice' && route.picked && route.picked !== workspace.picked && draftSession.hasChanges()) drafts.replace(open, cancel);
  else if (route.screen === 'jam') void grooveEditing.mayChoose(route.groove).then(chosen => (chosen ? open() : cancel()));
  else open();
}));
const transportView = transport(player, () => { scrolling.stopContinuous(); passagePlayback.stop(); passages.show(); });
const speed = speedControls(player);
const speedPractice = speedPracticePanel(player, () => passage.snapshot().repeat, speed.show);
const timing = timingPanel(player);
const restart = () => { passagePlayback.stop(); passages.show(); player.play(); };
const deck = thumbDeck(player, passage, { nudgeSpeed: speed.nudge, toggleLoop: () => { passage.toggleRepeat(); passages.apply(); }, restart });
player.onSpeedPractice(deck.show);
const passages = passageView(player, passage, passagePlayback, openSong, score, () => { speedPractice.show(); deck.show(); });
const cleared = clearedSheet(player, {
  next: ([first, last], startSpeed) => { passage.setRange(first, last, true); passages.apply(); speed.set(startSpeed); speedPractice.start(); practiceSession.restart(Date.now()); player.play(); },
  wholeSong: () => { passage.clear(); passages.apply(); practiceSession.restart(Date.now()); player.play(0); },
  nextExercise: songs.nextExercise,
  pick: pickSong,
  daysInARow: () => practiceLog.daysInARow(Date.now()),
});
player.onSpeedPractice((_, reason) => { if (reason === 'enabled' || reason === 'reset') practiceSession.restart(Date.now()); });
const awake = screenWakeLock();
player.on(state => awake.keep('player', state.playing));
loop.on(state => awake.keep('jam', state.playing));
const scrolling = scrollControls(score.forgetLine, running => awake.keep('scroll', running));
playShortcut(player, () => workspace.screen === 'practice');
practiceShortcuts(player, {
  active: () => workspace.screen === 'practice',
  passage, passages, speed, scrolling,
  restart,
  toggleMetronome: timing.toggleMetronome,
  showShortcuts: help.showShortcuts,
});
const playback = playbackView(player, { transport: transportView, score, follows: scrolling.follows }, {
  started: () => songs.started(),
  stopped: () => { passagePlayback.deselect(); passages.show(); songs.stopped(); },
});
player.on(playback.show);
player.on(state => { if (state.playing) jamming.stop(); });
player.on(state => playTime.update(workspace.picked || null, state.phase === 'playing', Date.now()));
player.on(state => practiceSession.playing(state.phase === 'playing', Date.now()));
player.onPassEnd(pass => {
  if (workspace.picked) practiceLog.passEnded(workspace.picked, openSong.versionSlug(), pass, Date.now());
  const loop = practiceSession.passEnded(pass, player.speedPracticeState, passage.snapshot().count, Date.now());
  if (loop) cleared.open(loop);
});
addEventListener('pagehide', () => playTime.update(null, false, Date.now()));
document.addEventListener('visibilitychange', () => { if (document.hidden) playTime.update(null, false, Date.now()); });
const drafts = draftFlow(draftSession, workspace, saveView, { saved: () => { songs.fill(); showLink(); }, stayed: () => showLink(), retitled: text => { editor.setText(text); update(false); } });
const files = songFile(draftSession, new Backups(savedSongs, practiceLog), {
  onNew: () => startNewSong(),
  onOpen: text => drafts.replace(() => { unpick(); setScreen('practice'); loadText(text); showLink(true); }),
  onSave: () => { void drafts.save(); },
  restored: () => songs.fill(),
  shareLink: () => songShareLink(new URL(import.meta.env.BASE_URL, location.origin).href, workspace.picked, openSong.versionSlug()),
  announce: saveView.announce,
});
const editor = editorPane(draw);
editor.onEdit(() => { if (passagePlayback.selectedNote) player.stop(); drafts.persist(); }, () => update(false));
editor.onCaret(at => score.showEditedBar(openSong.barAt(at)));
playerPanel(draw);
theme();
fretboardSheet(() => workspace.family);
tuner(() => ({ family: workspace.family, instrument: workspace.screen === 'practice' ? openSong.song?.meta.instrument ?? null : null }), () => { player.pause(); jamming.stop(); });
Object.assign(window, { tabtrainer: { player, removeSong, onsetKey } });
publishLayoutHeights();

function showFamily() { view.showFamily(workspace.family); songs.fill(); }
function chooseFamily(family: Family) {
  if (workspace.chooseFamily(family)) { showFamily(); showLink(); }
  playAlongAs(family);
}
function playAlongAs(family: Family) {
  if (!mixer.setPlays(family)) return;
  mixing.show();
  jamFretboard.show();
}
function unpick() { workspace.unpick(); songs.fill(); }
function showLink(push = false) { if (!onLanding()) navigation.show(workspace.route(openSong.versionSlug(), jam.slug, jam.setup), workspace.picked, push); }
function showTitle() {
  const practising = workspace.screen === 'practice';
  view.showTitle(practising ? openSong.song : null, practising ? bundledPath(workspace.picked) : null, workspace.screen === 'jam' ? jam.groove.title : null);
}
function setScreen(next: Screen, focus = false) {
  if (next !== 'practice') { player.stop(); scrolling.stopContinuous(); }
  if (next !== 'jam') jamming.stop();
  const song = openSong.song;
  workspace.enter(next, song ? familyOf(song.meta.instrument) : null);
  if (next === 'practice' && song) view.showFamily(workspace.family);
  view.show(next);
  showTitle(); songs.fill(); saveView.show();
  if (next === 'practice') requestAnimationFrame(draw);
  if (focus) view.focus(next);
}
function showLibrary(kind = workspace.kind, push = true) {
  const arriving = workspace.screen !== 'library';
  workspace.chooseKind(kind); setScreen('library', arriving); showLink(push);
}
function showJam(slug: string, push = true, setup: JamSetup = {}) {
  const arriving = workspace.screen !== 'jam';
  if (jam.open(slug, setup)) {
    grooveEditing.follow();
    jamming.show();
  }
  playAlongAs(workspace.family);
  setScreen('jam', arriving); showLink(push);
}
function chooseGroove(slug: string) {
  void grooveEditing.mayChoose(slug).then(chosen => { if (chosen) showJam(slug); });
}
function showJamGroove() {
  jamming.show();
  showLink();
}
function refreshMyGrooves() {
  jam.refreshMine();
  jamming.showGrooveList();
}
function keepSavedGroove(slug: string) {
  refreshMyGrooves();
  jam.keepDraftAs(slug);
  grooveEditing.follow();
  showJamGroove();
}
function showAfterDelete() {
  refreshMyGrooves();
  grooveEditing.follow();
  showJamGroove();
}
function pickSong(ref: string) {
  if (ref === workspace.picked) { setScreen('practice', true); showLink(true); }
  else drafts.replace(() => loadPickedSong(ref, true));
}
function continuePractice({ entry, version, loop, nextSpeed }: PickUp) {
  const resume = () => {
    if (entry.value === workspace.picked) { setScreen('practice', true); showLink(true); } else loadPickedSong(entry.value, true);
    chooseVersionNamed(version);
    const bars = openSong.song?.bars.length ?? 0;
    if (loop && openSong.hasVersion(version) && loop[1] <= bars) passage.setRange(loop[0], loop[1], true); else passage.clear();
    passages.apply();
    if (nextSpeed !== null) speed.set(nextSpeed);
  };
  if (entry.value === workspace.picked) resume(); else drafts.replace(resume);
}
function loadPickedSong(ref: string, push = false) {
  const text = songbook.text(ref);
  if (text === undefined) return;
  workspace.openSong(ref, songbook.kind(ref));
  setScreen('practice'); loadText(text); songs.fill(); showLink(push);
  if (push) view.focus('practice');
}
function loadText(text: string) { scrolling.stopContinuous(); editor.setText(text); draftSession.accept(text); saveView.announce(''); update(true); drafts.persist(); }
function showSongLine(line: number, title: string | null) {
  const ref = title === null ? workspace.picked : savedRef(title);
  if (ref !== workspace.picked) drafts.replace(() => { loadPickedSong(ref, true); editor.goToLine(line); });
  else if (workspace.screen === 'practice') editor.goToLine(line);
  else { setScreen('practice'); showLink(true); editor.goToLine(line); }
}
function startNewSong(push = true) {
  showLibrary('mine', push);
  songs.chooseTemplate();
}
function startFromTemplate(template: SongTemplateId, instrument: TemplateInstrument) {
  drafts.replace(() => {
    const text = templateText(template, instrument);
    unpick(); setScreen('practice'); loadText(text); showLink(true); editor.show(true);
    const title = titleRange(text);
    if (title) editor.select(title); else editor.focus();
  });
}
function openRoute(route: Route) {
  if (route.screen === 'jam') { showJam(route.groove, false); return; }
  if (route.screen === 'practice') {
    if (route.picked && route.picked !== workspace.picked) loadPickedSong(route.picked); else setScreen('practice');
    if (route.picked && bundledPath(route.picked) !== null) chooseVersionNamed(route.version);
    showLink();
    return;
  }
  if (route.family) { workspace.visitFamily(route.family); view.showFamily(workspace.family); }
  showLibrary(route.kind, false);
}
function update(resetLoop: boolean) {
  const { song, issues } = openSong.read(editor.text(), resetLoop);
  passage.setSong(song.bars.length, resetLoop);
  if (resetLoop) practiceSession.restart(Date.now());
  header.show(openSong, songSource(workspace.picked));
  editor.showIssues(issues, song);
  score.showProblems(openSong.problemBars().keys());
  if (workspace.followSong(familyOf(song.meta.instrument))) showFamily();
  transportView.showBarTotal(song.bars.length);
  showTitle();
  const wasPlaying = player.playing;
  player.load(buildTimeline(song), song.meta.tempo); playback.load();
  songs.showNavigation(); passages.apply(); draw(); speed.show(); if (wasPlaying) transportView.showPlayButton();
}
function chooseVersionNamed(slug: string | null) { if (openSong.chooseNamed(slug)) showVersion(); }
function showVersion() {
  player.stop();
  update(false); showLink();
  const song = openSong.song;
  if (song) { passage.setSong(song.bars.length, true); player.stop(); passages.apply(); }
  practiceSession.restart(Date.now());
}
function draw() {
  const song = openSong.song;
  if (!song || workspace.screen !== 'practice') return;
  score.draw(song);
  passages.show();
}

transportView.showPlayButton();
editor.show(pref('editor', false));
const linkedSearch = navigation.search();
const plan = startupPlan({ search: linkedSearch, historyPick: storedNavigation?.picked ?? null, draft: pref('draft', null), last: pref('last', null), lastPick: pref('picked', '') }, songbook);
const linkedVersion = new URLSearchParams(linkedSearch).get('version');
const newSongAsked = asksForNewSong(linkedSearch);
switch (plan.kind) {
  case 'recover': {
    const { draft, offer } = plan;
    workspace.restore(draft.picked); editor.setText(draft.text); draftSession.recover(draft);
    update(true); saveView.show();
    if (offer) drafts.replace(() => { loadPickedSong(offer); chooseVersionNamed(linkedVersion); });
    else if (plan.followLink) chooseVersionNamed(linkedVersion);
    break;
  }
  case 'open':
    loadPickedSong(plan.ref);
    chooseVersionNamed(linkedVersion);
    break;
  case 'last':
    workspace.restore(plan.ref);
    loadText(plan.text); draftSession.accept(plan.base); drafts.persist();
    break;
  case 'first':
    workspace.restore(songbook.firstBundled(workspace.family) ?? '');
    loadText(songbook.text(workspace.picked) ?? '');
}
showFamily();
setScreen(workspace.screen);
showLink();
if (newSongAsked) startNewSong(false);

enhanceDropdowns();
if (import.meta.env.PROD) offlineCache(import.meta.env.BASE_URL);
