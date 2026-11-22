import type { CatalogueEntry, LibraryKind } from '../../app/catalogue';
import { byId } from '../dom';

const backNames: Record<LibraryKind, string> = { exercises: 'Back to all exercises', songs: 'Back to all songs', mine: 'Back to my songs' };
const kindNames: Record<LibraryKind, string> = { exercises: 'exercise', songs: 'song', mine: 'your song' };

export interface PracticeNavState {
  title: string | undefined;
  instrument: string;
  kind: LibraryKind;
  next: CatalogueEntry | undefined;
  level: { index: number; name: string } | null;
  song: string;
  played: boolean;
  practising: boolean;
}

export function practiceNav(onBack: (kind: LibraryKind) => void, onNext: (value: string) => void, onLevel: (index: number) => void) {
  const continuation = byId('exerciseContinuation'), nextButton = byId('nextExerciseBtn'), allButton = byId('allExercisesBtn');
  let dismissedSong: string | null = null, shownSong: string | null = null, offered: CatalogueEntry | undefined;
  allButton.onclick = () => onBack('exercises');
  byId('closeContinuationBtn').onclick = () => { dismissedSong = shownSong; byId('playBtn').focus(); continuation.hidden = true; };
  return {
    show({ title, instrument, kind, next, level, practising, song, played }: PracticeNavState) {
      byId('practiceName').textContent = title ?? 'Your song';
      byId('practiceContext').textContent = `${instrument} / ${kindNames[kind]}`;
      shownSong = song; offered = practising && kind === 'exercises' ? next : undefined;
      continuation.hidden = !practising || kind !== 'exercises' || !played || dismissedSong === song;
      nextButton.hidden = !next && !level; allButton.hidden = !nextButton.hidden;
      byId('nextExerciseLabel').textContent = level ? 'Next level' : 'Next exercise';
      if (level) { byId('nextExerciseTitle').textContent = level.name; nextButton.onclick = () => onLevel(level.index); }
      else if (next) { byId('nextExerciseTitle').textContent = next.title; nextButton.onclick = () => onNext(next.value); }
      const headBack = byId('headBackBtn'); headBack.onclick = () => onBack(kind); headBack.setAttribute('aria-label', backNames[kind]); headBack.title = backNames[kind];
    },
    nextExercise: () => offered,
  };
}
