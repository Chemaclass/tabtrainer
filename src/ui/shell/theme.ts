import { pref, setPref } from '../../app/storage';
import { byId } from '../dom';

export function theme() {
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const show = (name: 'light' | 'dark') => {
    document.documentElement.dataset.theme = name;
    const label = `Switch to ${name === 'dark' ? 'light' : 'dark'} theme`;
    byId('themeBtn').setAttribute('aria-label', label); byId('themeBtn').title = label;
  };
  show(pref('theme', null) ?? (systemDark.matches ? 'dark' : 'light'));
  systemDark.addEventListener('change', e => { if (pref('theme', null) === null) show(e.matches ? 'dark' : 'light'); });
  byId('themeBtn').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setPref('theme', next === (systemDark.matches ? 'dark' : 'light') ? null : next); show(next);
  };
}
