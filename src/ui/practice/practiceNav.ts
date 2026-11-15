import type { CatalogueEntry, LibraryKind } from '../../app/catalogue';
import { byId } from '../dom';

const backLabels: Record<LibraryKind, string> = { exercises: '← All exercises', songs: '← All songs', mine: '← My songs' };
const backNames: Record<LibraryKind, string> = { exercises: 'Back to all exercises', songs: 'Back to all songs', mine: 'Back to my songs' };
const kindNames: Record<LibraryKind, string> = { exercises: 'exercise', songs: 'song', mine: 'your song' };

export interface PracticeNavState {
  title: string | undefined;
  instrument: string;
  kind: LibraryKind;
  next: CatalogueEntry | undefined;
  song: string;
  played: boolean;
  practising: boolean;
}

export function practiceNav(onBack: (kind: LibraryKind) => void, onNext: (value: string) => void) {
  const nextButton = byId('nextExerciseBtn'), allButton = byId('allExercisesBtn');
  let offersNext = false;
  allButton.onclick = () => onBack('exercises');
  return {
    show({ title, instrument, kind, next, practising }: PracticeNavState) {
      byId('backLibraryBtn').textContent = backLabels[kind];
      byId('practiceName').textContent = title ?? 'Your song';
      byId('practiceContext').textContent = `${instrument} / ${kindNames[kind]}`;
      offersNext = practising && kind === 'exercises';
      nextButton.hidden = !next; allButton.hidden = !!next;
      if (next) { byId('nextExerciseTitle').textContent = next.title; nextButton.onclick = () => onNext(next.value); }
      byId('backLibraryBtn').onclick = () => onBack(kind);
      const headBack = byId('headBackBtn'); headBack.onclick = () => onBack(kind); headBack.setAttribute('aria-label', backNames[kind]); headBack.title = backNames[kind];
    },
    offersNext: () => offersNext,
  };
}
