// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TalkPhrase } from '@/lib/talk/types';

/** Recall with no browser speech (like iPhone): the answer goes to Gemini, and what was heard always shows. */

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
let transcript = '';
const speech = vi.fn(async () => ({ transcript, seconds: 1, points: [], model: '', fixes: [] }));
vi.mock('@/lib/talk/store', () => ({ getTalkStore: () => ({ speech }) }));

const { TalkDrill } = await import('@/components/talk/TalkDrill');
afterEach(cleanup);

const phrases: TalkPhrase[] = [{ id: 'p0', text: 'on my latest bill', ipa: '', meaning: 'appearing on the most recent statement', example: 'No blank here.', setIndex: 0 }];

async function say() {
  fireEvent.click(screen.getByRole('button', { name: 'Say it' }));
  await waitFor(() => screen.getByRole('button', { name: 'Stop' }));
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
}

describe('Recall listening', () => {
  it('gives a reason when nothing was heard, then shows what was heard', async () => {
    render(createElement(TalkDrill, { phrases, onDone: () => {} }));
    transcript = '';
    await say();
    await waitFor(() => screen.getByText('No speech heard. Try again.'));
    expect(speech).toHaveBeenCalledWith(expect.objectContaining({ mode: 'transcribe' }));

    transcript = 'on my latest build';
    await say();
    await waitFor(() => screen.getByText('Not quite'));
    expect(screen.getByText('Heard: “on my latest build”')).toBeTruthy();
  });
});
