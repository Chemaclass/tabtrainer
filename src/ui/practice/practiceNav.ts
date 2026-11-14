import type { CatalogueEntry, LibraryKind } from '../../app/catalogue';
import { byId } from '../dom';

const backLabels: Record<LibraryKind, string> = { exercises: '← All exercises', songs: '← All songs', mine: '← My songs' };
const kindNames: Record<LibraryKind, string> = { exercises: 'exercise', songs: 'song', mine: 'your song' };

export interface PracticeNavState {
  title: string | undefined;
  instrument: string;
  kind: LibraryKind;
  next: CatalogueEntry | undefined;
  practising: boolean;
}

export function practiceNav(onBack: (kind: LibraryKind) => void, onNext: (value: string) => void) {
  const continuation = byId('exerciseContinuation'), nextButton = byId('nextExerciseBtn'), allButton = byId('allExercisesBtn');
  let dismissed = false;
  byId('closeContinuationBtn').onclick = () => { dismissed = true; byId('playBtn').focus(); continuation.hidden = true; };
  return {
    show({ title, instrument, kind, next, practising }: PracticeNavState) {
      byId('backLibraryBtn').textContent = backLabels[kind];
      byId('practiceName').textContent = title ?? 'Your song';
      byId('practiceContext').textContent = `${instrument} / ${kindNames[kind]}`;
      continuation.hidden = !practising || kind !== 'exercises' || dismissed;
      nextButton.hidden = !next; allButton.hidden = !!next;
      if (next) { byId('nextExerciseTitle').textContent = next.title; nextButton.onclick = () => onNext(next.value); }
      byId('backLibraryBtn').onclick = () => onBack(kind);
    },
  };
}
