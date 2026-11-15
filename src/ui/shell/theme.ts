import { pref, setPref } from '../../app/storage';
import { byId } from '../dom';

export function theme() {
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const button = byId('themeBtn', HTMLButtonElement), menuItem = byId('themeMenuBtn', HTMLButtonElement);
  const show = (name: 'light' | 'dark') => {
    document.documentElement.dataset.theme = name;
    const label = `Switch to ${name === 'dark' ? 'light' : 'dark'} theme`;
    button.setAttribute('aria-label', label); button.title = label;
    menuItem.textContent = label;
  };
  show(pref('theme', null) ?? (systemDark.matches ? 'dark' : 'light'));
  systemDark.addEventListener('change', e => { if (pref('theme', null) === null) show(e.matches ? 'dark' : 'light'); });
  button.onclick = menuItem.onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setPref('theme', next === (systemDark.matches ? 'dark' : 'light') ? null : next); show(next);
  };
}
