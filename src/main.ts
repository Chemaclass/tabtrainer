import './style.css';
import { parseSong } from './core/parser';
import { buildTimeline, onsetKey } from './core/timeline';
import type { Song } from './core/model';
import { renderSong } from './render/notation';
import { Player } from './audio/player';
import { library, saveSong, removeSong, pref, setPref } from './ui/storage';

const demos = import.meta.glob('./songs/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const src = $<HTMLTextAreaElement>('src'), sheet = $('sheet'), player = new Player();
let song: Song | null = null;
let zoom = pref('zoom', 1), showNota = pref('notation', true);

// ---------- song list ----------
const NEW_SONG = `title: New song\ninstrument: bass4\ntempo: 90\nkey: C\ntime: 4/4\n\n@Intro\n"C" :q 3.3 3.3 5.2 3.3 |\n`;
function fillSongList(selected?: string) {
  const sel = $<HTMLSelectElement>('songSel'); sel.innerHTML = '';
  const g1 = document.createElement('optgroup'); g1.label = 'Exercises';
  Object.keys(demos).sort().forEach(p => { const o = new Option(titleOf(demos[p]), 'demo:' + p); g1.appendChild(o); });
  sel.appendChild(g1);
  const lib = library();
  if (lib.length) { const g2 = document.createElement('optgroup'); g2.label = 'My songs'; lib.forEach(s => g2.appendChild(new Option(s.title, 'lib:' + s.title))); sel.appendChild(g2); }
  if (selected) sel.value = selected;
}
const titleOf = (t: string) => /^\s*title\s*:\s*(.+)$/im.exec(t)?.[1].trim() ?? 'Untitled';
function loadText(text: string) { src.value = text; update(true); setPref('last', text); }
$<HTMLSelectElement>('songSel').onchange = e => {
  const v = (e.target as HTMLSelectElement).value;
  if (v.startsWith('demo:')) loadText(demos[v.slice(5)]);
  else { const s = library().find(x => 'lib:' + x.title === v); if (s) loadText(s.text); }
};

// ---------- parse + render ----------
let timer = 0;
src.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => { update(false); setPref('last', src.value); }, 300); });
function update(resetLoop: boolean) {
  const { song: s, issues } = parseSong(src.value);
  song = s;
  const ul = $('issues'); ul.innerHTML = '';
  issues.forEach(i => {
    const li = document.createElement('li'); li.className = i.severity; li.textContent = `Line ${i.line}: ${i.message}`;
    li.onclick = () => jumpToLine(i.line); ul.appendChild(li);
  });
  const errs = issues.filter(i => i.severity === 'error').length;
  $('status').textContent = errs ? `${errs} error${errs > 1 ? 's' : ''}` : `${s.bars.length} bars · ${s.meta.instrument.name}`;
  $('title').textContent = s.meta.title;
  $('subtitle').textContent = [s.meta.artist, `♩ = ${s.meta.tempo}`, `key ${s.meta.key}`].filter(Boolean).join(' · ');
  document.title = `${s.meta.title} — TabTrainer`;
  const wasPlaying = player.playing;
  player.load(buildTimeline(s), s.meta.tempo);
  if (resetLoop || +$<HTMLInputElement>('loopB').value > s.bars.length) { $<HTMLInputElement>('loopA').value = '1'; $<HTMLInputElement>('loopB').value = String(Math.max(1, s.bars.length)); }
  $<HTMLInputElement>('loopA').max = $<HTMLInputElement>('loopB').max = String(s.bars.length);
  applyLoop(); draw(); if (wasPlaying) setPlayLabel();
}
function jumpToLine(line: number) {
  const lines = src.value.split('\n'); let pos = 0; for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  src.focus(); src.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
}
function draw() {
  if (!song) return;
  const w = sheet.clientWidth - 12;
  const perLine = Math.max(1, Math.min(6, Math.round((w / zoom) / (showNota ? 300 : 240))));
  sheet.style.setProperty('zoom', String(zoom));
  renderSong(sheet, song, { barsPerLine: perLine, showNotation: showNota, width: w / zoom });
}
let rz = 0; let lastW = window.innerWidth;
window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) < 60) return; lastW = window.innerWidth; clearTimeout(rz); rz = window.setTimeout(draw, 250); });

// ---------- player wiring ----------
const setPlayLabel = () => { $('playBtn').textContent = player.playing ? '❚❚ Pause' : player.pausedAt !== null ? '▶ Resume' : '▶ Play'; };
let lit: Element[] = [], litKey: string | null = null, curSys: Element | null = null;
const onsets = () => [...new Set(player.notes.map(n => n.key))].map(Number).sort((a, b) => a - b);
let onsetCache: number[] = [];
player.on(({ beat }) => {
  setPlayLabel();
  if (beat === null) { lit.forEach(e => e.classList.remove('on')); lit = []; litKey = null; curSys?.classList.remove('cur'); curSys = null; $('barNo').textContent = '–'; return; }
  if (!onsetCache.length || onsetCache.length !== new Set(player.notes.map(n => n.key)).size) onsetCache = onsets();
  let k: number | null = null; let lo = 0, hi = onsetCache.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (onsetCache[m] <= beat * 1000 + 5) { k = onsetCache[m]; lo = m + 1; } else hi = m - 1; }
  const key = k === null ? null : String(k);
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
speed.value = String(pref('speed', 100)); $('speedOut').textContent = speed.value + '%'; player.speed = +speed.value / 100;
speed.oninput = () => { $('speedOut').textContent = speed.value + '%'; player.setSpeed(+speed.value / 100); setPref('speed', +speed.value); };
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
sspeed.oninput = () => setPref('scroll', +sspeed.value);
function stepScroll(ts: number) {
  if (!scrolling) return;
  if (last) { acc += (+sspeed.value * (ts - last)) / 1000; const px = Math.floor(acc); if (px >= 1) { window.scrollBy(0, px); acc -= px; } }
  if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) { stopScroll(); return; }
  last = ts; requestAnimationFrame(stepScroll);
}
function startScroll() { scrolling = true; last = 0; acc = 0; $('scrollBtn').classList.add('on'); $('scrollBtn').textContent = '❚❚ Scrolling'; requestAnimationFrame(stepScroll); }
function stopScroll(remember = false) { scrollWasOn = remember ? scrolling : false; scrolling = false; $('scrollBtn').classList.remove('on'); $('scrollBtn').textContent = '⇩ Auto-scroll'; }
$('scrollBtn').onclick = () => (scrolling ? stopScroll() : startScroll());

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (t === src || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable) return;
  if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
  else if (e.key === 's' || e.key === 'S') { e.preventDefault(); scrolling ? stopScroll() : startScroll(); }
  else if (scrolling && e.key === 'ArrowUp') { e.preventDefault(); sspeed.value = String(+sspeed.value + 2); }
  else if (scrolling && e.key === 'ArrowDown') { e.preventDefault(); sspeed.value = String(Math.max(3, +sspeed.value - 2)); }
});

// ---------- toolbar ----------
$('newBtn').onclick = () => { loadText(NEW_SONG); $<HTMLSelectElement>('songSel').value = ''; showEditor(true); src.focus(); };
$('saveBtn').onclick = () => {
  const t = titleOf(src.value);
  if (library().some(s => s.title === t) && !window.confirm?.call(window, `Replace "${t}" in your library?`)) return;
  saveSong(t, src.value); fillSongList('lib:' + t); flash(`Saved "${t}" in this browser`);
};
$('dlBtn').onclick = () => {
  const blob = new Blob([src.value], { type: 'text/plain' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = titleOf(src.value).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.txt';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$<HTMLInputElement>('openFile').onchange = async e => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  loadText(await f.text()); $<HTMLSelectElement>('songSel').value = ''; (e.target as HTMLInputElement).value = '';
};
const showEditor = (on: boolean) => { document.querySelector('.layout')!.classList.toggle('noedit', !on); $('editBtn').classList.toggle('on', on); setPref('editor', on); setTimeout(draw, 50); };
$('editBtn').onclick = () => showEditor(document.querySelector('.layout')!.classList.contains('noedit'));
$('notaBtn').onclick = () => { showNota = !showNota; setPref('notation', showNota); $('notaBtn').classList.toggle('on', showNota); draw(); };
$('zoomIn').onclick = () => { zoom = Math.min(1.8, +(zoom + 0.1).toFixed(2)); setPref('zoom', zoom); draw(); };
$('zoomOut').onclick = () => { zoom = Math.max(0.6, +(zoom - 0.1).toFixed(2)); setPref('zoom', zoom); draw(); };
$('helpBtn').onclick = () => $<HTMLDialogElement>('help').showModal();
function flash(msg: string) { const s = $('status'); const old = s.textContent; s.textContent = msg; setTimeout(() => { if (s.textContent === msg) s.textContent = old; }, 2500); }
// keep removeSong reachable for a future "delete" button (and from the console)
(window as never as { tabtrainer: unknown }).tabtrainer = { player, removeSong, onsetKey };

// ---------- start ----------
fillSongList();
$('notaBtn').classList.toggle('on', showNota);
showEditor(pref('editor', true));
const first = Object.keys(demos).sort()[0];
const lastText = pref<string | null>('last', null);
if (lastText) { loadText(lastText); $<HTMLSelectElement>('songSel').value = ''; } else { loadText(demos[first]); $<HTMLSelectElement>('songSel').value = 'demo:' + first; }
