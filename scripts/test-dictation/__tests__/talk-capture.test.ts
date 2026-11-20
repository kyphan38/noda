// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TalkCapture } from '@/lib/talk/capture';

/** The stuck box saves a line, lists it and deletes it. */

const rows = new Map<string, TalkCapture>([['old', { id: 'old', text: 'an older one', createdAt: 1 }]]);
const deleteCapture = vi.fn(async (id: string) => void rows.delete(id));
vi.mock('@/lib/talk/store', () => ({
  getTalkStore: () => ({
    listCaptures: async () => [...rows.values()],
    addCapture: async (text: string) => {
      const row = { id: 'new', text, createdAt: 2 };
      rows.set(row.id, row);
      return row;
    },
    deleteCapture,
  }),
}));

const { TalkCaptureBox } = await import('@/components/talk/TalkCaptureBox');

describe('TalkCaptureBox', () => {
  it('saves, lists newest first and deletes', async () => {
    render(createElement(TalkCaptureBox));
    await waitFor(() => screen.getByText('Saved (1)'));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Type what you wanted to say.')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Got stuck? What did you want to say?'), { target: { value: '  bị block bởi team khác  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => screen.getByText('Saved (2)'));

    fireEvent.click(screen.getByText('Saved (2)'));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['bị block bởi team khác', 'an older one']);

    fireEvent.click(screen.getByRole('button', { name: 'Delete an older one' }));
    expect(deleteCapture).toHaveBeenCalledWith('old');
    expect(screen.queryByText('an older one')).toBeNull();
  });
});
