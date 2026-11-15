import { titleOf } from '../../app/draftSession';

const URL_LIFETIME_MS = 2000;

function fileNameOf(text: string): string {
  const title = titleOf(text);
  const plain = title.replace(/[^\w\- ]+/g, '').trim();
  return plain.replace(/\s+/g, '-').toLowerCase() + '.txt';
}

export function downloadFile(text: string, name: string, type: string) {
  const blob = new Blob([text], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), URL_LIFETIME_MS);
}

/** Saves the text as a .txt file named after its title line. */
export const downloadText = (text: string) => downloadFile(text, fileNameOf(text), 'text/plain');
