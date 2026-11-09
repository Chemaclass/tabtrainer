import { searchSongs, type SongEntry } from './songSearch';

const familyName = (f: string) => f.charAt(0).toUpperCase() + f.slice(1);

// A search box over the song list. Empty, it lists the current instrument's songs; typing searches every song.
export function songPicker(input: HTMLInputElement, list: HTMLElement, onPick: (value: string) => void) {
  let entries: SongEntry[] = [], family = '', current = '', label = '';
  let shown: SongEntry[] = [], active = -1;

  function render() {
    const query = input.value.trim();
    shown = query ? searchSongs(entries, query) : entries.filter(e => e.family === family);
    list.replaceChildren();
    let heading = '';
    shown.forEach((e, i) => {
      const h = query ? `${familyName(e.family)} · ${e.group}` : e.group;
      if (h !== heading) { heading = h; const li = document.createElement('li'); li.className = 'grp'; li.setAttribute('role', 'presentation'); li.textContent = h; list.append(li); }
      const li = document.createElement('li');
      li.id = `song-opt-${i}`; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === active));
      li.classList.toggle('cur', e.value === current);
      const t = document.createElement('span'); t.className = 'opt-title'; t.textContent = e.title;
      li.append(t);
      if (e.artist) { const a = document.createElement('span'); a.className = 'opt-artist'; a.textContent = e.artist; li.append(a); }
      if (e.levels?.length) {
        const l = document.createElement('span'); l.className = 'opt-level'; l.setAttribute('role', 'img');
        const words = e.levels.join(', '); l.title = words; l.setAttribute('aria-label', `Level: ${words}`);
        l.append(...e.levels.map(v => { const d = document.createElement('span'); d.className = `lvl-dot lvl-dot-${v}`; return d; }));
        li.append(l);
      }
      li.onclick = () => pick(e.value);
      li.onmousemove = () => { if (active !== i) { active = i; mark(); } };
      list.append(li);
    });
    if (!shown.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No song or artist matches'; list.append(li); }
    mark();
  }
  function mark() {
    list.querySelectorAll('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    const el = active >= 0 ? list.querySelector(`#song-opt-${active}`) : null;
    if (el) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
  }
  const isOpen = () => !list.hidden;
  function open() {
    if (isOpen()) return;
    input.value = ''; input.placeholder = label;
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    render();
    active = shown.findIndex(e => e.value === current); mark();
  }
  function close() {
    list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    input.value = label; input.placeholder = 'Search songs or artists';
  }
  function pick(value: string) { close(); input.blur(); onPick(value); }

  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('blur', close);
  input.addEventListener('input', () => { if (!isOpen()) open(); active = 0; render(); if (!shown.length) { active = -1; mark(); } });
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

  return {
    show(all: SongEntry[], inFamily: string, value: string, name: string) {
      entries = all; family = inFamily; current = value; label = name;
      if (isOpen()) render(); else input.value = label;
    },
  };
}
