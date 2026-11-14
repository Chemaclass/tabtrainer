import { byId } from '../dom';
import { setSelectValue } from '../shell/dropdown';
import { catalogueMatches, categoryCounts, difficultyLabel, recentEntries, type CatalogueEntry, type LibraryKind } from '../../app/catalogue';

const labels = { exercises: 'exercises', songs: 'songs', mine: 'My songs' };
const intro = {
  exercises: ['Build a skill.', 'Choose an exercise. Pick a level. Practise a few bars.', 'Search exercises or skills'],
  songs: ['Learn a song.', 'Choose a song. Practise a few bars at a time.', 'Search songs or artists'],
  mine: ['Your own music.', 'Songs you save stay in this browser. Open a file to bring one from another device.', 'Search your songs'],
};
const text = (tag: string, value: string, className = '') => { const node = document.createElement(tag); node.textContent = value; node.className = className; return node; };
const levelLabel = (entry: CatalogueEntry) => difficultyLabel(entry.levels);

export function libraryView(onPick: (value: string) => void, onNew: () => void, onOpen: () => void, onExercises: () => void) {
  let entries: CatalogueEntry[] = [], family = 'bass', kind: LibraryKind = 'exercises', recent: string[] = [], expanded = false;
  const search = byId('songSearch', HTMLInputElement), level = byId('songLevel', HTMLSelectElement);
  const clear = byId('clearLevel', HTMLButtonElement), list = byId('catalogueList');
  function resetFilters() { search.value = ''; setSelectValue(level, ''); render(); search.focus(); }
  search.addEventListener('input', render); level.addEventListener('change', render);
  clear.onclick = resetFilters; byId('emptyClearBtn').onclick = resetFilters;
  byId('emptyExercisesBtn').onclick = onExercises;
  byId('emptyNewBtn').onclick = onNew; byId('emptyOpenBtn').onclick = onOpen;
  byId('libraryNewBtn').onclick = onNew; byId('libraryImportBtn').onclick = onOpen;
  byId('exploreAllBtn').onclick = () => { expanded = true; render(); byId('catalogueHeading').focus(); };
  function row(entry: CatalogueEntry) {
    const li = document.createElement('li'), button = document.createElement('button'); button.className = 'catalogue-row'; button.type = 'button'; button.dataset.value = entry.value;
    if (kind === 'exercises') {
      const number = entries.filter(e => e.kind === 'exercises' && e.family === family).indexOf(entry) + 1;
      button.append(text('span', String(number).padStart(2, '0'), 'exercise-number'));
    }
    const copy = text('span', '', 'catalogue-copy'); copy.append(text('strong', entry.title));
    const description = kind === 'exercises' ? entry.about : entry.artist;
    if (description) copy.append(text('span', description, 'catalogue-description'));
    const versions = entry.versions > 1 ? `${entry.versions} ${entry.practiceLevels ? 'practice levels' : 'arrangements'}` : '';
    const mobileMeta = `${levelLabel(entry)} · ${entry.tempo} BPM${versions ? ` · ${versions}` : ''}`;
    copy.append(text('span', mobileMeta, 'catalogue-mobile-meta')); button.append(copy);
    const details = text('span', '', 'catalogue-details');
    details.append(text('span', levelLabel(entry), 'catalogue-level'), text('span', `${entry.tempo} BPM`, 'catalogue-tempo'));
    button.append(details);
    if (versions) copy.append(text('span', versions, 'catalogue-arrangements'));
    const arrow = text('span', '→', 'catalogue-arrow'); arrow.setAttribute('aria-hidden', 'true'); button.append(arrow);
    button.onclick = () => onPick(entry.value); li.append(button); return li;
  }
  function render() {
    const counts = categoryCounts(entries, family);
    const emptyMine = kind === 'mine' && counts.mine === 0;
    const emptySongs = kind === 'songs' && counts.songs === 0;
    byId('mySongActions').hidden = kind !== 'mine' || emptyMine;
    byId('libraryScreen').classList.toggle('empty-category', emptyMine || emptySongs);
    const [heading, description, placeholder] = intro[kind];
    byId('libraryContext').textContent = `${family} / ${labels[kind]}`;
    byId('libraryTitle').textContent = heading; byId('libraryDescription').textContent = description;
    search.placeholder = placeholder; search.setAttribute('aria-label', placeholder);
    const matches = catalogueMatches(entries, kind, family, search.value, level.value);
    const foundations = kind === 'exercises' && !search.value.trim() && !level.value && !expanded && matches.length > 4;
    const shown = foundations ? matches.slice(0, 4) : matches;
    byId('catalogueHeading').textContent = foundations ? 'Start here' : kind === 'mine' ? 'Saved in this browser' : `All ${labels[kind]}`;
    byId('catalogueHeading').tabIndex = -1;
    byId('catalogueHint').textContent = foundations ? `4 essentials · ${matches.length} exercises available` : `${matches.length} ${kind === 'exercises' ? 'exercises' : 'songs'}`;
    byId('songResults').textContent = `${matches.length} ${kind === 'exercises' ? 'exercises' : 'songs'} found.`;
    clear.hidden = !search.value && !level.value;
    list.replaceChildren(...shown.map(row));
    byId('catalogueEmpty').hidden = matches.length > 0;
    byId('emptyTitle').textContent = emptyMine ? 'Make room for your own songs.' : emptySongs ? `No bundled ${family} songs yet.` : `No ${kind === 'exercises' ? 'exercises' : 'songs'} match`;
    byId('emptyDescription').textContent = emptyMine ? 'Start a new song or open a song file. Save it here when you are ready.' : emptySongs ? 'Browse exercises or open a song file to practise.' : `Try another search, clear the filters, or choose another instrument.`;
    byId('emptyClearBtn').hidden = emptyMine || emptySongs || (!search.value && !level.value);
    byId('emptyNewBtn').hidden = !emptyMine; byId('emptyOpenBtn').hidden = !emptyMine && !emptySongs;
    byId('emptyExercisesBtn').hidden = !emptySongs || counts.exercises === 0;
    byId('emptyExercisesBtn').textContent = `Browse ${counts.exercises} ${family} exercises`;
    byId('exploreAllBtn').hidden = !foundations;
    byId('exploreAllBtn').textContent = `Explore all ${matches.length} exercises →`;
    byId('exploreHint').hidden = !foundations;
    byId('exploreHint').textContent = 'Keep going at your own pace.';
    const practised = recentEntries(entries, recent, family), first = practised[0];
    byId('recentPanel').hidden = !first;
    if (first) {
      byId('recentTitle').textContent = first.title; byId('recentAbout').textContent = first.about ?? first.artist;
      byId('recentMeta').textContent = `${levelLabel(first)} · ${first.tempo} BPM`;
      byId('resumeBtn').onclick = () => onPick(first.value);
      byId('otherRecent').replaceChildren(...practised.slice(1, 3).map(entry => { const b = text('button', entry.title); b.onclick = () => onPick(entry.value); return b; }));
    }
  }
  return {
    show(all: CatalogueEntry[], instrument: string, category: LibraryKind, history: string[]) {
      if (kind !== category || family !== instrument) { search.value = ''; setSelectValue(level, ''); expanded = false; }
      entries = all; family = instrument; kind = category; recent = history; render();
    },
  };
}
