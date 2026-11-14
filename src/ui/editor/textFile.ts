import { titleOf } from '../../app/draftSession';

const URL_LIFETIME_MS = 2000;

function fileNameOf(text: string): string {
  const title = titleOf(text);
  const plain = title.replace(/[^\w\- ]+/g, '').trim();
  return plain.replace(/\s+/g, '-').toLowerCase() + '.txt';
}

/** Saves the text as a .txt file named after its title line. */
export function downloadText(text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileNameOf(text);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), URL_LIFETIME_MS);
}
