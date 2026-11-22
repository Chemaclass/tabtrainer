import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ISSUE_FORMS, feedbackLinks, issueUrl, tabRef, tabRequest, type FeedbackLink, type TabRequest } from '../../src/app/feedback';
import { bundledRef, savedRef } from '../../src/app/songRef';

const params = (url: string) => new URL(url).searchParams;
const exercise = bundledRef('./songs/bass/exercises/07-blues-scale.txt');
const song = bundledRef('./songs/guitar/songs/02-greensleeves.txt');

describe('issue links', () => {
  it('opens one form and fills its fields', () => {
    const url = issueUrl('song-request.yml', 'Bass song request', { instrument: 'Bass' });
    expect(url.startsWith('https://github.com/Chemaclass/tabtrainer/issues/new?')).toBe(true);
    expect(Object.fromEntries(params(url))).toEqual({ template: 'song-request.yml', title: 'Bass song request', instrument: 'Bass' });
  });
  it('leaves the title out when there is none', () => {
    expect(params(issueUrl('bug.yml')).has('title')).toBe(false);
  });
  it('only fills fields the forms have, with options they offer', () => {
    const urls = [
      ...feedbackLinks({ screen: 'practice', picked: exercise, title: 'T', address: 'https://example.com/', family: 'bass' }),
      ...feedbackLinks({ screen: 'library', picked: '', title: undefined, address: null, family: 'guitar' }),
    ].map(link => link.url).concat(tabRequest('guitar', 'songs', 'x').url, tabRequest('bass', 'exercises', '').url).filter(url => url !== ISSUE_FORMS);
    for (const url of urls) {
      const { template, ...fields } = Object.fromEntries(params(url));
      delete fields.title;
      const form = readFileSync(`.github/ISSUE_TEMPLATE/${template}`, 'utf8');
      for (const [id, value] of Object.entries(fields)) {
        const field = form.split(/\n\s*- type: /).find(block => new RegExp(`\\bid: ${id}\\b`).test(block));
        expect(field, `${template} has ${id}`).toBeDefined();
        if (field!.startsWith('dropdown')) expect(field, `${template} ${id} offers ${value}`).toMatch(new RegExp(`^\\s*- ${value}$`, 'm'));
      }
    }
  });
});

describe('asking for a tab from the library', () => {
  it.each([
    ['bass', 'exercises', 'Looking for a bass exercise that is not here?', 'Exercise'],
    ['guitar', 'exercises', 'Looking for a guitar exercise that is not here?', 'Exercise'],
    ['bass', 'songs', 'Looking for a bass song that is not here?', 'Song'],
    ['guitar', 'songs', 'Looking for a guitar song that is not here?', 'Song'],
  ] as const)('words the %s %s page', (family, kind, lead, formKind) => {
    const request = tabRequest(family, kind, '');
    expect(request.lead).toBe(lead);
    expect(params(request.url).get('kind')).toBe(formKind);
    expect(params(request.url).get('instrument')).toBe(family === 'bass' ? 'Bass' : 'Guitar');
    expect(params(request.url).has('what')).toBe(false);
  });
  it('reminds that songs must be in the public domain', () => {
    expect(tabRequest('bass', 'songs', '').tail).toContain('public domain');
    expect(tabRequest('bass', 'exercises', '').tail).not.toContain('public domain');
  });
  it('carries the search into the question and the issue', () => {
    const request = tabRequest('bass', 'exercises', '  slap   bass ');
    expect(request.lead).toBe('Want a bass exercise for "slap bass" that is not here?');
    expect(params(request.url).get('title')).toBe('Bass exercise request: slap bass');
    expect(params(request.url).get('what')).toBe('slap bass');
    expect(tabRequest('guitar', 'songs', 'greensleeves').lead).toBe('Want a guitar tab of "greensleeves" that is not here?');
  });
  it('cuts a long search without splitting a character', () => {
    expect(params(tabRequest('bass', 'songs', 'x'.repeat(200)).url).get('what')).toHaveLength(60);
    expect(params(tabRequest('bass', 'songs', `${'x'.repeat(59)}🎸🎸`).url).get('what')).toBe(`${'x'.repeat(59)}🎸`);
  });
});

describe('help and feedback links', () => {
  const address = 'https://example.com/bass/blues-scale/';
  it('knows a bundled tab by its file', () => {
    expect(tabRef(exercise, 'Blues Scale', address)).toEqual({ title: 'Blues Scale', family: 'bass', kind: 'exercises', address });
    expect(tabRef(song, 'Greensleeves', address)).toMatchObject({ family: 'guitar', kind: 'songs' });
    expect(tabRef(savedRef('Mine'), 'Mine', address)).toBeNull();
    expect(tabRef(exercise, undefined, address)).toBeNull();
  });
  it('names the open tab in the problem report', () => {
    const [problem, idea, ask, other] = feedbackLinks({ screen: 'practice', picked: exercise, title: 'Blues Scale', address, family: 'bass' });
    expect(problem.lead).toBe('A wrong note or rhythm in this exercise?');
    expect(params(problem.url).get('template')).toBe('bug.yml');
    expect(params(problem.url).get('title')).toBe('Problem in "Blues Scale" (bass exercise)');
    expect(params(problem.url).get('steps')).toBe(`1. Open ${address}\n2. `);
    expect(params(idea.url).get('title')).toBe('Idea for "Blues Scale" (bass exercise)');
    expect(ask.lead).toBe('Want another bass exercise?');
    expect(other.url).toBe(ISSUE_FORMS);
  });
  it('keeps the title intact when it has special characters', () => {
    const [problem] = feedbackLinks({ screen: 'practice', picked: song, title: 'Rock & "Roll" #1', address, family: 'guitar' });
    expect(params(problem.url).get('title')).toBe('Problem in "Rock & "Roll" #1" (guitar song)');
  });
  it('stays generic for own songs and other screens', () => {
    const own = feedbackLinks({ screen: 'practice', picked: savedRef('Mine'), title: 'Mine', address: null, family: 'guitar' });
    expect(own[0].lead).toBe('Something in TabTrainer not working?');
    expect(own.some(link => link.url.includes('Mine'))).toBe(false);
    const library = feedbackLinks({ screen: 'library', picked: exercise, title: 'Blues Scale', address, family: 'bass' });
    expect(library[2].lead).toBe('Want a bass tab that is not here?');
    expect(params(library[2].url).get('instrument')).toBe('Bass');
  });
  it('writes without dashes or exclamation marks', () => {
    const requests: TabRequest[] = [tabRequest('bass', 'songs', 'x'), tabRequest('guitar', 'exercises', '')];
    const links: FeedbackLink[] = [
      ...feedbackLinks({ screen: 'practice', picked: exercise, title: 'T', address, family: 'bass' }),
      ...feedbackLinks({ screen: 'jam', picked: '', title: undefined, address: null, family: 'guitar' }),
    ];
    const copy = [...requests.flatMap(r => [r.lead, r.action, r.tail]), ...links.flatMap(l => [l.lead, l.action])].join(' ');
    expect(copy).not.toMatch(/[—–!]/);
  });
});
