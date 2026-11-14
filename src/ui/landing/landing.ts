import './landing.css';
import { byId } from '../dom';

const songs = Object.keys(import.meta.glob('../../songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }));
byId('landingCount').textContent = String(songs.length);

if (document.documentElement.classList.contains('landing')) history.replaceState(history.state, '', location.pathname);

byId('landing').querySelector('[data-read-tab]')?.addEventListener('click', () => {
  document.documentElement.classList.remove('landing');
  const guide = byId('tabHelp', HTMLDialogElement);
  guide.addEventListener('close', () => byId('libraryTitle').focus(), { once: true });
  guide.showModal();
});
