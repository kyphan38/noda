// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TalkSession as Session, TalkTopic, TalkTurnResult } from '@/lib/talk/types';
import type { TalkMistake } from '@/lib/talk/mistake-bank';
import type { TurnPayload } from '@/lib/db';

/** Plays one whole talk: 8 answers, a review after each, then the summary. */

vi.mock('@/hooks/useVoiceRecorder', async () => {
  const React = await import('react');
  return {
    useVoiceRecorder: () => {
      const [status, setStatus] = React.useState<'idle' | 'recording'>('idle');
      return {
        status,
        elapsedMs: 0,
        error: null,
        start: async () => {
          setStatus('recording');
          return true;
        },
        stop: async () => {
          setStatus('idle');
          return new Blob(['x'], { type: 'audio/webm' });
        },
        cancel: () => setStatus('idle'),
      };
    },
  };
});
vi.mock('@/lib/speakingCheck', () => ({ blobToBase64: async () => 'eA==' }));

const payloads: TurnPayload[] = [];
const saved = new Map<string, Session>();
const saveSession = vi.fn(async (s: Session) => void saved.set(s.id, s));
const mistakes = new Map<string, TalkMistake>();
const wrapSession = vi.fn(async () => ({
  missedChances: [{ turn: 1, phraseId: 'p1', said: 'the reason', better: 'The root cause was the runner image.' }],
  swaps: [{ from: 'fix', to: 'patch', why: 'More exact.' }],
  closingPicks: [{ turn: 0, idea: 'say what you did on the pipeline', target: 'I worked on the pipeline.' }],
  activeKeys: [],
  focus: 'Use the past tense for finished work.',
}));
const saveStages = vi.fn(async (_t: string, _p: unknown, _s: string, m: Map<string, unknown>) => m);
vi.mock('@/lib/talk/store', () => ({
  getTalkStore: () => ({
    saveSession,
    saveStages,
    wrapSession,
    listPrompted: async () => [],
    markActive: async () => {},
    listMistakes: async () => [...mistakes.values()],
    saveMistakes: async (rows: TalkMistake[]) => rows.forEach((m) => mistakes.set(m.pattern, m)),
    hint: async () => [{ text: 'hit a bottleneck', use: 'one part slows the rest' }],
    getSession: async (id: string) => saved.get(id) ?? null,
    listSessions: async () => [...saved.values()],
    findOpenSession: async (topicId: string, setIndex: number) =>
      [...saved.values()].filter((x) => x.topicId === topicId && x.setIndex === setIndex && !x.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null,
    runTurn: async (p: TurnPayload): Promise<TalkTurnResult> => {
      payloads.push(p);
      return {
        transcript: 'I am working on the pipeline.',
        seconds: 3,
        reply: { text: `Reply ${payloads.length}`, curveball: p.curveball, ideas: ['an idea'] },
        review: {
          correct: 'I was working on the pipeline.',
          natural: 'I worked on the pipeline.',
          levelUp: 'I spent the day on the pipeline.',
          fixes: [{ kind: 'grammar', wrong: 'I am working', right: 'I was working', why: 'It is in the past.', pattern: 'verb_tense' }],
        },
        usedPhraseIds: payloads.length === 1 ? ['p0'] : [],
      };
    },
  }),
}));

const { TalkSession } = await import('@/components/talk/TalkSession');

const topic: TalkTopic = {
  id: 'pipeline-b2',
  title: 'Broken CI/CD pipeline',
  description: '',
  kind: 'preset',
  level: 'B2',
  persona: { name: 'Dana', role: 'Team lead', style: 'Calm.' },
  scenarios: [{ id: 's0', title: 'Runner update broke builds', facts: ['Builds failed 3 hours'], opening: 'What happened with the builds?', ideas: ['the runner update'] }],
  phrases: [
    { id: 'p0', text: 'roll back', ipa: '', meaning: 'go back to the old version', example: 'We had to roll back.', setIndex: 0 },
    { id: 'p1', text: 'root cause', ipa: '', meaning: 'the real reason', example: 'The root cause was a bad image.', setIndex: 0 },
  ],
  version: 3,
  createdAt: 0,
};

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

async function answer() {
  click('Answer');
  await waitFor(() => screen.getByRole('button', { name: 'Stop and send' }));
  click('Stop and send');
  await waitFor(() => screen.getByRole('button', { name: /Next turn|See the summary/ }));
}

afterEach(cleanup);

describe('TalkSession', () => {
  it('runs 8 turns with reviews, one curveball, then shows the summary', async () => {
    const onExit = vi.fn();
    render(createElement(TalkSession, { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit }));

    await waitFor(() => screen.getByText('What happened with the builds?'));
    expect(screen.getByText('Builds failed 3 hours')).toBeTruthy();
    // Idea notes stay hidden until asked for.
    expect(screen.queryByText('the runner update')).toBeNull();
    click('Stuck?');
    expect(screen.getByText('the runner update')).toBeTruthy();
    click('Buy time');
    expect(screen.getByText('Let me think for a second.')).toBeTruthy();
    click('Help');
    fireEvent.change(screen.getByPlaceholderText('Your idea in simple words'), { target: { value: 'builds were slow' } });
    click('Get words');
    await waitFor(() => screen.getByText('hit a bottleneck'));

    await answer();
    // Fix it yourself first: the mistake is marked, the answer is hidden.
    expect(screen.getByText('I am working', { selector: 'mark' })).toBeTruthy();
    expect(screen.queryByText('I was working on the pipeline.')).toBeNull();
    click('Show answer');
    expect(screen.getByText('I was working on the pipeline.')).toBeTruthy();
    click('I said it right');
    expect(screen.queryByText('I am working', { selector: 'mark' })).toBeNull();
    expect(saveStages).toHaveBeenCalledWith('pipeline-b2', [expect.objectContaining({ id: 'p0' })], 'prompted', expect.any(Map));

    click('Next turn');
    expect(screen.getByText('Reply 1')).toBeTruthy();
    expect(screen.getByText('✓ roll back', { exact: false })).toBeTruthy();

    for (let i = 2; i <= 7; i++) {
      await answer();
      click('Next turn');
    }
    await answer();
    click('See the summary');
    expect(screen.getByText('Phrases used')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.getByText('Top fixes')).toBeTruthy();

    // Notes: made once, with a closing drill on the weakest answers.
    await waitFor(() => screen.getByText('Use the past tense for finished work.'));
    expect(screen.getByText('The root cause was the runner image.')).toBeTruthy();
    expect(screen.getByText('say what you did on the pipeline')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Say it the natural way'), { target: { value: 'I worked on the pipeline' } });
    click('Check');
    expect(screen.getByText('100%')).toBeTruthy();
    expect(wrapSession).toHaveBeenCalledTimes(1);

    // Mistake bank: 8 tense fixes, minus the one marked "I said it right".
    await waitFor(() => expect(mistakes.get('verb_tense')?.hits).toBe(7));

    expect(payloads).toHaveLength(8);
    expect(payloads.every((p) => p.scenarioId === 's0' && p.recording === 'eA==')).toBe(true);
    expect(payloads.filter((p) => p.curveball)).toHaveLength(1);
    expect(payloads.map((p) => p.isLast)).toEqual([false, false, false, false, false, false, false, true]);
    expect(payloads.map((p) => p.replyKind)).toEqual(['question', 'share', 'question', 'invite', 'share', 'question', 'question', 'question']);
    expect(payloads[5].history).toHaveLength(3);
    // p0 was used in turn 1, so later turns only target p1.
    expect(payloads[1].targetIds).toEqual(['p1']);
    const last = saveSession.mock.calls.at(-1) as unknown as [{ turns: unknown[]; endedAt?: number }];
    expect(last[0].turns).toHaveLength(8);
    expect(last[0].endedAt).toBeGreaterThan(0);

    click('Done');
    expect(onExit).toHaveBeenCalled();
  });

  it('cancels a take, retries a turn and ends early', async () => {
    payloads.length = 0;
    mistakes.clear();
    render(createElement(TalkSession, { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit: () => {} }));
    await waitFor(() => screen.getByRole('button', { name: 'Answer' }));

    // Cancel while recording: nothing is sent.
    click('Answer');
    await waitFor(() => screen.getByRole('button', { name: 'Cancel (Esc)' }));
    click('Cancel (Esc)');
    await waitFor(() => screen.getByRole('button', { name: 'Answer' }));
    expect(payloads).toHaveLength(0);

    // Try again drops the answer and asks the same line.
    await answer();
    click('Try again');
    expect(screen.getByText('What happened with the builds?')).toBeTruthy();
    expect(screen.getByText('Turn 1/8')).toBeTruthy();

    await answer();
    click('Next turn');
    click('End talk');
    expect(screen.getByText('Phrases used')).toBeTruthy();
    expect(screen.getAllByText('I am working on the pipeline.')).toHaveLength(1);
  });

  it('goes on with a talk left halfway, with no new model call', async () => {
    saved.clear();
    mistakes.clear();
    payloads.length = 0;
    const view = render(createElement(TalkSession, { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit: () => {} }));
    await waitFor(() => screen.getByRole('button', { name: 'Answer' }));
    await answer();
    click('Next turn');
    view.unmount();

    render(createElement(TalkSession, { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit: () => {} }));
    await waitFor(() => screen.getByText('Picked up where you left off.'));
    expect(screen.getByText('Reply 1')).toBeTruthy();
    expect(screen.getByText('Turn 2/8')).toBeTruthy();
    expect(payloads).toHaveLength(1);

    // New talk closes the old one and starts again from the opening.
    click('New talk');
    await waitFor(() => screen.getByText('What happened with the builds?'));
    expect([...saved.values()].filter((x) => !x.endedAt)).toHaveLength(1);
  });

  it('warms up on past mistakes before a new talk', async () => {
    saved.clear();
    mistakes.clear();
    mistakes.set('article', {
      pattern: 'article',
      hits: 3,
      cleanStreak: 0,
      graduated: false,
      examples: [{ wrong: 'I fixed bug', right: 'I fixed the bug', why: 'Bug is one known thing.', sessionId: 'x', at: 1 }],
      updatedAt: 1,
    });
    render(createElement(TalkSession, { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit: () => {} }));
    await waitFor(() => screen.getByText('I fixed bug'));
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Say or type the right words'), { target: { value: 'I fixed the bug' } });
    click('Check');
    expect(screen.getByText('Right')).toBeTruthy();
    expect(mistakes.get('article')?.cleanStreak).toBe(1);
    click('Start the talk');
    expect(screen.getByRole('button', { name: 'Answer' })).toBeTruthy();
  });

  it('runs a quick talk of 3 answers, then does it again and compares', async () => {
    saved.clear();
    mistakes.clear();
    payloads.length = 0;
    render(createElement(TalkSession, { topic, setIndex: 0, progress: new Map(), onProgress: () => {}, onExit: () => {} }));
    await waitFor(() => screen.getByRole('button', { name: 'Answer' }));
    click('Quick: 3 answers');
    expect(screen.getByText('Turn 1/3')).toBeTruthy();
    for (let i = 1; i <= 2; i++) {
      await answer();
      click('Next turn');
    }
    await answer();
    expect(payloads.map((p) => p.isLast)).toEqual([false, false, true]);
    click('See the summary');
    await waitFor(() => screen.getByText('Use the past tense for finished work.'));

    click('Talk this again');
    await waitFor(() => screen.getByText('Turn 1/3'));
    expect(screen.getByText('What happened with the builds?')).toBeTruthy();
    for (let i = 1; i <= 2; i++) {
      await answer();
      click('Next turn');
    }
    await answer();
    click('See the summary');
    await waitFor(() => screen.getByText('Last time → now'));
    const redo = [...saved.values()].find((x) => x.redoOf);
    expect(redo?.length).toBe(3);
    expect(redo?.scenarioId).toBe('s0');
  });
});
