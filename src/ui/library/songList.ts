import { familyOf } from '../../core/instruments';
import { categoryCounts, nextExercise, type CatalogueEntry, type LibraryKind } from '../../app/catalogue';
import type { OpenSong } from '../../app/openSong';
import { normalizeSongReference } from '../../app/songLink';
import type { Songbook } from '../../app/songbook';
import type { SongTemplateId, TemplateInstrument } from '../../app/songTemplates';
import { recentPractice, type Saved } from '../../app/storage';
import { shareState, type ShareState } from '../../app/songProposal';
import { savedRef } from '../../app/songRef';
import type { Workspace } from '../../app/workspace';
import { practiceNav } from '../practice/practiceNav';
import { byId } from '../dom';
import { libraryNav } from './libraryNav';
import { libraryView } from './libraryView';

interface SongListActions {
  pick: (ref: string) => void;
  showLibrary: (kind?: LibraryKind) => void;
  newSong: () => void;
  startFrom: (template: SongTemplateId, instrument: TemplateInstrument) => void;
  openFile: () => void;
  shown: () => void;
  propose: () => void;
  shared: () => Saved[];
  proposeSaved: (title: string, onChecklist: boolean) => void;
}

export function songList(songbook: Songbook, workspace: Workspace, openSong: OpenSong, actions: SongListActions) {
  let entries: CatalogueEntry[] = [];
  let playingSong: string | null = null, playedSong: string | null = null;
  const tabs = libraryNav(kind => actions.showLibrary(kind));
  const practice = practiceNav(kind => actions.showLibrary(kind), actions.pick);
  const catalogue = libraryView(ref => actions.pick(ref), actions.newSong, actions.startFrom, () => actions.openFile(), () => actions.propose(), () => { actions.showLibrary('exercises'); byId('libraryTitle').focus({ preventScroll: true }); }, (ref, ready) => {
    const saved = actions.shared().find(song => savedRef(song.title) === ref);
    if (saved) actions.proposeSaved(saved.title, !ready);
  });
  byId('writeSongBtn').onclick = actions.newSong;
  function showNavigation() {
    tabs.show(categoryCounts(entries, workspace.family), workspace.screen === 'jam' ? null : workspace.kind);
    const kind = entries.find(e => e.value === workspace.picked)?.kind ?? 'mine';
    const song = openSong.song;
    practice.show({
      title: song?.meta.title,
      instrument: song ? familyOf(song.meta.instrument) : workspace.family,
      kind,
      next: nextExercise(entries, workspace.picked),
      practising: workspace.screen === 'practice',
      song: workspace.picked,
      played: playedSong !== null && playedSong === workspace.picked,
    });
    actions.shown();
  }
  return {
    fill() {
      entries = songbook.entries();
      const shares = new Map<string, ShareState>(workspace.screen === 'library' && workspace.kind === 'mine' ? actions.shared().map(song => [savedRef(song.title), shareState(song.text, songbook.paths)]) : []);
      catalogue.show(entries, workspace.family, workspace.kind, recentPractice().map(ref => normalizeSongReference(ref, songbook.paths)), shares);
      showNavigation();
    },
    showNavigation,
    started() { playingSong = workspace.picked; },
    stopped() { if (playingSong === null) return; playedSong = playingSong; playingSong = null; showNavigation(); },
    chooseTemplate: catalogue.chooseTemplate,
  };
}
