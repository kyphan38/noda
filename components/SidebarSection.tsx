import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus } from 'lucide-react';
import { LessonItem, DeckItem, SidebarFolder } from '@/types';
import { LessonCardSkeleton, DeckCardSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import { SidebarFolderTree } from './SidebarFolderTree';
import type { UseFoldersResult } from '@/hooks/useFolders';
import { InlineCreateInput } from './InlineCreateInput';

interface SidebarSectionProps {
  type: 'lessons' | 'decks';
  title: string;
  items: LessonItem[] | DeckItem[];
  folders: SidebarFolder[];
  folderActions: Pick<
    UseFoldersResult,
    | 'createFolder'
    | 'renameFolder'
    | 'deleteFolder'
    | 'moveFolder'
    | 'reorderFolder'
    | 'moveItem'
    | 'reorderItem'
  >;
  selectedItemId?: string;
  expandedSections: Record<string, boolean>;
  forcedExpandedFolderIds?: Set<string>;
  disableCaps?: boolean;
  onToggleSection: (section: string, expanded: boolean) => void;
  onItemSelect: (item: LessonItem | DeckItem) => void;
  onTrashItem: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
  isLoading?: boolean;
  isMobile?: boolean;
}

export function SidebarSection({
  type,
  title,
  items,
  folders,
  folderActions,
  selectedItemId,
  expandedSections,
  forcedExpandedFolderIds,
  disableCaps = false,
  onToggleSection,
  onItemSelect,
  onTrashItem,
  onRenameLesson,
  activeMenu,
  setActiveMenu,
  isLoading,
  isMobile = false,
}: SidebarSectionProps) {
  const isExpanded = expandedSections[type] ?? (type === 'lessons' || type === 'decks');
  const toggleSection = () => onToggleSection(type, !isExpanded);

  const [creating, setCreating] = useState<null | 'audio' | 'flashcard'>(null);

  const kind = type === 'lessons' ? 'audio' : 'flashcard';
  const filteredFolders = folders.filter((f) => f.kind === kind);

  return (
    <div className="space-y-1">
      <div className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors duration-200 group">
        <button type="button" onClick={toggleSection} className="flex-1 flex items-center gap-2 text-left min-w-0">
          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span className="truncate">{title}</span>
        </button>
        {isExpanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCreating(kind);
            }}
            className="shrink-0 rounded p-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white focus-visible:opacity-100 transition-colors"
            aria-label="New folder"
            title="New folder"
          >
            <FolderPlus size={14} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {isLoading && type === 'lessons' && (
            <div className="space-y-2 px-1">
              <LessonCardSkeleton />
              <LessonCardSkeleton />
              <LessonCardSkeleton />
            </div>
          )}

          {isLoading && type === 'decks' && (
            <div className="space-y-1 px-1">
              <DeckCardSkeleton />
              <DeckCardSkeleton />
              <DeckCardSkeleton />
            </div>
          )}

          {!isLoading && items.length === 0 && (type === 'lessons' || type === 'decks') && (
            <EmptyState type={type} />
          )}

          {!isLoading && type === 'lessons' && items.length > 0 && (
            <>
              {creating === 'audio' && (
                <div className="ml-2 px-2 py-1">
                  <InlineCreateInput
                    placeholder="New folder…"
                    onCommit={(name) =>
                      folderActions.createFolder({ name, kind: 'audio', language: 'en', parentId: null })
                    }
                    onCancel={() => setCreating(null)}
                  />
                </div>
              )}
              <SidebarFolderTree
                kind="audio"
                items={items as LessonItem[]}
                folders={filteredFolders}
                selectedItemId={selectedItemId}
                expandedSections={expandedSections}
                forcedExpandedFolderIds={forcedExpandedFolderIds}
                disableCaps={disableCaps}
                onToggleSection={onToggleSection}
                onItemSelect={onItemSelect}
                onTrashItem={onTrashItem}
                onRenameLesson={onRenameLesson}
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                enableDnd={!isMobile}
                onCreateFolder={({ name, parentId }) =>
                  folderActions.createFolder({ name, kind: 'audio', language: 'en', parentId })
                }
                onRenameFolder={(id, name) => folderActions.renameFolder(id, name)}
                onDeleteFolder={(id) => folderActions.deleteFolder(id)}
                onMoveItem={(itemId, folderId, sortKey) => folderActions.moveItem(itemId, folderId, sortKey)}
                onMoveFolder={(folderId, parentId, sortKey) =>
                  folderActions.moveFolder(folderId, parentId, sortKey)
                }
              />
            </>
          )}

          {!isLoading && type === 'decks' && items.length > 0 && (
            <>
              {creating === 'flashcard' && (
                <div className="ml-2 px-2 py-1">
                  <InlineCreateInput
                    placeholder="New folder…"
                    onCommit={(name) =>
                      folderActions.createFolder({ name, kind: 'flashcard', language: 'en', parentId: null })
                    }
                    onCancel={() => setCreating(null)}
                  />
                </div>
              )}
              <SidebarFolderTree
                kind="flashcard"
                items={items as DeckItem[]}
                folders={filteredFolders}
                selectedItemId={selectedItemId}
                expandedSections={expandedSections}
                forcedExpandedFolderIds={forcedExpandedFolderIds}
                disableCaps={disableCaps}
                onToggleSection={onToggleSection}
                onItemSelect={onItemSelect}
                onTrashItem={onTrashItem}
                onRenameLesson={onRenameLesson}
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
                enableDnd={!isMobile}
                onCreateFolder={({ name, parentId }) =>
                  folderActions.createFolder({ name, kind: 'flashcard', language: 'en', parentId })
                }
                onRenameFolder={(id, name) => folderActions.renameFolder(id, name)}
                onDeleteFolder={(id) => folderActions.deleteFolder(id)}
                onMoveItem={(itemId, folderId, sortKey) => folderActions.moveItem(itemId, folderId, sortKey)}
                onMoveFolder={(folderId, parentId, sortKey) =>
                  folderActions.moveFolder(folderId, parentId, sortKey)
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
