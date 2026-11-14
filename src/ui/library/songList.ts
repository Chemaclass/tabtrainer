import { familyOf } from '../../core/instruments';
import { categoryCounts, nextExercise, type CatalogueEntry, type LibraryKind } from '../../app/catalogue';
import type { OpenSong } from '../../app/openSong';
import { normalizeSongReference } from '../../app/songLink';
import type { Songbook } from '../../app/songbook';
import { recentPractice } from '../../app/storage';
import type { Workspace } from '../../app/workspace';
import { practiceNav } from '../practice/practiceNav';
import { byId } from '../dom';
import { libraryNav } from './libraryNav';
import { libraryView } from './libraryView';

interface SongListActions {
  pick: (ref: string) => void;
  showLibrary: (kind?: LibraryKind) => void;
  newSong: () => void;
  openFile: () => void;
  shown: () => void;
}

export function songList(songbook: Songbook, workspace: Workspace, openSong: OpenSong, actions: SongListActions) {
  let entries: CatalogueEntry[] = [];
  const tabs = libraryNav(kind => actions.showLibrary(kind));
  const practice = practiceNav(kind => actions.showLibrary(kind), actions.pick);
  const catalogue = libraryView(ref => actions.pick(ref), actions.newSong, () => actions.openFile(), () => { actions.showLibrary('exercises'); byId('libraryTitle').focus({ preventScroll: true }); });
  byId('libraryOpenBtn').onclick = () => actions.openFile();
  function showNavigation() {
    tabs.show(categoryCounts(entries, workspace.family), workspace.kind);
    const kind = entries.find(e => e.value === workspace.picked)?.kind ?? 'mine';
    const song = openSong.song;
    practice.show({
      title: song?.meta.title,
      instrument: song ? familyOf(song.meta.instrument) : workspace.family,
      kind,
      next: nextExercise(entries, workspace.picked),
      practising: workspace.screen === 'practice',
    });
    actions.shown();
  }
  return {
    fill() {
      entries = songbook.entries();
      catalogue.show(entries, workspace.family, workspace.kind, recentPractice().map(ref => normalizeSongReference(ref, songbook.paths)));
      showNavigation();
    },
    showNavigation,
  };
}
