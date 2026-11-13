import { browseSongs, type SongEntry } from './songSearch';

const familyName = (f: string) => f.charAt(0).toUpperCase() + f.slice(1);

// A search box over the song list. Empty, it lists the current instrument's songs; typing searches every song.
export function songPicker(input: HTMLInputElement, list: HTMLElement, onPick: (value: string) => void, level: HTMLSelectElement, clear: HTMLButtonElement, feedback: HTMLElement, recent: () => string[]) {
  let entries: SongEntry[] = [], family = '', current = '', label = '';
  let shown: SongEntry[] = [], active = -1, query = '';

  function render() {
    shown = browseSongs(entries, query, family, level.value, recent());
    if (active >= shown.length) active = -1;
    clear.hidden = !level.value;
    feedback.textContent = `${new Set(shown.map(e => e.value)).size} songs found${level.value ? `, ${level.selectedOptions[0].textContent}` : ''}.`;
    list.replaceChildren();
    let heading = '';
    shown.forEach((e, i) => {
      const h = query ? `${familyName(e.family)} · ${e.group}` : e.group;
      if (h !== heading) { heading = h; const li = document.createElement('li'); li.className = 'grp'; li.setAttribute('role', 'presentation'); li.textContent = h; list.append(li); }
      const li = document.createElement('li');
      li.id = `song-opt-${i}`; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === active));
      li.classList.toggle('cur', e.value === current);
      const info = document.createElement('div'); info.className = 'opt-info';
      const t = document.createElement('span'); t.className = 'opt-title'; t.textContent = e.title; info.append(t);
      const levels = [...new Set(e.levels ?? [])];
      const l = document.createElement('span'); l.className = 'opt-level';
      levels.forEach(v => { const d = document.createElement('span'); d.className = `lvl-dot lvl-dot-${v}`; d.setAttribute('aria-hidden', 'true'); l.append(d); });
      l.append(document.createTextNode(levels.join(', ') || 'Unrated')); info.append(l); li.append(info);
      if (e.artist) { const a = document.createElement('span'); a.className = 'opt-artist'; a.textContent = e.artist; li.append(a); }
      if (e.about) { const about = document.createElement('span'); about.className = 'opt-about'; about.textContent = e.about; li.append(about); }
      li.onclick = () => pick(e.value);
      li.onmousemove = () => { if (active !== i) { active = i; mark(); } };
      list.append(li);
    });
    if (!shown.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No songs match. Try another search or clear the difficulty filter.'; list.append(li); }
    mark();
  }
  function mark() {
    list.querySelectorAll('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    const el = active >= 0 ? list.querySelector(`#song-opt-${active}`) : null;
    if (el) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
  }
  const isOpen = () => !list.hidden;
  function open(keepQuery = false) {
    if (isOpen()) return;
    if (!keepQuery) query = '';
    input.value = query; input.placeholder = label;
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    render();
    active = shown.findIndex(e => e.value === current); mark();
  }
  function close() {
    list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    input.value = label; input.placeholder = 'Search songs or artists';
  }
  function pick(value: string) { close(); input.blur(); onPick(value); }

  input.addEventListener('focus', () => open());
  input.addEventListener('click', () => open());
  input.addEventListener('blur', close);
  input.addEventListener('input', () => { query = input.value; if (!isOpen()) open(true); active = 0; render(); if (!shown.length) { active = -1; mark(); } });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); open();
      if (shown.length) { active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; mark(); }
    } else if (e.key === 'Enter' && isOpen()) {
      e.preventDefault(); if (shown[active]) pick(shown[active].value);
    } else if (e.key === 'Escape' && isOpen()) {
      e.preventDefault(); close(); input.blur();
    }
  });
  // keep focus in the box, so a click on a song lands before the blur closes the list
  list.addEventListener('mousedown', e => e.preventDefault());

  level.addEventListener('change', () => { open(true); active = 0; render(); });
  level.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('pointerdown', e => { if (![input, list, level, clear].some(el => el.contains(e.target as Node))) close(); });
  clear.onclick = () => { level.value = ''; level.dispatchEvent(new Event('change')); level.focus(); };

  return {
    show(all: SongEntry[], inFamily: string, value: string, name: string) {
      entries = all; family = inFamily; current = value; label = name;
      if (isOpen()) render(); else input.value = label;
    },
  };
}
