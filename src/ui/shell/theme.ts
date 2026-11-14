import { pref, setPref } from '../../app/storage';

export function theme() {
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const toggles = document.querySelectorAll<HTMLButtonElement>('.theme-toggle');
  const show = (name: 'light' | 'dark') => {
    document.documentElement.dataset.theme = name;
    const label = `Switch to ${name === 'dark' ? 'light' : 'dark'} theme`;
    toggles.forEach(button => { button.setAttribute('aria-label', label); button.title = label; });
  };
  show(pref('theme', null) ?? (systemDark.matches ? 'dark' : 'light'));
  systemDark.addEventListener('change', e => { if (pref('theme', null) === null) show(e.matches ? 'dark' : 'light'); });
  toggles.forEach(button => button.onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setPref('theme', next === (systemDark.matches ? 'dark' : 'light') ? null : next); show(next);
  });
}
