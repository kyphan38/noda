import React from 'react';
import { LessonItem, SidebarFolder } from '@/types';
import { LessonCardSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import { SidebarFolderTree } from './SidebarFolderTree';
import type { UseFoldersResult } from '@/hooks/useFolders';
import { InlineCreateInput } from './InlineCreateInput';

interface SidebarSectionProps {
  items: LessonItem[];
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
  onItemSelect: (item: LessonItem) => void;
  onTrashItem: (id: string) => void;
  onRenameLesson?: (id: string, newName: string) => void;
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
  isLoading?: boolean;
  isMobile?: boolean;
  /** Shows a "New folder" box at the top; the parent opens it, the section closes it. */
  creatingFolder: boolean;
  onCreatingFolderChange: (creating: boolean) => void;
}

function SidebarSectionImpl({
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
  creatingFolder,
  onCreatingFolderChange,
}: SidebarSectionProps) {
  // The only section, so it has no header and is always open.
  return (
    <div className="space-y-1">
      {creatingFolder && (
        <div className="ml-2 px-2 py-1">
          <InlineCreateInput
            placeholder="New folder…"
            onCommit={(name) => folderActions.createFolder({ name, kind: 'audio', language: 'en', parentId: null })}
            onCancel={() => onCreatingFolderChange(false)}
          />
        </div>
      )}
      <div className="space-y-2">
      {isLoading && (
        <div className="space-y-2 px-1">
          <LessonCardSkeleton />
          <LessonCardSkeleton />
          <LessonCardSkeleton />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <EmptyState />
      )}

      {!isLoading && items.length > 0 && (
        <>
          <SidebarFolderTree
            items={items}
            folders={folders}
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

      </div>
    </div>
  );
}

export const SidebarSection = React.memo(SidebarSectionImpl);
