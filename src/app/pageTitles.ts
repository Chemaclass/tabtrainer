import type { Family } from '../core/instruments';
import type { LibraryKind } from './catalogue';

export const SITE_TITLE = 'TabTrainer: bass and guitar tab player and tab editor';
export const songPageTitle = (title: string) => `${title} · TabTrainer`;
export const jamPageTitle = (title: string) => `${title} · Jam · TabTrainer`;

export interface LibraryPage { title: string; description: string }
const FOLLOW = 'Slow each one down, loop the hard bars, and follow each note as it plays.';

// The bare library/ and library/<family>/ pages, which the app fills in from the saved choices.
export function libraryIndexPage(family: Family | null): LibraryPage {
  const name = family ? family.charAt(0).toUpperCase() + family.slice(1) : 'Bass and guitar';
  return { title: `${name} exercises and songs · TabTrainer`, description: `${name} exercises and songs with tab and rhythm. ${FOLLOW}` };
}

export function libraryPage(kind: LibraryKind, family: Family): LibraryPage {
  const name = family.charAt(0).toUpperCase() + family.slice(1);
  switch (kind) {
    case 'exercises': return { title: `${name} exercises · TabTrainer`, description: `${name} exercises with tab and rhythm, from first notes to grooves. ${FOLLOW}` };
    case 'songs': return { title: `${name} songs · TabTrainer`, description: `Songs to practise on ${family}, with tab and rhythm. ${FOLLOW}` };
    case 'mine': return { title: `My ${family} songs · TabTrainer`, description: `Write your own ${family} songs in plain text and practise them. They stay in your browser, with no account needed.` };
  }
}
