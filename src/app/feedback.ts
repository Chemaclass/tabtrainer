import { isFamily, type Family } from '../core/instruments';
import { REPOSITORY } from './repository';
import { bundledPath } from './songRef';
import type { Screen } from './workspace';

export const ISSUES_URL = `${REPOSITORY}/issues`;
export const ISSUE_FORMS = `${ISSUES_URL}/new/choose`;
export type IssueForm = 'bug.yml' | 'feature.yml' | 'song-request.yml';
export type RequestKind = 'exercises' | 'songs';
export interface TabRef { title: string; family: Family; kind: RequestKind; address: string }
export interface TabRequest { heading: string; line: string; lead: string; action: string; tail: string; url: string }
export interface FeedbackLink { lead: string; action: string; url: string }
export interface FeedbackState { screen: Screen; picked: string; title: string | undefined; address: string | null; family: Family }

const MAX_QUERY = 60;
const INSTRUMENT: Record<Family, string> = { bass: 'Bass', guitar: 'Guitar' };
const NOUN: Record<RequestKind, string> = { exercises: 'exercise', songs: 'song' };

// GitHub fills text fields and the title from the address, but not dropdowns, so the title names the instrument and kind.
export function issueUrl(form: IssueForm, title = '', fields: Record<string, string> = {}): string {
  const params = new URLSearchParams({ template: form, ...(title ? { title } : {}), ...fields });
  return `${ISSUES_URL}/new?${params}`;
}

const cleanQuery = (query: string) => [...query.trim().replace(/\s+/g, ' ')].slice(0, MAX_QUERY).join('').trim();

export function tabRequest(family: Family, kind: RequestKind, query: string): TabRequest {
  const wanted = cleanQuery(query), noun = NOUN[kind];
  const lead = wanted
    ? kind === 'exercises' ? `Want a ${family} exercise for "${wanted}" that is not here?` : `Want a ${family} tab of "${wanted}" that is not here?`
    : `Looking for a ${family} ${noun} that is not here?`;
  const heading = wanted
    ? kind === 'exercises' ? `Want a ${family} exercise for "${wanted}"?` : `Want a ${family} tab of "${wanted}"?`
    : `Missing a ${family} ${noun}?`;
  const domain = kind === 'songs' ? ' It has to be in the public domain.' : '';
  const tail = ` with your idea and I will take a look.${domain}`, line = `Open a GitHub issue with your idea and I will take a look.${domain}`;
  const title = `${INSTRUMENT[family]} ${noun} request${wanted ? `: ${wanted}` : ''}`;
  const url = issueUrl('song-request.yml', title, wanted ? { what: wanted } : {});
  return { heading, line, lead, action: 'Open a GitHub issue', tail, url };
}

export function tabRef(picked: string, title: string | undefined, address: string | null): TabRef | null {
  const path = bundledPath(picked);
  if (path === null || !title || !address) return null;
  const [, , family, kind] = path.split('/');
  if (!isFamily(family) || (kind !== 'exercises' && kind !== 'songs')) return null;
  return { title, family, kind, address };
}

function tabLinks({ title, family, kind, address }: TabRef): FeedbackLink[] {
  const noun = NOUN[kind], name = `"${title}" (${family} ${noun})`;
  return [
    { lead: `A wrong note or rhythm in this ${noun}?`, action: 'Report a problem', url: issueUrl('bug.yml', `Problem in ${name}`, { steps: `1. Open ${address}\n2. ` }) },
    { lead: `An idea to make this ${noun} better?`, action: 'Suggest an improvement', url: issueUrl('feature.yml', `Idea for ${name}`) },
    { lead: `Want another ${family} ${noun}?`, action: 'Ask for a tab', url: issueUrl('song-request.yml', `${INSTRUMENT[family]} ${noun} request`) },
    { lead: 'Anything else?', action: 'See all the forms', url: ISSUE_FORMS },
  ];
}

const genericLinks = (family: Family): FeedbackLink[] => [
  { lead: 'Something in TabTrainer not working?', action: 'Report a problem', url: issueUrl('bug.yml') },
  { lead: 'An idea that would help you practise?', action: 'Suggest an idea', url: issueUrl('feature.yml') },
  { lead: `Want a ${family} tab that is not here?`, action: 'Ask for a tab', url: issueUrl('song-request.yml', `${INSTRUMENT[family]} tab request`) },
  { lead: 'Anything else?', action: 'See all the forms', url: ISSUE_FORMS },
];

export function feedbackLinks({ screen, picked, title, address, family }: FeedbackState): FeedbackLink[] {
  const tab = screen === 'practice' ? tabRef(picked, title, address) : null;
  return tab ? tabLinks(tab) : genericLinks(family);
}
