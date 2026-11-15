import { byId } from '../dom';
import { setSelectValue } from '../shell/dropdown';
import { catalogueMatches, categoryCounts, difficultyLabel, isProgressFilter, progressCounts, type CatalogueEntry, type LibraryKind, type ProgressFilter } from '../../app/catalogue';
import { songProgress, type SongProgress, type SongRecord } from '../../app/practiceLog';
import { pickUp, pickUpAction, pickUpState, pickUpTitle, progressSummary, rowProgress, speedLadder, type PickUp, type RowProgress } from '../../app/practiceProgress';
import { DEFAULT_TEMPLATE, SONG_TEMPLATES, templateInstruments, type SongTemplate, type SongTemplateId, type TemplateInstrument } from '../../app/songTemplates';
import { INSTRUMENTS, isFamily } from '../../core/instruments';
import { pref, setPref } from '../../app/storage';
import { shareLabel, type ShareState } from '../../app/songProposal';

const labels = { exercises: 'exercises', songs: 'songs', mine: 'My songs' };
const intro = {
  exercises: ['Build a skill.', 'Choose an exercise. Pick a level. Practise a few bars.', 'Search exercises or skills'],
  songs: ['Learn a song.', 'Choose a song. Practise a few bars at a time.', 'Search songs or artists'],
  mine: ['Write your own.', 'Pick a starting point. You hear it as you type, and it saves in this browser.', 'Search your songs'],
};
const closing = {
  exercises: ['Missing an exercise? Write it, and send it in for everyone.', 'Write an exercise'],
  songs: ['Missing a song? Write it, and send it in for everyone.', 'Write a song'],
};
const text = (tag: string, value: string, className = '') => { const node = document.createElement(tag); node.textContent = value; node.className = className; return node; };
const levelLabel = (entry: CatalogueEntry) => difficultyLabel(entry.levels);
const statusText = { 'not-started': 'Not started', 'in-progress': 'In progress', done: 'Done' };
const SVG = 'http://www.w3.org/2000/svg';
function checkMark() {
  const icon = document.createElementNS(SVG, 'svg'), path = document.createElementNS(SVG, 'path');
  icon.setAttribute('viewBox', '0 0 16 16'); icon.setAttribute('width', '16'); icon.setAttribute('height', '16');
  path.setAttribute('d', 'M3 8.5l3.2 3L13 4.5');
  icon.append(path); return icon;
}

export function libraryView(onPick: (value: string) => void, onContinue: (plan: PickUp) => void, onNew: () => void, onTemplate: (id: SongTemplateId, instrument: TemplateInstrument) => void, onOpen: () => void, onPropose: () => void, onExercises: () => void, onShare: (value: string, ready: boolean) => void) {
  let shares = new Map<string, ShareState>();
  let entries: CatalogueEntry[] = [], family = 'bass', kind: LibraryKind = 'exercises', expanded = false;
  let practice: Record<string, SongRecord> = {}, now = 0, progressFilter: ProgressFilter = 'all';
  const search = byId('songSearch', HTMLInputElement), level = byId('songLevel', HTMLSelectElement);
  const clear = byId('clearLevel', HTMLButtonElement), list = byId('catalogueList');
  const progressChips = [...byId('progressFilters').querySelectorAll<HTMLButtonElement>('[data-progress]')];
  const progressOf = (value: string) => songProgress(practice[value] ?? null);
  function resetFilters() { search.value = ''; setSelectValue(level, ''); progressFilter = 'all'; render(); search.focus(); }
  search.addEventListener('input', render); level.addEventListener('change', render);
  progressChips.forEach(chip => { chip.onclick = () => { if (isProgressFilter(chip.dataset.progress)) { progressFilter = chip.dataset.progress; render(); } }; });
  clear.onclick = resetFilters; byId('emptyClearBtn').onclick = resetFilters;
  byId('emptyExercisesBtn').onclick = onExercises;
  byId('emptyWriteBtn').onclick = onNew; byId('emptyOpenBtn').onclick = onOpen;
  byId('closingWriteBtn').onclick = onNew; byId('libraryImportBtn').onclick = onOpen; byId('libraryProposeBtn').onclick = onPropose;
  byId('shareGuideBtn').onclick = () => byId('songsGuide', HTMLDialogElement).showModal();
  const templateInstrument = byId('templateInstrument', HTMLSelectElement);
  const instrumentChoices = () => templateInstruments(isFamily(family) ? family : 'bass');
  const chosenInstrument = () => instrumentChoices().find(id => id === templateInstrument.value) ?? instrumentChoices()[0];
  function templateCard(template: SongTemplate) {
    const li = document.createElement('li'), button = document.createElement('button');
    button.type = 'button'; button.className = 'template-card'; button.dataset.template = template.id;
    button.classList.toggle('default', template.id === DEFAULT_TEMPLATE);
    button.append(text('strong', template.name), text('span', template.summary, 'template-summary'), text('code', template.sample(chosenInstrument()), 'template-sample'));
    button.onclick = () => onTemplate(template.id, chosenInstrument());
    li.append(button); return li;
  }
  const showTemplates = () => byId('templateList').replaceChildren(...SONG_TEMPLATES.map(templateCard));
  templateInstrument.addEventListener('change', () => {
    if (isFamily(family)) setPref('templateInstruments', { ...pref('templateInstruments', {}), [family]: chosenInstrument() });
    showTemplates();
  });
  function showTemplateInstruments() {
    if (templateInstrument.dataset.family === family) return;
    const choices = instrumentChoices();
    templateInstrument.dataset.family = family;
    templateInstrument.replaceChildren(...choices.map(id => { const option = document.createElement('option'); option.value = id; option.textContent = INSTRUMENTS[id].name; return option; }));
    const saved = isFamily(family) ? pref('templateInstruments', {})[family] : undefined;
    setSelectValue(templateInstrument, saved ?? choices[0]);
    byId('templateInstrumentField').hidden = choices.length < 2;
    showTemplates();
  }
  byId('exploreAllBtn').onclick = () => { expanded = true; render(); byId('catalogueHeading').focus(); };
  function status(entry: CatalogueEntry, progress: SongProgress) {
    const slot = text('span', '', `row-status ${progress}`), number = entries.filter(e => e.kind === entry.kind && e.family === family).indexOf(entry) + 1;
    const mark = progress === 'done' ? checkMark() : text('span', String(number).padStart(2, '0'));
    mark.setAttribute('aria-hidden', 'true');
    slot.append(mark, text('span', statusText[progress], 'sr-only'));
    return slot;
  }
  function progressLane(entry: CatalogueEntry, progress: RowProgress) {
    const lane = text('span', '', `catalogue-progress ${progress.progress}`);
    if (progress.progress === 'not-started') { lane.append(text('span', `Not started · ${entry.tempo} BPM`, 'progress-when')); return lane; }
    lane.append(text('span', progress.label, 'progress-label'));
    if (progress.best !== null) {
      const bar = text('span', '', 'progress-bar'); bar.setAttribute('aria-hidden', 'true'); bar.style.setProperty('--best', `${progress.best}%`);
      lane.append(bar);
    } else if (progress.when) lane.append(text('span', progress.when, 'progress-when'));
    return lane;
  }
  function row(entry: CatalogueEntry) {
    const li = document.createElement('li'), button = document.createElement('button'); button.className = 'catalogue-row'; button.type = 'button'; button.dataset.value = entry.value;
    const progress = rowProgress(practice[entry.value] ?? null, now);
    button.append(status(entry, progress.progress));
    const copy = text('span', '', 'catalogue-copy'); copy.append(text('strong', entry.title));
    if (progress.progress !== 'not-started') copy.append(text('span', progressSummary(progress), `catalogue-progress-line ${progress.progress}`));
    const description = kind === 'exercises' ? entry.about : entry.artist;
    if (description) copy.append(text('span', description, 'catalogue-description'));
    const versions = entry.versions > 1 ? `${entry.versions} ${entry.practiceLevels ? 'practice levels' : 'arrangements'}` : '';
    const mobileMeta = `${levelLabel(entry)} · ${entry.tempo} BPM${versions ? ` · ${versions}` : ''}`;
    copy.append(text('span', mobileMeta, 'catalogue-mobile-meta')); button.append(copy);
    const share = shares.get(entry.value);
    button.append(text('span', levelLabel(entry), 'catalogue-level'), share ? text('span', shareLabel(share), share.ready ? 'share-state ready' : 'share-state') : progressLane(entry, progress));
    if (versions) copy.append(text('span', versions, 'catalogue-arrangements'));
    const arrow = text('span', '→', 'catalogue-arrow'); arrow.setAttribute('aria-hidden', 'true'); button.append(arrow);
    button.onclick = () => onPick(entry.value); li.append(button);
    if (share) {
      const action = text('button', share.ready ? 'Add to TabTrainer' : 'See what is left', share.ready ? 'share-action ready' : 'share-action toggle');
      action.setAttribute('type', 'button'); action.setAttribute('aria-label', `${action.textContent}: ${entry.title}`);
      action.onclick = () => onShare(entry.value, share.ready);
      li.className = 'share-row'; li.append(action);
    }
    return li;
  }
  function render() {
    const counts = categoryCounts(entries, family);
    const emptyMine = kind === 'mine' && counts.mine === 0;
    const emptySongs = kind === 'songs' && counts.songs === 0;
    byId('mySongActions').hidden = kind !== 'mine';
    byId('libraryProposeBtn').hidden = emptyMine;
    byId('songTemplates').hidden = kind !== 'mine';
    byId('sharePanel').hidden = kind !== 'mine';
    byId('readingGuide').hidden = kind === 'mine';
    if (kind === 'mine') showTemplateInstruments();
    byId('libraryScreen').classList.toggle('empty-category', emptyMine || emptySongs);
    const [heading, description, placeholder] = intro[kind];
    byId('libraryContext').textContent = `${family} / ${labels[kind]}`;
    byId('libraryTitle').textContent = heading; byId('libraryDescription').textContent = description;
    search.placeholder = placeholder; search.setAttribute('aria-label', placeholder);
    const plan = kind === 'mine' ? null : pickUp(practice, entries, family);
    showPickUp(plan);
    const progress = progressCounts(catalogueMatches(entries, kind, family, '', ''), progressOf);
    const started = progress['in-progress'] + progress.done > 0;
    if (!started) progressFilter = 'all';
    showProgressChips(started, progress);
    const matches = catalogueMatches(entries, kind, family, search.value, level.value, progressFilter, progressOf);
    const filtered = !!search.value || !!level.value || progressFilter !== 'all';
    const foundations = kind === 'exercises' && !search.value.trim() && !level.value && progressFilter === 'all' && !plan && !expanded && matches.length > 4;
    const shown = foundations ? matches.slice(0, 4) : matches;
    byId('catalogueHeading').textContent = foundations ? 'Start here' : kind === 'mine' ? 'Saved in this browser' : `All ${labels[kind]}`;
    byId('catalogueHeading').tabIndex = -1;
    byId('catalogueHint').textContent = foundations ? `4 essentials · ${matches.length} exercises available` : `${matches.length} ${kind === 'exercises' ? 'exercises' : 'songs'}`;
    byId('songResults').textContent = `${matches.length} ${kind === 'exercises' ? 'exercises' : 'songs'} found.`;
    clear.hidden = !filtered;
    list.replaceChildren(...shown.map(row));
    const noMatch = matches.length === 0 && !emptyMine && !emptySongs;
    byId('catalogueEmpty').hidden = matches.length > 0 || emptyMine;
    byId('emptyTitle').textContent = emptySongs ? `No bundled ${family} songs yet.` : `No ${kind === 'exercises' ? 'exercises' : 'songs'} match`;
    byId('emptyDescription').textContent = emptySongs ? 'Browse exercises or open a song file to practise.' : `Try another search, clear the filters, or choose another instrument.`;
    byId('emptyClearBtn').hidden = emptyMine || emptySongs || !filtered;
    byId('emptyWriteBtn').hidden = !noMatch || kind === 'mine'; byId('emptyOpenBtn').hidden = !emptySongs;
    byId('emptyExercisesBtn').hidden = !emptySongs || counts.exercises === 0;
    byId('emptyExercisesBtn').textContent = `Browse ${counts.exercises} ${family} exercises`;
    byId('exploreAllBtn').hidden = !foundations;
    byId('exploreAllBtn').textContent = `Explore all ${matches.length} exercises →`;
    byId('closingRow').hidden = kind === 'mine' || noMatch;
    const [closingText, closingAction] = closing[kind === 'exercises' ? 'exercises' : 'songs'];
    byId('closingText').textContent = closingText; byId('closingWriteBtn').textContent = closingAction;
  }
  function showPickUp(plan: PickUp | null) {
    byId('pickUp').hidden = !plan;
    if (!plan) return;
    byId('pickUpTitle').textContent = pickUpTitle(plan);
    byId('pickUpState').textContent = pickUpState(plan, now);
    byId('pickUpAction').textContent = pickUpAction(plan);
    byId('speedLadder').replaceChildren(...speedLadder(plan).map(mark => text('li', '', mark)));
    byId('speedLadderText').textContent = plan.passSpeed === null ? '' : `${plan.passSpeed}% of 100%`;
    byId('pickUpBtn').onclick = () => onContinue(plan);
  }
  function showProgressChips(started: boolean, counts: Record<SongProgress, number>) {
    byId('progressFilters').hidden = !started;
    progressChips.forEach(chip => {
      const shows = chip.dataset.progress, count = chip.querySelector('.chip-count');
      chip.setAttribute('aria-pressed', String(shows === progressFilter));
      if (count && (shows === 'in-progress' || shows === 'done')) count.textContent = String(counts[shows]);
    });
  }
  return {
    chooseTemplate() { byId('templateList').querySelector<HTMLButtonElement>('.template-card.default')?.focus(); },
    show(all: CatalogueEntry[], instrument: string, category: LibraryKind, songs: Record<string, SongRecord>, time: number, shareStates: Map<string, ShareState>) {
      if (kind !== category || family !== instrument) { search.value = ''; setSelectValue(level, ''); progressFilter = 'all'; expanded = false; }
      entries = all; family = instrument; kind = category; practice = songs; now = time; shares = shareStates; render();
    },
  };
}
