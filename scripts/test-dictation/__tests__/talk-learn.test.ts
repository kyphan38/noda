// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TalkPhraseProgress, TalkTopic } from '@/lib/talk/types';
import type { LearnState } from '@/lib/talk/learn-state';

/** Walks one Learn set from the cards to the end, with one wrong answer on the way. */

const saveStages = vi.fn(async (_t: string, _p: unknown, _s: string, current: Map<string, TalkPhraseProgress>) => current);
const states = new Map<string, LearnState>();
vi.mock('@/lib/talk/store', () => ({
  getTalkStore: () => ({
    saveStages,
    getLearnState: async (t: string, i: number) => states.get(`${t}__${i}`) ?? null,
    saveLearnState: async (t: string, i: number, st: LearnState) => void states.set(`${t}__${i}`, structuredClone(st)),
    clearLearnState: async (t: string, i: number) => void states.delete(`${t}__${i}`),
  }),
}));

afterEach(cleanup);

const { TalkLearn } = await import('@/components/talk/TalkLearn');

const topic: TalkTopic = {
  id: 't1',
  title: 'Daily standup',
  description: '',
  kind: 'preset',
  level: 'B2',
  persona: { name: 'Dana', role: 'Manager', style: '' },
  scenarios: [{ id: 's0', title: 'A', facts: ['x'], opening: 'Hi', ideas: [] }],
  phrases: [
    { id: 'p0', text: 'wrap up', ipa: '', meaning: 'finish the last part', example: 'I need to wrap up the refactor.', setIndex: 0 },
    { id: 'p1', text: 'on track', ipa: '', meaning: 'going as planned', example: 'No blank in this one.', setIndex: 0 },
    { id: 'p2', text: 'ship it', ipa: '', meaning: 'release to users', example: 'We can ship it today.', setIndex: 0 },
    { id: 'p3', text: 'hidden one', ipa: '', meaning: 'hidden', example: '', setIndex: 0, removed: true },
  ],
  version: 1,
  createdAt: 0,
};

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

function answer(text: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
  click('Check');
}

describe('TalkLearn', () => {
  it('goes from cards to matching to recall to done', async () => {
    const onExit = vi.fn();
    render(createElement(TalkLearn, { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit }));

    // Cards: live phrases only.
    await waitFor(() => screen.getByText('wrap up'));
    expect(screen.queryByText('hidden one')).toBeNull();
    click('Start');

    // Matching: one wrong pick, then all right.
    click('wrap up');
    click('going as planned');
    for (const [en, meaning] of [['wrap up', 'finish the last part'], ['on track', 'going as planned'], ['ship it', 'release to users']]) {
      click(en);
      click(meaning);
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy(), { timeout: 2000 });
    expect(saveStages).toHaveBeenCalledWith('t1', expect.any(Array), 'recognized', expect.any(Map));

    // Blanks for the two phrases whose example has them, then recall for all three.
    // An empty answer is not checked.
    click('Check');
    expect(screen.getByText('Type an answer first.')).toBeTruthy();

    const seen: string[] = [];
    let wrongOnce = false;
    for (let guard = 0; guard < 12 && !screen.queryByText(/Set learned/); guard++) {
      const meaning = ['finish the last part', 'going as planned', 'release to users'].find((m) => screen.queryByText(m));
      const phrase = topic.phrases.find((p) => p.meaning === meaning)!;
      seen.push(phrase.id);
      answer(wrongOnce ? phrase.text : 'something else');
      expect(screen.getByText(wrongOnce ? 'Right' : 'Not quite')).toBeTruthy();
      wrongOnce = true;
      await act(async () => click('Next'));
    }

    expect(screen.getByText('Set learned: 3 phrases')).toBeTruthy();
    // 5 drills plus the one that came back after the miss.
    expect(seen).toHaveLength(6);
    expect(screen.getByText('Hardest')).toBeTruthy();
    expect(saveStages).toHaveBeenCalledWith('t1', expect.any(Array), 'recalled', expect.any(Map));
    click('Done');
    expect(onExit).toHaveBeenCalled();
  });

  it('goes on from the middle of Recall after leaving', async () => {
    states.clear();
    const props = { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit: () => {} };
    const first = render(createElement(TalkLearn, props));
    await waitFor(() => screen.getByRole('button', { name: 'Start' }));
    click('Start');
    for (const [en, meaning] of [['wrap up', 'finish the last part'], ['on track', 'going as planned'], ['ship it', 'release to users']]) {
      click(en);
      click(meaning);
    }
    await waitFor(() => screen.getByRole('button', { name: 'Check' }), { timeout: 2000 });
    // Answer the first Recall item right, then leave.
    const meaning = ['finish the last part', 'going as planned', 'release to users'].find((m) => screen.queryByText(m))!;
    answer(topic.phrases.find((p) => p.meaning === meaning)!.text);
    await act(async () => click('Next'));
    expect(states.get('t1__0')?.queue?.done).toBe(1);
    first.unmount();

    // Back again: no cards, no matching, Recall at item 2 of 5.
    render(createElement(TalkLearn, props));
    await waitFor(() => screen.getByText(/Picked up where you left off: Recall 2\/5/));
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy();

    // Start over goes back to the cards and forgets the place.
    click('Start over');
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    await waitFor(() => expect(states.has('t1__0')).toBe(false));
  });

  it('goes on from the match round you left', async () => {
    states.clear();
    const props = { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit: () => {} };
    const first = render(createElement(TalkLearn, props));
    await waitFor(() => screen.getByRole('button', { name: 'Start' }));
    click('Start');
    await waitFor(() => expect(states.get('t1__0')?.step).toBe('match'));
    const order = states.get('t1__0')!.matchOrder;
    first.unmount();
    render(createElement(TalkLearn, props));
    await waitFor(() => screen.getByText(/Match round 1\/1/));
    expect(states.get('t1__0')!.matchOrder).toEqual(order);
  });
});
