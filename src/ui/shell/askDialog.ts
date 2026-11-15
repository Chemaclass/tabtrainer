import type { SaveChoice, SaveConflict } from '../../app/draftSession';
import { byId } from '../dom';

interface Choice<T extends string> {
  value: T;
  label: string;
  main?: boolean;
}

interface Question<T extends string> {
  title: string;
  message: string;
  choices: readonly Choice<T>[];
  safe: T;
}

function choiceButton<T extends string>({ value, label, main }: Choice<T>): HTMLButtonElement {
  const button = document.createElement('button');
  button.value = value;
  button.textContent = label;
  button.className = main ? 'primary' : 'toggle';
  return button;
}

function returnFocus(opener: Element | null) {
  if (!(opener instanceof HTMLElement) || !opener.isConnected) return;
  opener.focus();
  if (document.activeElement !== opener) opener.closest('details')?.querySelector('summary')?.focus();
}

/** Asks one question at a time; a second question while one is open gets its safe answer at once. */
export function askChoice<T extends string>(question: Question<T>): Promise<T> {
  const dialog = byId('askDialog', HTMLDialogElement);
  if (dialog.open) return Promise.resolve(question.safe);
  const opener = document.activeElement;
  const buttons = question.choices.map(choiceButton);
  byId('askTitle').textContent = question.title;
  byId('askHelp').textContent = question.message;
  byId('askChoices').replaceChildren(...buttons);
  byId('askClose', HTMLButtonElement).value = question.safe;
  dialog.returnValue = question.safe;
  dialog.showModal();
  buttons.find(button => button.value === question.safe)?.focus();
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      returnFocus(opener);
      resolve(question.choices.find(choice => choice.value === dialog.returnValue)?.value ?? question.safe);
    }, { once: true });
  });
}

export function askSaveConflict({ title, copyTitle }: SaveConflict, place: string): Promise<SaveChoice> {
  return askChoice<SaveChoice>({
    title: `Replace "${title}"?`,
    message: `"${title}" is already in ${place}. Replace it, or keep both and save this one as "${copyTitle}".`,
    choices: [{ value: 'cancel', label: 'Cancel' }, { value: 'keep-both', label: 'Keep both' }, { value: 'replace', label: 'Replace', main: true }],
    safe: 'cancel',
  });
}
