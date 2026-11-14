const BUNDLED = 'demo:';
const SAVED = 'lib:';

export const bundledRef = (path: string) => BUNDLED + path;
export const savedRef = (title: string) => SAVED + title;
export const bundledPath = (ref: string) => ref.startsWith(BUNDLED) ? ref.slice(BUNDLED.length) : null;
export const isSavedRef = (ref: string) => ref.startsWith(SAVED);
