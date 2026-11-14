export const creditNames = (artist = '') => artist.replace(/\s*\(public domain\)\s*$/i, '').split(',').map(n => n.trim()).filter(Boolean);

// the list names who wrote a song, unless TabTrainer wrote it or nobody knows
export const shownCredits = (artist = '') => creditNames(artist).filter(n => !/^tabtrainer$/i.test(n));

export const artistOf = (text: string) => shownCredits(/^\s*artist\s*:\s*(.+)$/im.exec(text)?.[1]).join(', ');
