import './styles';
import { enhanceDropdowns } from './ui/shell/dropdown';
import { buildTimeline, onsetKey } from './core/timeline';
import { familyOf, type Family } from './core/instruments';
import { Player } from './audio/player';
import { LoopEngine } from './audio/loopEngine';
import { library, removeSong, pref, recordPractice, savedGrooves } from './app/storage';
import { songShareLink } from './app/songLink';
import { bundledPath } from './app/songRef';
import { Songbook, newSongText } from './app/songbook';
import { OpenSong } from './app/openSong';
import { Workspace, type Screen } from './app/workspace';
import { startupPlan } from './app/startup';
import { Passage } from './app/passage';
import { PassagePlayback } from './app/passagePlayback';
import { Navigation, navigationState, readRoute, type Route } from './app/navigation';
import { DraftSession } from './app/draftSession';
import { Jam, Mixer, bundledGrooves } from './app/jam';
import { JamFretboardSettings } from './app/jamFretboard';
import { jamShareLink, type JamSetup } from './app/jamLink';
import { draftFlow } from './ui/editor/draftFlow';
import { editorPane } from './ui/editor/editorPane';
import { saveState } from './ui/editor/saveState';
import { songFile } from './ui/editor/songFile';
import { fretboardSheet } from './ui/fretboard/fretboardSheet';
import { songList } from './ui/library/songList';
import { passageView } from './ui/player/passageView';
import { playbackView } from './ui/player/playbackView';
import { playerPanel } from './ui/player/playerPanel';
import { playShortcut } from './ui/player/playShortcut';
import { scrollControls } from './ui/player/scrollControls';
import { speedControls } from './ui/player/speedControls';
import { speedPracticePanel } from './ui/player/speedPracticePanel';
import { timingPanel } from './ui/player/timingPanel';
import { transport } from './ui/player/transport';
import { scoreView } from './ui/practice/scoreView';
import { songHeader } from './ui/practice/songHeader';
import { helpDialogs } from './ui/shell/helpDialogs';
import { jamFretboardView } from './ui/jam/jamFretboard';
import { grooveEditor } from './ui/jam/grooveEditor';
import { jamView } from './ui/jam/jamView';
import { mixerView } from './ui/jam/mixer';
import { publishLayoutHeights } from './ui/shell/layoutMetrics';
import { screens } from './ui/shell/screens';
import { theme } from './ui/shell/theme';
import { tuner } from './ui/tuner/tuner';

const songbook = new Songbook(import.meta.glob('./songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>, library);
const storedNavigation = navigationState(history.state);
const navigation = new Navigation(history, location, songbook.paths);
const workspace = Workspace.fromQuery(location.search);
const player = new Player();
const openSong = new OpenSong();
const passage = new Passage();
const passagePlayback = new PassagePlayback(player, passage);
const draftSession = new DraftSession(() => editor.text());
const jam = new Jam(bundledGrooves(import.meta.glob('./grooves/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>), () => savedGrooves.list());
const linkedRoute = readRoute(location.search, songbook.paths);
if (linkedRoute.screen === 'jam') jam.open(linkedRoute.groove, linkedRoute.setup);
const loop = new LoopEngine();

helpDialogs();
const view = screens(chooseFamily, () => showJam(jam.slug));
const mixer = new Mixer(workspace.family);
const jamFretboard = jamFretboardView(jam, mixer, new JamFretboardSettings(), loop);
const jamming = jamView(jam, loop, {
  active: () => workspace.screen === 'jam',
  choose: chooseGroove,
  changed: () => showLink(),
  chordsChanged: bars => jamFretboard.show(bars),
  shareLink: () => jamShareLink(new URL(import.meta.env.BASE_URL, location.origin).href, jam.slug, jam.setup, import.meta.env.DEV),
});
const mixing = mixerView(mixer, loop, chooseFamily);
const grooveEditing = grooveEditor(jam, { played: showJamGroove, saved: keepSavedGroove, deleted: showAfterDelete });
const saveView = saveState(draftSession, workspace, () => files.download(), () => { setScreen('practice', true); showLink(true); });
const score = scoreView({
  redraw: draw,
  onBar: bar => passages.selectBar(bar),
  onNote: (key, bar) => passages.selectNote(key, bar),
  onPlayNote: (key, bar) => { const chosen = passages.selectNote(key, bar) ? passagePlayback.selectedNote : null; if (chosen) player.play(chosen.beat); },
});
const header = songHeader(index => { if (openSong.choose(index)) showVersion(); });
const songs = songList(songbook, workspace, openSong, { pick: pickSong, showLibrary, newSong: startNewSong, openFile: () => files.open(), shown: saveView.showShare });
window.addEventListener('popstate', event => navigation.visit(event.state, (route, accept, cancel) => {
  const open = () => { accept(); openRoute(route); };
  if (route.screen === 'practice' && route.picked && route.picked !== workspace.picked && draftSession.hasChanges()) drafts.replace(open, cancel);
  else if (route.screen === 'jam' && !grooveEditing.mayChoose(route.groove)) cancel();
  else open();
}));
const transportView = transport(player, () => { scrolling.stopContinuous(); passagePlayback.stop(); passages.show(); });
const speed = speedControls(player);
const speedPractice = speedPracticePanel(player, () => passage.snapshot().repeat, speed.show);
timingPanel(player);
const passages = passageView(player, passage, passagePlayback, openSong, score, speedPractice.show);
const scrolling = scrollControls(() => workspace.screen === 'practice', score.forgetLine);
playShortcut(player, () => workspace.screen === 'practice');
const playback = playbackView(player, { transport: transportView, score, follows: scrolling.follows }, {
  started: () => { if (workspace.picked) { recordPractice(workspace.picked); songs.fill(); } },
  stopped: () => { passagePlayback.deselect(); passages.show(); },
});
player.on(playback.show);
player.on(state => { if (state.playing) jamming.stop(); });
const drafts = draftFlow(draftSession, workspace, saveView, { saved: () => { songs.fill(); showLink(); }, stayed: () => showLink() });
const files = songFile(draftSession, {
  onNew: startNewSong,
  onOpen: text => drafts.replace(() => { unpick(); setScreen('practice'); loadText(text); showLink(true); }),
  onSave: () => { drafts.save(); },
  shareLink: () => songShareLink(new URL(import.meta.env.BASE_URL, location.origin).href, workspace.picked, openSong.versionSlug(), import.meta.env.DEV),
  announce: saveView.announce,
});
const editor = editorPane(draw);
editor.onEdit(() => { if (passagePlayback.selectedNote) player.stop(); drafts.persist(); }, () => update(false));
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
function showLink(push = false) { navigation.show(workspace.route(openSong.versionSlug(), jam.slug, jam.setup), workspace.picked, push); }
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
  if (grooveEditing.mayChoose(slug)) showJam(slug);
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
function loadPickedSong(ref: string, push = false) {
  const text = songbook.text(ref);
  if (text === undefined) return;
  workspace.openSong(ref, songbook.kind(ref));
  setScreen('practice'); loadText(text); songs.fill(); showLink(push);
  if (push) view.focus('practice');
}
function loadText(text: string) { scrolling.stopContinuous(); editor.setText(text); draftSession.accept(text); saveView.announce(''); update(true); drafts.persist(); }
function startNewSong() {
  drafts.replace(() => { const text = newSongText(workspace.family); unpick(); setScreen('practice'); loadText(text); showLink(true); editor.show(true); editor.focus(); });
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
  header.show(openSong);
  editor.showIssues(issues, song);
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
}
function draw() {
  const song = openSong.song;
  if (!song || workspace.screen !== 'practice') return;
  score.draw(song);
  passages.show();
}

transportView.showPlayButton();
editor.show(pref('editor', false));
const plan = startupPlan({ search: location.search, historyPick: storedNavigation?.picked ?? null, draft: pref('draft', null), last: pref('last', null), lastPick: pref('picked', '') }, songbook);
const linkedVersion = new URLSearchParams(location.search).get('version');
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

enhanceDropdowns();
