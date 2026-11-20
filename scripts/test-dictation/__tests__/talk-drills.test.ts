// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TalkCapsule } from '@/lib/talk/drills';

/** The three drills with a fake mic and a fake model. */

vi.mock('@/hooks/useVoiceRecorder', async () => {
  const React = await import('react');
  return {
    useVoiceRecorder: () => {
      const [status, setStatus] = React.useState<'idle' | 'recording'>('idle');
      return {
        status,
        elapsedMs: 0,
        error: null,
        start: async () => (setStatus('recording'), true),
        stop: async () => (setStatus('idle'), new Blob(['x'], { type: 'audio/webm' })),
        cancel: () => setStatus('idle'),
      };
    },
  };
});
vi.mock('@/lib/speakingCheck', () => ({ blobToBase64: async () => 'eA==' }));

const capsules = new Map<string, TalkCapsule>();
const speech = vi.fn(async (p: { mode: string }) => ({
  transcript: p.mode === 'retell' ? 'the deploy is fail' : 'uh so we shipped it',
  seconds: 2,
  points: p.mode === 'retell' ? [{ point: 'The deploy failed', covered: true }, { point: 'It was rolled back', covered: false }] : [],
  model: p.mode === 'retell' ? 'The deploy failed and we rolled it back.' : '',
  fixes: p.mode === 'retell' ? [{ kind: 'grammar', wrong: 'is fail', right: 'failed', why: 'Past.', pattern: 'verb_form' }] : [],
}));
vi.mock('@/lib/talk/store', () => ({
  getTalkStore: () => ({
    speech,
    listCapsules: async () => [...capsules.values()],
    saveCapsule: async (month: string, _b: Blob, seconds: number, transcript: string) => {
      const row = { month, storagePath: 'p', url: 'blob:x', seconds, transcript, createdAt: 1 };
      capsules.set(month, row);
      return row;
    },
  }),
}));

const { TalkDrills } = await import('@/components/talk/drills/TalkDrills');

afterEach(cleanup);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

async function record() {
  click('Record');
  await waitFor(() => screen.getByRole('button', { name: 'Stop' }));
  click('Stop');
}

describe('talk drills', () => {
  it('runs 60, 45 and 30 second rounds and shows the numbers', async () => {
    render(createElement(TalkDrills));
    click(/60 · 45 · 30/);
    for (const s of [60, 45, 30]) {
      await waitFor(() => screen.getByText(`say it all in ${s} seconds`, { exact: false }));
      await record();
      await waitFor(() => screen.getByText(`${s}s`));
    }
    expect(screen.getByRole('button', { name: 'Start again' })).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(speech).toHaveBeenCalledWith(expect.objectContaining({ mode: 'transcribe' }));
  });

  it('retells a pasted text and checks the key points', async () => {
    render(createElement(TalkDrills));
    click(/Read and retell/);
    fireEvent.change(screen.getByPlaceholderText(/Paste a Slack thread/), { target: { value: 'The deploy failed at 3pm and the team rolled it back after twenty minutes.' } });
    click('Read it');
    click('Hide it and tell me');
    await record();
    await waitFor(() => screen.getByText('1/2'));
    expect(screen.getByText('✓ The deploy failed')).toBeTruthy();
    expect(screen.getByText('✗ It was rolled back')).toBeTruthy();
    expect(screen.getByText('failed')).toBeTruthy();
  });

  it('saves one capsule a month', async () => {
    capsules.clear();
    render(createElement(TalkDrills));
    click(/Time Capsule/);
    await waitFor(() => screen.getByRole('button', { name: 'Record' }));
    await record();
    await waitFor(() => screen.getByText('This month is saved. Come back next month.'));
    expect(capsules.size).toBe(1);
    expect(screen.getByText(/5 words · 150 words\/min · 1 uh\/um/)).toBeTruthy();
  });
});
