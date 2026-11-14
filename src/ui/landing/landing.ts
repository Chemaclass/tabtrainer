import './landing.css';
import { setPref } from '../../app/storage';
import { byId } from '../dom';

const songs = Object.keys(import.meta.glob('../../songs/*/*/*.txt', { query: '?raw', import: 'default', eager: true }));
byId('landingCount').textContent = String(songs.length);

const welcome = () => { setPref('welcomed', true); };
document.querySelectorAll('#landing [data-enter]').forEach(link => link.addEventListener('click', welcome));
byId('landing').querySelector('[data-read-tab]')?.addEventListener('click', () => {
  welcome();
  document.documentElement.classList.remove('landing');
  const url = new URL(location.href);
  url.searchParams.delete('welcome');
  history.replaceState(history.state, '', url);
  const guide = byId('tabHelp', HTMLDialogElement);
  guide.addEventListener('close', () => byId('libraryTitle').focus(), { once: true });
  guide.showModal();
});
