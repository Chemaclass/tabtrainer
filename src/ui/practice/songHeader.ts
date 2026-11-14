import type { Song } from '../../core/model';
import type { OpenSong } from '../../app/openSong';
import { hasPracticeLevels } from '../../app/practiceLevels';
import { shownCredits } from '../../app/credits';
import { byId } from '../dom';

const levelHelp = [
  'Start slowly and get comfortable with the pattern.',
  'Build a steady rhythm as you practise.',
  'Try the pattern, then raise the speed when you are ready.',
];

export function songHeader(onVersion: (index: number) => void) {
  const showCredit = (song: Song) => {
    const names = shownCredits(song.meta.artist);
    const byline = byId('byline'); byline.hidden = !names.length;
    const traditional = names.length === 1 && /^traditional$/i.test(names[0]);
    byline.replaceChildren(...(traditional ? [] : [document.createTextNode('by ')]), ...names.flatMap((n, i) => {
      const b = document.createElement('b'); b.textContent = n;
      const sep = i === names.length - 1 ? [] : [document.createTextNode(i === names.length - 2 ? ' and ' : ', ')];
      return [b, ...sep];
    }));
    const link = byId('listen', HTMLAnchorElement); link.hidden = !song.meta.listen;
    if (song.meta.listen) { link.href = song.meta.listen; byId('listenHost').textContent = new URL(song.meta.listen).hostname.replace(/^www\./, ''); }
    byId('credit').hidden = byline.hidden && link.hidden;
  };

  const showFacts = (song: Song) => {
    const parts: [string, boolean][] = [[`♩ = ${song.meta.tempo}`, true], [`key ${song.meta.key}`, true], [song.meta.instrument.name, false]];
    const facts = parts.filter(([t]) => t).map(([t, num]) => { const e = document.createElement('span'); if (num) e.className = 'num'; e.textContent = t; return e; });
    if (song.meta.level) { const l = document.createElement('span'); l.className = `lvl lvl-${song.meta.level}`; l.textContent = song.meta.level; facts.unshift(l); }
    byId('subtitle').replaceChildren(...facts);
  };

  const showVersions = (open: OpenSong) => {
    const versions = open.versions, versionIdx = open.versionIndex;
    const box = byId('versions'); box.replaceChildren();
    const details = byId('versionDetails'); details.hidden = versions.length < 2;
    if (details.hidden) return;
    const levels = hasPracticeLevels(versions.map(v => v.name));
    byId('versionLabel').textContent = levels ? 'Practice level' : 'Arrangement';
    box.setAttribute('aria-label', levels ? 'Practice level' : 'Arrangement');
    const help = byId('versionHelp');
    help.hidden = !levels;
    help.textContent = levels ? levelHelp[versionIdx] : '';
    versions.forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = v.name; b.className = 'seg' + (i === versionIdx ? ' on' : '');
      b.setAttribute('aria-pressed', String(i === versionIdx));
      b.title = `${v.bars.length} bar${v.bars.length === 1 ? '' : 's'}`;
      b.onclick = () => onVersion(i);
      box.appendChild(b);
    });
  };

  return {
    show(open: OpenSong) {
      const song = open.song;
      if (!song) return;
      showVersions(open);
      byId('title').textContent = song.meta.title;
      showCredit(song);
      showFacts(song);
      byId('about').textContent = song.meta.about ?? ''; byId('about').hidden = !song.meta.about;
    },
  };
}
