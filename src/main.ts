import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter-tight/latin-800.css';
import '@fontsource/inter-tight/latin-ext-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import './style.css';
import { parseSong } from './core/parser';
import { buildTimeline, onsetAt, onsetKey, onsetsOf } from './core/timeline';
import { withVersion, type Song } from './core/model';
import { FAMILIES, familyOf, isFamily, type Family } from './core/instruments';
import { renderSong } from './render/notation';
import { Player } from './audio/player';
import { library, saveSong, removeSong, pref, setPref } from './ui/storage';
import { findBySlug, songSlug, versionSlug } from './ui/songLink';
import { songPicker } from './ui/songPicker';
import type { SongEntry } from './ui/songSearch';

const demos = import.meta.glob('./songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const src = $<HTMLTextAreaElement>('src'), sheet = $('sheet'), player = new Player();
let song: Song | null = null;
let parsed: Song | null = null; // whole song with every version
let versionIdx = 0;
let zoom = pref('zoom', 1), showNota = pref('notation', matchMedia('(min-width:600px)').matches);

// ---------- song list ----------
// demo songs live in src/songs/<family>/<kind>/, kind being exercises or songs
const familyOfText = (t: string) => familyOf(parseSong(t).song.meta.instrument);
const demoFamily = (path: string) => path.split('/')[2];
const demoKind = (path: string) => path.split('/')[3];
const savedFamily = pref('family', 'bass');
let family: Family = isFamily(savedFamily) ? savedFamily : 'bass';
let picked = '';

const newSong = () => `title: New song\ninstrument: ${FAMILIES[family]}\ntempo: 90\nkey: C\ntime: 4/4\n\n@Intro\n"C" :q 3.3 3.3 5.2 3.3 |\n`;
const songsFor = (f: Family) => ({
  demos: Object.keys(demos).filter(p => demoFamily(p) === f).sort(),
  mine: library().filter(s => familyOfText(s.text) === f),
});
const picker = songPicker($<HTMLInputElement>('songSearch'), $('songList'), v => pickSong(v));
const demoGroups: Record<string, string> = { exercises: 'Exercises', songs: 'Songs' };
function fillSongList() {
  const entries: SongEntry[] = [
    ...Object.keys(demos).sort().map(p => ({ value: 'demo:' + p, title: titleOf(demos[p]), artist: artistOf(demos[p]), levels: levelsOf(demos[p]), family: demoFamily(p), group: demoGroups[demoKind(p)] ?? 'Songs' })),
    ...library().map(s => ({ value: 'lib:' + s.title, title: s.title, artist: artistOf(s.text), levels: levelsOf(s.text), family: familyOfText(s.text), group: 'My songs' })),
  ];
  picker.show(entries, family, picked, entries.find(e => e.value === picked)?.title ?? 'Unsaved song');
}
function showFamily() {
  document.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(b => { const on = b.dataset.family === family; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  fillSongList();
}
function chooseFamily(f: Family) {
  if (f === family) return;
  family = f; setPref('family', f);
  const { demos: ex, mine } = songsFor(f);
  if (ex.length) pickSong('demo:' + ex[0]); else if (mine.length) pickSong('lib:' + mine[0].title); else { picked = ''; loadText(newSong()); showLink(); }
  showFamily();
}
// one level per version, in the order the versions are listed
const levelsOf = (t: string) => { const { meta, versions } = parseSong(t).song; return versions.flatMap(v => v.level ?? meta.level ?? []); };
const titleOf = (t: string) => /^\s*title\s*:\s*(.+)$/im.exec(t)?.[1].trim() ?? 'Untitled';
const creditNames = (artist = '') => artist.replace(/\s*\(public domain\)\s*$/i, '').split(',').map(n => n.trim()).filter(Boolean);
// the list names who wrote a song, unless TabTrainer wrote it or nobody knows
const artistOf = (t: string) => creditNames(/^\s*artist\s*:\s*(.+)$/im.exec(t)?.[1]).filter(n => !/^(tabtrainer|traditional)$/i.test(n)).join(', ');
function loadText(text: string) { src.value = text; update(true); setPref('last', text); }
function pickSong(v: string) {
  const text = v.startsWith('demo:') ? demos[v.slice(5)] : library().find(x => 'lib:' + x.title === v)?.text;
  if (text === undefined) return;
  picked = v; setPref('picked', v); loadText(text); fillSongList(); showLink();
}
// only bundled songs get a link: "My songs" live in one browser
function showLink() {
  const query = new URLSearchParams(location.search);
  if (picked.startsWith('demo:')) query.set('song', songSlug(picked.slice(5))); else query.delete('song');
  if (picked.startsWith('demo:') && parsed && parsed.versions.length > 1) query.set('version', versionSlug(parsed.versions[versionIdx].name)); else query.delete('version');
  // keep the slash readable: "?song=bass/a-dawning"
  const search = query.toString().replace(/%2F/g, '/');
  history.replaceState(null, '', location.pathname + (search ? '?' + search : '') + location.hash);
}
document.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(b => { b.onclick = () => isFamily(b.dataset.family!) && chooseFamily(b.dataset.family); });

// ---------- parse + render ----------
let timer = 0;
src.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => { update(false); setPref('last', src.value); }, 300); });
function update(resetLoop: boolean) {
  const { song: all, issues } = parseSong(src.value);
  parsed = all;
  if (resetLoop) versionIdx = 0;
  versionIdx = Math.min(versionIdx, all.versions.length - 1);
  const s = withVersion(all, versionIdx);
  song = s;
  renderVersions(all);
  const ul = $('issues'); ul.innerHTML = '';
  issues.forEach(i => {
    const li = document.createElement('li'); li.className = i.severity; li.textContent = `Line ${i.line}: ${i.message}`;
    li.onclick = () => jumpToLine(i.line); ul.appendChild(li);
  });
  const errs = issues.filter(i => i.severity === 'error').length;
  $('status').textContent = errs ? `${errs} error${errs > 1 ? 's' : ''}` : `${s.bars.length} bar${s.bars.length === 1 ? '' : 's'} · ${s.meta.instrument.name}`;
  $('status').classList.toggle('bad', errs > 0);
  $('title').textContent = s.meta.title;
  renderMeta(s);
  $('about').textContent = s.meta.about ?? ''; $('about').hidden = !s.meta.about;
  const f = familyOf(s.meta.instrument);
  if (f !== family) { family = f; setPref('family', f); showFamily(); }
  $('barTotal').textContent = String(s.bars.length || '–');
  document.title = `${s.meta.title} · TabTrainer`;
  const wasPlaying = player.playing;
  player.load(buildTimeline(s), s.meta.tempo); onsets = onsetsOf(player.notes);
  if (resetLoop || +$<HTMLInputElement>('loopB').value > s.bars.length) { $<HTMLInputElement>('loopA').value = '1'; $<HTMLInputElement>('loopB').value = String(Math.max(1, s.bars.length)); }
  $<HTMLInputElement>('loopA').max = $<HTMLInputElement>('loopB').max = String(s.bars.length);
  applyLoop(); draw(); showSpeed(); if (wasPlaying) setPlayLabel();
}
function renderVersions(all: Song) {
  const box = $('versions'); box.replaceChildren();
  box.hidden = all.versions.length < 2;
  if (box.hidden) return;
  all.versions.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = v.name; b.className = 'seg' + (i === versionIdx ? ' on' : '');
    b.setAttribute('aria-pressed', String(i === versionIdx));
    b.title = `${v.bars.length} bar${v.bars.length === 1 ? '' : 's'}`;
    b.onclick = () => chooseVersion(i);
    box.appendChild(b);
  });
}
function chooseVersion(i: number) {
  if (!parsed || i === versionIdx) return;
  player.stop(); versionIdx = i;
  update(false); showLink();
  // a different version usually has a different number of bars: reset the loop range to the whole version
  if (song) { $<HTMLInputElement>('loopA').value = '1'; $<HTMLInputElement>('loopB').value = String(Math.max(1, song.bars.length)); applyLoop(); }
}
function chooseVersionNamed(slug: string | null) {
  const i = parsed?.versions.findIndex(v => versionSlug(v.name) === slug) ?? -1;
  if (i >= 0) chooseVersion(i);
}
function renderMeta(s: Song) {
  renderCredit(s);
  const parts: [string, boolean][] = [[`♩ = ${s.meta.tempo}`, true], [`key ${s.meta.key}`, true], [s.meta.instrument.name, false]];
  const facts = parts.filter(([t]) => t).map(([t, num]) => { const e = document.createElement('span'); if (num) e.className = 'num'; e.textContent = t; return e; });
  if (s.meta.level) { const l = document.createElement('span'); l.className = `lvl lvl-${s.meta.level}`; l.textContent = s.meta.level; facts.unshift(l); }
  $('subtitle').replaceChildren(...facts);
}
function renderCredit(s: Song) {
  const names = creditNames(s.meta.artist);
  const byline = $('byline'); byline.hidden = !names.length;
  const traditional = names.length === 1 && /^traditional$/i.test(names[0]);
  byline.replaceChildren(...(traditional ? [] : [document.createTextNode('by ')]), ...names.flatMap((n, i) => {
    const b = document.createElement('b'); b.textContent = n;
    const sep = i === names.length - 1 ? [] : [document.createTextNode(i === names.length - 2 ? ' and ' : ', ')];
    return [b, ...sep];
  }));
  const link = $<HTMLAnchorElement>('listen'); link.hidden = !s.meta.listen;
  if (s.meta.listen) { link.href = s.meta.listen; $('listenHost').textContent = new URL(s.meta.listen).hostname.replace(/^www\./, ''); }
  $('credit').hidden = byline.hidden && link.hidden;
}
function jumpToLine(line: number) {
  const lines = src.value.split('\n'); let pos = 0; for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  src.focus(); src.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
}
function draw() {
  if (!song) return;
  // measure the unzoomed parent: browsers disagree on whether a zoomed element reports its own width zoomed
  const box = getComputedStyle(sheet.parentElement!);
  const w = sheet.parentElement!.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight) - 12;
  const perLine = Math.max(1, Math.min(8, Math.round((w / zoom) / (showNota ? 300 : 240))));
  sheet.style.setProperty('zoom', String(zoom));
  renderSong(sheet, song, { barsPerLine: perLine, showNotation: showNota, width: w / zoom });
}
let rz = 0; let lastW = window.innerWidth;
window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) < 60) return; lastW = window.innerWidth; clearTimeout(rz); rz = window.setTimeout(draw, 250); });

// ---------- player wiring ----------
const setPlayLabel = () => {
  const b = $('playBtn'); b.classList.toggle('pause', player.playing);
  b.setAttribute('aria-label', player.playing ? 'Pause' : player.pausedAt !== null ? 'Resume' : 'Play');
};
let lit: Element[] = [], litKey: string | null = null, curSys: Element | null = null;
let onsets: number[] = [];
player.on(({ beat }) => {
  setPlayLabel();
  if (beat === null) { lit.forEach(e => e.classList.remove('on')); lit = []; litKey = null; curSys?.classList.remove('cur'); curSys = null; $('barNo').textContent = '–'; return; }
  const key = onsetAt(onsets, beat);
  if (key !== litKey) {
    lit.forEach(e => e.classList.remove('on'));
    lit = key ? [...sheet.querySelectorAll(`[data-key="${key}"]`)] : []; lit.forEach(e => e.classList.add('on')); litKey = key;
  }
  const bar = player.barAt(beat); $('barNo').textContent = bar ? String(bar) : '–';
  if (bar) {
    const sys = [...sheet.querySelectorAll<HTMLElement>('.system')].find(s => bar >= +s.dataset.first! && bar <= +s.dataset.last!) ?? null;
    if (sys && sys !== curSys) {
      curSys?.classList.remove('cur'); sys.classList.add('cur'); curSys = sys;
      if ($<HTMLInputElement>('followChk').checked) { stopScroll(); const r = sys.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.28, behavior: 'smooth' }); }
    }
  }
});
player.on(s => { if (s.beat === null && scrollWasOn && !player.playing) stopScroll(true); });
$('playBtn').onclick = () => player.toggle();
$('stopBtn').onclick = () => player.stop();
const speed = $<HTMLInputElement>('speed');
const fillRange = (r: HTMLInputElement) => r.style.setProperty('--fill', `${((+r.value - +r.min) / (+r.max - +r.min)) * 100}%`);
const showSpeed = () => {
  const bpm = Math.round(player.tempo * +speed.value / 100), q = document.createElement('span'); q.textContent = `  ♩${bpm}`;
  $('speedOut').replaceChildren(speed.value + '%', q); fillRange(speed);
};
speed.value = String(pref('speed', 100)); player.speed = +speed.value / 100;
speed.oninput = () => { player.setSpeed(+speed.value / 100); setPref('speed', +speed.value); showSpeed(); };
function applyLoop() {
  if (!song?.bars.length) return;
  const a = Math.max(1, +$<HTMLInputElement>('loopA').value || 1), z = Math.max(a, +$<HTMLInputElement>('loopB').value || a);
  player.loop = $<HTMLInputElement>('loopChk').checked;
  player.range = player.loop || a > 1 || z < song.bars.length ? player.barRange(a, z) : null;
}
['loopChk', 'loopA', 'loopB'].forEach(id => $(id).addEventListener('change', applyLoop));
// double-click a note (or near one) to start there
sheet.addEventListener('dblclick', e => {
  const t = e.target as Element; let el = t.closest<SVGElement>('.note');
  if (!el) {
    const sys = t.closest('.system'); if (!sys) return;
    let best: SVGElement | null = null, bd = 1e9;
    sys.querySelectorAll<SVGElement>('.note').forEach(n => { const r = n.getBoundingClientRect(); const d = Math.abs((r.left + r.right) / 2 - e.clientX) + Math.abs((r.top + r.bottom) / 2 - e.clientY) * 0.3; if (d < bd) { bd = d; best = n; } });
    el = best;
  }
  if (!el) return; window.getSelection()?.removeAllRanges();
  player.play(+el.dataset.key! / 1000);
});

// ---------- auto-scroll ----------
let scrolling = false, scrollWasOn = false, last = 0, acc = 0;
const sspeed = $<HTMLInputElement>('scrollSpeed'); sspeed.value = String(pref('scroll', 15));
fillRange(sspeed);
sspeed.oninput = () => { setPref('scroll', +sspeed.value); fillRange(sspeed); };
function stepScroll(ts: number) {
  if (!scrolling) return;
  if (last) { acc += (+sspeed.value * (ts - last)) / 1000; const px = Math.floor(acc); if (px >= 1) { window.scrollBy(0, px); acc -= px; } }
  if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) { stopScroll(); return; }
  last = ts; requestAnimationFrame(stepScroll);
}
function startScroll() { scrolling = true; last = 0; acc = 0; $('scrollBtn').classList.add('on'); $('scrollBtn').textContent = 'Scrolling'; requestAnimationFrame(stepScroll); }
function stopScroll(remember = false) { scrollWasOn = remember ? scrolling : false; scrolling = false; $('scrollBtn').classList.remove('on'); $('scrollBtn').textContent = 'Auto-scroll'; }
$('scrollBtn').onclick = () => (scrolling ? stopScroll() : startScroll());

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (t === src || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable) return;
  if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
  else if (e.key === 's' || e.key === 'S') { e.preventDefault(); if (scrolling) stopScroll(); else startScroll(); }
  else if (scrolling && e.key === 'ArrowUp') { e.preventDefault(); sspeed.value = String(+sspeed.value + 2); fillRange(sspeed); }
  else if (scrolling && e.key === 'ArrowDown') { e.preventDefault(); sspeed.value = String(Math.max(3, +sspeed.value - 2)); fillRange(sspeed); }
});

// ---------- toolbar ----------
const unpick = () => { picked = ''; setPref('picked', ''); fillSongList(); showLink(); };
$('newBtn').onclick = () => { unpick(); loadText(newSong()); showEditor(true); src.focus(); };
$('saveBtn').onclick = () => {
  const t = titleOf(src.value);
  if (library().some(s => s.title === t) && !window.confirm?.call(window, `Replace "${t}" in your library?`)) return;
  saveSong(t, src.value); picked = 'lib:' + t; setPref('picked', picked); fillSongList(); showLink(); flash(`Saved "${t}" in this browser`);
};
$('dlBtn').onclick = () => {
  const blob = new Blob([src.value], { type: 'text/plain' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = titleOf(src.value).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.txt';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$<HTMLInputElement>('openFile').onchange = async e => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  unpick(); loadText(await f.text()); (e.target as HTMLInputElement).value = '';
};
const showEditor = (on: boolean) => { document.querySelector('.layout')!.classList.toggle('noedit', !on); $('editBtn').classList.toggle('on', on); $('editBtn').setAttribute('aria-pressed', String(on)); setPref('editor', on); setTimeout(draw, 50); };
$('editBtn').onclick = () => showEditor(document.querySelector('.layout')!.classList.contains('noedit'));
const setNotation = (on: boolean) => { showNota = on; setPref('notation', on); $('notaBtn').classList.toggle('on', on); $('tabBtn').classList.toggle('on', !on); draw(); };
$('notaBtn').onclick = () => setNotation(true);
$('tabBtn').onclick = () => setNotation(false);
$('zoomIn').onclick = () => { zoom = Math.min(1.8, +(zoom + 0.1).toFixed(2)); setPref('zoom', zoom); draw(); };
$('zoomOut').onclick = () => { zoom = Math.max(0.6, +(zoom - 0.1).toFixed(2)); setPref('zoom', zoom); draw(); };
$('moreBtn').onclick = () => $('moreBtn').setAttribute('aria-expanded', String(document.querySelector('.player')!.classList.toggle('open')));
$('helpBtn').onclick = () => $<HTMLDialogElement>('help').showModal();
function flash(msg: string) { const s = $('status'); const old = s.textContent; s.textContent = msg; setTimeout(() => { if (s.textContent === msg) s.textContent = old; }, 2500); }
// keep removeSong reachable for a future "delete" button (and from the console)
(window as never as { tabtrainer: unknown }).tabtrainer = { player, removeSong, onsetKey };

// the player wraps at narrow widths; reserve exactly its height below the page and the sticky editor
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--deck-h', `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)).observe(document.querySelector('.player')!);

// ---------- start ----------
$('notaBtn').classList.toggle('on', showNota); $('tabBtn').classList.toggle('on', !showNota);
setPlayLabel();
showEditor(pref('editor', matchMedia('(min-width:900px)').matches));
const lastText = pref<string | null>('last', null), lastPick = pref('picked', '');
const link = new URLSearchParams(location.search);
const linked = findBySlug(Object.keys(demos), link.get('song') ?? '');
if (linked) {
  pickSong('demo:' + linked);
  chooseVersionNamed(link.get('version'));
} else if (lastText) {
  const pickedText = lastPick.startsWith('demo:') ? demos[lastPick.slice(5)] : library().find(x => 'lib:' + x.title === lastPick)?.text;
  picked = pickedText === lastText ? lastPick : '';
  loadText(lastText);
} else {
  picked = 'demo:' + songsFor(family).demos[0];
  loadText(demos[picked.slice(5)]);
}
showLink();
showFamily();
