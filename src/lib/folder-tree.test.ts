import { describe, expect, it } from 'vitest';
import type { LessonItem, SidebarFolder } from '@/types';
import {
  childrenByParent,
  computeMidSortKey,
  groupItemsByFolder,
  indexFolders,
  parseDragPayload,
  subtreeCounts,
  topLevelFolders,
  wouldCreateCycle,
} from './folder-tree';

const folder = (id: string, parentId: string | null, sortKey = 0) =>
  ({ id, name: id, kind: 'audio', language: 'en', parentId, sortKey, createdAt: 0, updatedAt: 0 }) as SidebarFolder;
const item = (id: string, name: string, folderId: string | null = null, sortKey?: number) =>
  ({ id, name, folderId, sortKey }) as unknown as LessonItem;

// a > b > c, and d at the top
const folders = [folder('b', 'a', 2), folder('a', null, 2), folder('c', 'b'), folder('d', null, 1)];
const byId = indexFolders(folders);

describe('parseDragPayload', () => {
  it('accepts our item and folder payloads only', () => {
    expect(parseDragPayload(JSON.stringify({ entity: 'item', id: 'x', fromFolderId: null }))?.id).toBe('x');
    expect(parseDragPayload(JSON.stringify({ entity: 'folder', id: 'f', fromParentId: 'a' }))?.entity).toBe('folder');
    expect(parseDragPayload('')).toBeNull();
    expect(parseDragPayload('not json')).toBeNull();
    expect(parseDragPayload(JSON.stringify({ entity: 'file', id: 'x' }))).toBeNull();
    expect(parseDragPayload(JSON.stringify({ entity: 'item', id: 3 }))).toBeNull();
  });
});

describe('computeMidSortKey', () => {
  it('goes between neighbours, or one past the only one', () => {
    expect(computeMidSortKey(1, 3)).toBe(2);
    expect(computeMidSortKey(5, undefined)).toBe(6);
    expect(computeMidSortKey(undefined, 5)).toBe(4);
    expect(computeMidSortKey(undefined, undefined, 123)).toBe(123);
  });
});

describe('folder order', () => {
  it('lists top folders and children by sort key', () => {
    expect(topLevelFolders(folders).map((f) => f.id)).toEqual(['d', 'a']);
    expect(childrenByParent(folders).get('a')?.map((f) => f.id)).toEqual(['b']);
    expect(childrenByParent(folders).has('d')).toBe(false);
  });
});

describe('groupItemsByFolder', () => {
  it('sorts by name in natural order and sends lost folders to the root', () => {
    const m = groupItemsByFolder(
      [item('1', 'Lesson 10', 'a'), item('2', 'lesson 2', 'a'), item('3', 'Gone', 'zzz'), item('4', 'Root')],
      byId,
    );
    expect(m.get('a')?.map((i) => i.id)).toEqual(['2', '1']);
    expect(m.get(null)?.map((i) => i.id)).toEqual(['3', '4']);
  });
  it('breaks name ties by sort key, then id', () => {
    const m = groupItemsByFolder([item('b', 'Same', null, 2), item('a', 'Same', null, 1), item('c', 'Same')], byId);
    expect(m.get(null)?.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('wouldCreateCycle', () => {
  it('refuses moving a folder into itself or below itself', () => {
    expect(wouldCreateCycle('a', 'a', byId)).toBe(true);
    expect(wouldCreateCycle('a', 'c', byId)).toBe(true);
    expect(wouldCreateCycle('c', 'd', byId)).toBe(false);
    expect(wouldCreateCycle('a', null, byId)).toBe(false);
  });
});

describe('subtreeCounts', () => {
  it('counts items in a folder and all its sub-folders', () => {
    const items = groupItemsByFolder([item('1', 'x', 'a'), item('2', 'y', 'b'), item('3', 'z', 'c'), item('4', 'w', 'd')], byId);
    const counts = subtreeCounts(folders, items, childrenByParent(folders));
    expect(counts.get('a')).toBe(3);
    expect(counts.get('b')).toBe(2);
    expect(counts.get('d')).toBe(1);
  });
  it('does not loop forever on a broken parent loop', () => {
    const loop = [folder('p', 'q'), folder('q', 'p')];
    const counts = subtreeCounts(loop, new Map(), childrenByParent(loop));
    expect(counts.get('p')).toBe(0);
  });
});
