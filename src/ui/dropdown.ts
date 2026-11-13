const syncs = new WeakMap<HTMLSelectElement, () => void>();

export function setSelectValue(select: HTMLSelectElement, value: string) {
  select.value = value;
  syncs.get(select)?.();
}

function enhance(select: HTMLSelectElement) {
  if (select.multiple || syncs.has(select)) return;
  const wrapper = document.createElement('span');
  const button = document.createElement('button');
  const list = document.createElement('div');
  wrapper.className = 'dropdown';
  button.className = 'dropdown-button'; button.type = 'button'; button.dataset.select = select.id;
  button.setAttribute('role', 'combobox'); button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', `${select.id}-options`);
  const label = select.getAttribute('aria-label') || Array.from(select.labels ?? []).map(item => item.textContent?.trim()).filter(Boolean).join(' ');
  if (label) button.setAttribute('aria-label', label);
  const description = select.getAttribute('aria-describedby');
  if (description) button.setAttribute('aria-describedby', description);
  list.id = `${select.id}-options`; list.className = 'dropdown-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
  if (label) list.setAttribute('aria-label', label);
  wrapper.append(button, list);
  let active = select.selectedIndex, query = '', queryTimer = 0;
  const options = () => Array.from(select.options);
  function sync() {
    button.textContent = select.selectedOptions[0]?.textContent ?? '';
    button.disabled = select.disabled;
    if (select.disabled) close();
    list.replaceChildren(...options().map((option, index) => {
      const item = document.createElement('div');
      item.id = `${select.id}-option-${index}`; item.className = 'dropdown-option'; item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      if (option.disabled || option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled) item.setAttribute('aria-disabled', 'true');
      item.textContent = option.textContent;
      item.addEventListener('click', () => { if (item.getAttribute('aria-disabled') !== 'true') choose(index); });
      return item;
    }));
    if (!list.hidden) markActive();
  }
  function markActive() {
    Array.from(list.children).forEach((item, index) => item.classList.toggle('active', index === active));
    const item = list.children[active] as HTMLElement | undefined;
    if (item) { button.setAttribute('aria-activedescendant', item.id); item.scrollIntoView({ block: 'nearest' }); }
    else button.removeAttribute('aria-activedescendant');
  }
  function position() {
    const rect = button.getBoundingClientRect(), gap = 4, margin = 8;
    const height = Math.min(list.scrollHeight, window.innerHeight - margin * 2);
    const above = window.innerHeight - rect.bottom < height + gap && rect.top > window.innerHeight - rect.bottom;
    const available = above ? rect.top - gap - margin : window.innerHeight - rect.bottom - gap - margin;
    list.style.maxHeight = `${Math.max(0, available)}px`;
    list.style.width = `${Math.min(Math.max(rect.width, 160), window.innerWidth - margin * 2)}px`;
    list.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - list.offsetWidth - margin))}px`;
    list.style.top = above ? 'auto' : `${rect.bottom + gap}px`;
    list.style.bottom = above ? `${window.innerHeight - rect.top + gap}px` : 'auto';
  }
  function close() { list.hidden = true; button.setAttribute('aria-expanded', 'false'); button.removeAttribute('aria-activedescendant'); }
  function open() {
    if (button.disabled) return;
    active = select.selectedIndex; list.hidden = false; button.setAttribute('aria-expanded', 'true');
    sync(); position(); markActive();
  }
  function choose(index: number) {
    const changed = select.selectedIndex !== index;
    select.selectedIndex = index; close(); sync(); button.focus();
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function move(direction: number) {
    const all = options();
    for (let i = active + direction; i >= 0 && i < all.length; i += direction) {
      if (list.children[i]?.getAttribute('aria-disabled') !== 'true') { active = i; markActive(); break; }
    }
  }
  button.addEventListener('click', () => { if (list.hidden) open(); else close(); });
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if (!list.hidden) { event.preventDefault(); event.stopPropagation(); close(); } return; }
    if (event.key === 'Tab') { close(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); if (list.hidden) open();
      if (event.key === 'Home') { active = -1; move(1); }
      else if (event.key === 'End') { active = options().length; move(-1); }
      else move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (list.hidden) open(); else if (active >= 0 && list.children[active]?.getAttribute('aria-disabled') !== 'true') choose(active);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      query += event.key.toLocaleLowerCase(); window.clearTimeout(queryTimer); queryTimer = window.setTimeout(() => { query = ''; }, 700);
      if (list.hidden) open();
      const index = options().findIndex((option, i) => option.textContent?.trim().toLocaleLowerCase().startsWith(query) && list.children[i]?.getAttribute('aria-disabled') !== 'true');
      if (index >= 0) { active = index; markActive(); }
    }
  });
  select.addEventListener('change', sync);
  document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target as Node)) close(); });
  window.addEventListener('resize', () => { if (!list.hidden) position(); });
  window.addEventListener('scroll', () => { if (!list.hidden) position(); }, true);
  for (const labelElement of Array.from(select.labels ?? [])) labelElement.addEventListener('click', event => { if (select.hidden) { event.preventDefault(); button.focus(); } });
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(select, { attributes: true, childList: true, subtree: true, characterData: true });
  try {
    select.insertAdjacentElement('afterend', wrapper);
    syncs.set(select, sync);
    select.hidden = true;
  } catch (error) {
    observer.disconnect(); wrapper.remove(); syncs.delete(select); select.hidden = false;
    throw error;
  }
}

export function enhanceDropdowns() {
  document.querySelectorAll<HTMLSelectElement>('select').forEach(select => {
    try { enhance(select); } catch { select.hidden = false; }
  });
}
