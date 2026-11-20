// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TalkPhrase, TalkPhraseProgress, TalkTopic } from '@/lib/talk/types';

/** Star a phrase on the topic screen; starred phrases list with their stage. */

const progress = new Map<string, TalkPhraseProgress>();
const setStar = vi.fn(async (topicId: string, p: TalkPhrase, starred: boolean, prev?: TalkPhraseProgress) => {
  const row = { topicId, phraseId: p.id, text: p.text, stage: prev?.stage ?? ('new' as const), usedCount: 0, starred, updatedAt: 1 };
  progress.set(p.id, row);
  return row;
});
vi.mock('@/lib/talk/store', () => ({
  getTalkStore: () => ({
    listProgress: async () => new Map(progress),
    setStar,
    listStarred: async () => [
      { topicId: 't', phraseId: 'p0', text: 'wrap up', stage: 'active', usedCount: 1, starred: true, updatedAt: 1 },
      { topicId: 't', phraseId: 'p1', text: 'ship it', stage: 'recalled', usedCount: 0, starred: true, updatedAt: 1 },
    ],
  }),
}));

const { TalkTopicView } = await import('@/components/talk/TalkTopicView');
const { TalkStarredList } = await import('@/components/talk/TalkStarredList');

afterEach(cleanup);

const topic: TalkTopic = {
  id: 't',
  title: 'Daily standup',
  description: '',
  kind: 'preset',
  level: 'B2',
  persona: { name: 'Dana', role: 'Manager', style: '' },
  scenarios: [],
  phrases: [{ id: 'p0', text: 'wrap up', ipa: '', meaning: 'finish', example: '', setIndex: 0 }],
  version: 3,
  createdAt: 0,
};

describe('starring phrases', () => {
  it('stars and unstars a phrase on the topic screen', async () => {
    render(createElement(TalkTopicView, { topic, onBack: () => {}, onChange: () => {}, onDelete: () => {} }));
    await waitFor(() => screen.getByText('Set 1'));
    fireEvent.click(screen.getByText('Set 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Star wrap up' }));
    await waitFor(() => screen.getByRole('button', { name: 'Unstar wrap up' }));
    expect(setStar).toHaveBeenCalledWith('t', topic.phrases[0], true, undefined);
  });

  it('lists starred phrases with how far each one is', async () => {
    render(createElement(TalkStarredList));
    await waitFor(() => screen.getByText('1/2 yours'));
    fireEvent.click(screen.getByText('Starred phrases'));
    expect(screen.getByText('Yours')).toBeTruthy();
    expect(screen.getByText('Known')).toBeTruthy();
  });
});
