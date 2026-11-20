// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TalkPhraseProgress, TalkTopic } from '@/lib/talk/types';

/** Walks one Learn set from the cards to the end, with one wrong answer on the way. */

const saveStages = vi.fn(async (_t: string, _p: unknown, _s: string, current: Map<string, TalkPhraseProgress>) => current);
vi.mock('@/lib/talk/store', () => ({ getTalkStore: () => ({ saveStages }) }));

const { TalkLearn } = await import('@/components/talk/TalkLearn');

const topic: TalkTopic = {
  id: 't1',
  title: 'Daily standup',
  description: '',
  kind: 'preset',
  level: 'B2',
  persona: { name: 'Dana', role: 'Manager', style: '' },
  opening: { text: 'Hi', vi: 'Chào' },
  phrases: [
    { id: 'p0', text: 'wrap up', ipa: '', vi: 'hoàn tất', example: 'I need to wrap up the refactor.', setIndex: 0 },
    { id: 'p1', text: 'on track', ipa: '', vi: 'đúng tiến độ', example: 'No blank in this one.', setIndex: 0 },
    { id: 'p2', text: 'ship it', ipa: '', vi: 'đưa lên production', example: 'We can ship it today.', setIndex: 0 },
    { id: 'p3', text: 'hidden one', ipa: '', vi: 'ẩn', example: '', setIndex: 0, removed: true },
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
    expect(screen.getByText('wrap up')).toBeTruthy();
    expect(screen.queryByText('hidden one')).toBeNull();
    click('Start');

    // Matching: one wrong pick, then all right.
    click('wrap up');
    click('đúng tiến độ');
    for (const [en, vi] of [['wrap up', 'hoàn tất'], ['on track', 'đúng tiến độ'], ['ship it', 'đưa lên production']]) {
      click(en);
      click(vi);
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
      const vi = ['hoàn tất', 'đúng tiến độ', 'đưa lên production'].find((m) => screen.queryByText(m));
      const phrase = topic.phrases.find((p) => p.vi === vi)!;
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
});
