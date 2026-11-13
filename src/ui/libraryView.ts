import { catalogueMatches, recentEntries, type CatalogueEntry, type LibraryKind } from './catalogue';

const labels = { exercises: 'exercises', songs: 'songs', mine: 'My songs' };
const intro = {
  exercises: ['Build a skill.', 'Short exercises for your hands, timing, and fretboard knowledge.', 'Search exercises or skills'],
  songs: ['Learn a song.', 'Choose a song. Practise a few bars at a time.', 'Search songs or artists'],
  mine: ['Your own music.', 'Songs you save stay in this browser. Open a file to bring one from another device.', 'Search your songs'],
};
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const text = (tag: string, value: string, className = '') => { const node = document.createElement(tag); node.textContent = value; node.className = className; return node; };
const levelLabel = (entry: CatalogueEntry) => [...new Set(entry.levels ?? [])].join(' / ') || 'Unrated';

export function libraryView(onPick: (value: string) => void, onNew: () => void, onOpen: () => void) {
  let entries: CatalogueEntry[] = [], family = 'bass', kind: LibraryKind = 'exercises', recent: string[] = [], expanded = false;
  const search = element<HTMLInputElement>('songSearch'), level = element<HTMLSelectElement>('songLevel');
  const clear = element<HTMLButtonElement>('clearLevel'), list = element('catalogueList');
  function resetFilters() { search.value = ''; level.value = ''; render(); search.focus(); }
  search.addEventListener('input', render); level.addEventListener('change', render);
  clear.onclick = resetFilters; element('emptyClearBtn').onclick = resetFilters;
  element('emptyNewBtn').onclick = onNew; element('emptyOpenBtn').onclick = onOpen;
  element('libraryNewBtn').onclick = onNew; element('libraryImportBtn').onclick = onOpen;
  element('exploreAllBtn').onclick = () => { expanded = true; render(); element('catalogueHeading').focus(); };
  function row(entry: CatalogueEntry) {
    const li = document.createElement('li'), button = document.createElement('button'); button.className = 'catalogue-row'; button.type = 'button'; button.dataset.value = entry.value;
    if (kind === 'exercises') {
      const number = entries.filter(e => e.kind === 'exercises' && e.family === family).indexOf(entry) + 1;
      button.append(text('span', String(number).padStart(2, '0'), 'exercise-number'));
    }
    const copy = text('span', '', 'catalogue-copy'); copy.append(text('strong', entry.title));
    const description = kind === 'exercises' ? entry.about : entry.artist;
    if (description) copy.append(text('span', description, 'catalogue-description'));
    const mobileMeta = `${levelLabel(entry)} · ${entry.tempo} BPM${entry.versions > 1 ? ` · ${entry.versions} arrangements` : ''}`;
    copy.append(text('span', mobileMeta, 'catalogue-mobile-meta')); button.append(copy);
    button.append(text('span', levelLabel(entry), 'catalogue-level'), text('span', `${entry.tempo} BPM`, 'catalogue-tempo'));
    if (entry.versions > 1) copy.append(text('span', `${entry.versions} arrangements`, 'catalogue-arrangements'));
    const arrow = text('span', '→', 'catalogue-arrow'); arrow.setAttribute('aria-hidden', 'true'); button.append(arrow);
    button.onclick = () => onPick(entry.value); li.append(button); return li;
  }
  function render() {
    element('mySongActions').hidden = kind !== 'mine';
    const [heading, description, placeholder] = intro[kind];
    element('libraryTitle').textContent = heading; element('libraryDescription').textContent = description;
    search.placeholder = placeholder; search.setAttribute('aria-label', placeholder);
    const matches = catalogueMatches(entries, kind, family, search.value, level.value);
    const foundations = kind === 'exercises' && !search.value.trim() && !level.value && !expanded && matches.length > 4;
    const shown = foundations ? matches.slice(0, 4) : matches;
    element('catalogueHeading').textContent = foundations ? 'Start here' : kind === 'mine' ? 'Saved in this browser' : `All ${labels[kind]}`;
    element('catalogueHeading').tabIndex = -1;
    element('catalogueHint').textContent = foundations ? 'A suggested order. Start anywhere.' : `${matches.length} ${kind === 'exercises' ? 'exercises' : 'songs'}`;
    element('songResults').textContent = `${matches.length} ${kind === 'exercises' ? 'exercises' : 'songs'} found.`;
    clear.hidden = !search.value && !level.value;
    list.replaceChildren(...shown.map(row));
    element('catalogueEmpty').hidden = matches.length > 0;
    const emptyMine = kind === 'mine' && !entries.some(e => e.kind === 'mine' && e.family === family);
    element('emptyTitle').textContent = emptyMine ? 'Make room for your own songs.' : `No ${kind === 'exercises' ? 'exercises' : 'songs'} match`;
    element('emptyDescription').textContent = emptyMine ? 'Start a new song or open a song file. Save it here when you are ready.' : `Try another search, clear the filters, or choose another instrument.`;
    element('emptyClearBtn').hidden = emptyMine || (!search.value && !level.value);
    element('emptyNewBtn').hidden = !emptyMine; element('emptyOpenBtn').hidden = !emptyMine;
    element('exploreAllBtn').hidden = !foundations;
    element('exploreAllBtn').textContent = `Explore all ${matches.length} exercises →`;
    element('exploreHint').hidden = !foundations;
    element('exploreHint').textContent = family === 'bass' ? 'Next: scales, disco, blues, and Latin rhythms.' : 'More exercises to build your technique.';
    const practised = recentEntries(entries, recent, family), first = practised[0];
    element('recentPanel').hidden = !first;
    if (first) {
      element('recentTitle').textContent = first.title; element('recentAbout').textContent = first.about ?? first.artist;
      element('recentMeta').textContent = `${levelLabel(first)} · ${first.tempo} BPM`;
      element('resumeBtn').onclick = () => onPick(first.value);
      element('otherRecent').replaceChildren(...practised.slice(1, 3).map(entry => { const b = text('button', entry.title); b.onclick = () => onPick(entry.value); return b; }));
    }
  }
  return {
    show(all: CatalogueEntry[], instrument: string, category: LibraryKind, history: string[]) {
      if (kind !== category || family !== instrument) { search.value = ''; level.value = ''; expanded = false; }
      entries = all; family = instrument; kind = category; recent = history; render();
    },
  };
}
