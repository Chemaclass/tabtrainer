import './landing.css';
import { byId, one } from '../dom';
import { leaveLanding, onLanding } from '../shell/landingMode';

const songs = Object.keys(import.meta.glob('../../songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }));
byId('landingCount').textContent = String(songs.length);

if (onLanding()) history.replaceState(history.state, '', location.pathname);

one('.top').addEventListener('click', event => {
  if (event.target instanceof Element && event.target.closest('.library-nav button, #writeSongBtn')) leaveLanding();
}, { capture: true });

byId('landing').querySelector('[data-read-tab]')?.addEventListener('click', () => {
  leaveLanding();
  const guide = byId('tabHelp', HTMLDialogElement);
  guide.addEventListener('close', () => byId('libraryTitle').focus(), { once: true });
  guide.showModal();
});

byId('landing').querySelector('[data-songs-guide]')?.addEventListener('click', () => byId('songsGuide', HTMLDialogElement).showModal());
