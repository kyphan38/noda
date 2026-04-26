import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus } from 'lucide-react';
import { LessonItem, DeckItem, SidebarFolder } from '@/types';
import { LessonCard } from './LessonCard';
import { DeckCard } from './DeckCard';
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
  onChangeLanguage?: (id: string, language: 'en' | 'de') => void | Promise<void>;
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
  onChangeLanguage,
  activeMenu,
  setActiveMenu,
  isLoading,
  isMobile = false,
}: SidebarSectionProps) {
  const isExpanded = expandedSections[type] ?? (type === 'lessons' || type === 'decks');
  const toggleSection = () => onToggleSection(type, !isExpanded);

  const [creating, setCreating] = useState<null | { kind: 'audio' | 'flashcard'; language: 'en' | 'de' }>(null);

  return (
    <div className="space-y-1">
      <button
        onClick={toggleSection}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors duration-200"
      >
        <span>{title}</span>
        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>

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

          {!isLoading && type === 'lessons' && items.length > 0 && (() => {
            const list = items as LessonItem[];
            const enLessons = list.filter((i) => i.language === 'en');
            const deLessons = list.filter((i) => i.language === 'de');
            return (
              <>
                {enLessons.length > 0 && (
                  <Accordion
                    title="EN"
                    isExpanded={expandedSections['audio-en'] ?? true}
                    onToggle={() => onToggleSection('audio-en', !(expandedSections['audio-en'] ?? true))}
                    onCreateFolder={() => {
                      setCreating({ kind: 'audio', language: 'en' });
                    }}
                  >
                    {creating?.kind === 'audio' && creating.language === 'en' && (
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
                      language="en"
                      items={enLessons}
                      folders={folders.filter((f) => f.kind === 'audio' && f.language === 'en')}
                      selectedItemId={selectedItemId}
                      expandedSections={expandedSections}
                      forcedExpandedFolderIds={forcedExpandedFolderIds}
                      disableCaps={disableCaps}
                      onToggleSection={onToggleSection}
                      onItemSelect={onItemSelect}
                      onTrashItem={onTrashItem}
                      onRenameLesson={onRenameLesson}
                      onChangeLanguage={onChangeLanguage}
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
                  </Accordion>
                )}
                {deLessons.length > 0 && (
                  <Accordion
                    title="DE"
                    isExpanded={expandedSections['audio-de'] ?? false}
                    onToggle={() => onToggleSection('audio-de', !(expandedSections['audio-de'] ?? false))}
                    onCreateFolder={() => {
                      setCreating({ kind: 'audio', language: 'de' });
                    }}
                  >
                    {creating?.kind === 'audio' && creating.language === 'de' && (
                      <div className="ml-2 px-2 py-1">
                        <InlineCreateInput
                          placeholder="New folder…"
                          onCommit={(name) =>
                            folderActions.createFolder({ name, kind: 'audio', language: 'de', parentId: null })
                          }
                          onCancel={() => setCreating(null)}
                        />
                      </div>
                    )}
                    <SidebarFolderTree
                      kind="audio"
                      language="de"
                      items={deLessons}
                      folders={folders.filter((f) => f.kind === 'audio' && f.language === 'de')}
                      selectedItemId={selectedItemId}
                      expandedSections={expandedSections}
                      forcedExpandedFolderIds={forcedExpandedFolderIds}
                      disableCaps={disableCaps}
                      onToggleSection={onToggleSection}
                      onItemSelect={onItemSelect}
                      onTrashItem={onTrashItem}
                      onRenameLesson={onRenameLesson}
                      onChangeLanguage={onChangeLanguage}
                      activeMenu={activeMenu}
                      setActiveMenu={setActiveMenu}
                      enableDnd={!isMobile}
                      onCreateFolder={({ name, parentId }) =>
                        folderActions.createFolder({ name, kind: 'audio', language: 'de', parentId })
                      }
                      onRenameFolder={(id, name) => folderActions.renameFolder(id, name)}
                      onDeleteFolder={(id) => folderActions.deleteFolder(id)}
                      onMoveItem={(itemId, folderId, sortKey) => folderActions.moveItem(itemId, folderId, sortKey)}
                      onMoveFolder={(folderId, parentId, sortKey) =>
                        folderActions.moveFolder(folderId, parentId, sortKey)
                      }
                    />
                  </Accordion>
                )}
              </>
            );
          })()}

          {!isLoading && type === 'decks' && items.length > 0 && (() => {
            const list = items as DeckItem[];
            const enDecks = list.filter((d) => d.language === 'en' || d.language === 'mixed');
            const deDecks = list.filter((d) => d.language === 'de');
            return (
              <>
                {enDecks.length > 0 && (
                  <Accordion
                    title="EN"
                    isExpanded={expandedSections['flashcard-en'] ?? true}
                    onToggle={() => onToggleSection('flashcard-en', !(expandedSections['flashcard-en'] ?? true))}
                    onCreateFolder={() => {
                      setCreating({ kind: 'flashcard', language: 'en' });
                    }}
                  >
                    {creating?.kind === 'flashcard' && creating.language === 'en' && (
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
                      language="en"
                      items={enDecks}
                      folders={folders.filter((f) => f.kind === 'flashcard' && f.language === 'en')}
                      selectedItemId={selectedItemId}
                      expandedSections={expandedSections}
                      forcedExpandedFolderIds={forcedExpandedFolderIds}
                      disableCaps={disableCaps}
                      onToggleSection={onToggleSection}
                      onItemSelect={onItemSelect}
                      onTrashItem={onTrashItem}
                      onRenameLesson={onRenameLesson}
                      onChangeLanguage={onChangeLanguage}
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
                  </Accordion>
                )}
                {deDecks.length > 0 && (
                  <Accordion
                    title="DE"
                    isExpanded={expandedSections['flashcard-de'] ?? false}
                    onToggle={() =>
                      onToggleSection('flashcard-de', !(expandedSections['flashcard-de'] ?? false))
                    }
                    onCreateFolder={() => {
                      setCreating({ kind: 'flashcard', language: 'de' });
                    }}
                  >
                    {creating?.kind === 'flashcard' && creating.language === 'de' && (
                      <div className="ml-2 px-2 py-1">
                        <InlineCreateInput
                          placeholder="New folder…"
                          onCommit={(name) =>
                            folderActions.createFolder({ name, kind: 'flashcard', language: 'de', parentId: null })
                          }
                          onCancel={() => setCreating(null)}
                        />
                      </div>
                    )}
                    <SidebarFolderTree
                      kind="flashcard"
                      language="de"
                      items={deDecks}
                      folders={folders.filter((f) => f.kind === 'flashcard' && f.language === 'de')}
                      selectedItemId={selectedItemId}
                      expandedSections={expandedSections}
                      forcedExpandedFolderIds={forcedExpandedFolderIds}
                      disableCaps={disableCaps}
                      onToggleSection={onToggleSection}
                      onItemSelect={onItemSelect}
                      onTrashItem={onTrashItem}
                      onRenameLesson={onRenameLesson}
                      onChangeLanguage={onChangeLanguage}
                      activeMenu={activeMenu}
                      setActiveMenu={setActiveMenu}
                      enableDnd={!isMobile}
                      onCreateFolder={({ name, parentId }) =>
                        folderActions.createFolder({ name, kind: 'flashcard', language: 'de', parentId })
                      }
                      onRenameFolder={(id, name) => folderActions.renameFolder(id, name)}
                      onDeleteFolder={(id) => folderActions.deleteFolder(id)}
                      onMoveItem={(itemId, folderId, sortKey) => folderActions.moveItem(itemId, folderId, sortKey)}
                      onMoveFolder={(folderId, parentId, sortKey) =>
                        folderActions.moveFolder(folderId, parentId, sortKey)
                      }
                    />
                  </Accordion>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function Accordion({
  title,
  isExpanded,
  onToggle,
  onCreateFolder,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCreateFolder?: () => void;
  children: React.ReactNode;
}) {
  // Intentionally no window.prompt: folder creation is inline + non-blocking.
  return (
    <div className="space-y-1 group">
      <div className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-200 transition-colors duration-200">
        <button type="button" onClick={onToggle} className="flex-1 text-left">
          <span>{title}</span>
        </button>
        <div className="flex items-center gap-1">
          {onCreateFolder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateFolder();
              }}
              className="rounded p-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white focus-visible:opacity-100 transition-colors"
              aria-label="New folder"
              title="New folder"
            >
              <FolderPlus size={14} />
            </button>
          )}
          <button type="button" onClick={onToggle} className="rounded p-0.5 hover:text-white">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>
      {isExpanded && <div className="space-y-1">{children}</div>}
    </div>
  );
}
