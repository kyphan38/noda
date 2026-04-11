'use client';

import React from 'react';
import { FolderOpen, Plus, Trash2, LogOut, PanelLeft, CheckCircle2, Wand2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { LessonSummary, ExpandedSections } from '@/types';
import { SIDEBAR_SECTIONS, SECTION_LABELS } from '@/constants';

interface SidebarProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  lessons: LessonSummary[];
  currentLessonId: string | null;
  expandedSections: ExpandedSections;
  onLoadLesson: (id: string) => void;
  onNewLesson: () => void;
  onTrashLesson: (id: string) => void;
  onLogout: () => void;
  onToggleSection: (section: string, expanded: boolean) => void;
}

export function Sidebar({
  isOpen,
  onToggle,
  lessons,
  currentLessonId,
  expandedSections,
  onLoadLesson,
  onNewLesson,
  onTrashLesson,
  onLogout,
  onToggleSection,
}: SidebarProps) {
  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => onToggle(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`shrink-0 transition-all duration-300 ease-in-out ${isOpen ? 'w-72' : 'w-0'} relative z-50`}
      >
        <div
          className={`fixed inset-y-0 left-0 w-72 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FolderOpen size={18} className="text-emerald-500" /> My Lessons
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={onLogout}
                className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
              <button
                onClick={() => onToggle(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title="Close Sidebar"
              >
                <PanelLeft size={20} />
              </button>
            </div>
          </div>

          <div className="p-4">
            <button
              onClick={onNewLesson}
              className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg border border-emerald-500/30 flex items-center justify-center gap-2 font-medium transition-colors mb-3"
            >
              <Plus size={18} /> New Lesson
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-6">
            {SIDEBAR_SECTIONS.map((section) => {
              let sectionLessons = [];
              if (section === 'trash') {
                sectionLessons = lessons.filter((l) => l.isTrashed);
              } else {
                sectionLessons = lessons.filter((l) => l.language === section && !l.isTrashed);
              }

              if (sectionLessons.length === 0) return null;

              const isExpanded = expandedSections[section];
              const toggleSection = () => onToggleSection(section, !isExpanded);

              return (
                <div key={section} className="space-y-1">
                  <button
                    onClick={toggleSection}
                    className="w-full flex items-center justify-between px-3 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-300 transition-colors"
                  >
                    <span>{SECTION_LABELS[section]}</span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {isExpanded &&
                    sectionLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        onClick={() => onLoadLesson(lesson.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                          currentLessonId === lesson.id
                            ? 'bg-gray-800 border border-gray-700'
                            : 'hover:bg-gray-800/50 border border-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4
                            className="font-medium text-gray-200 text-sm truncate pr-2"
                            title={lesson.name}
                          >
                            {lesson.name}
                            {!lesson.hasAudio && (
                              <span title="Audio file missing">
                                <AlertTriangle size={12} className="inline ml-1 text-emerald-500" />
                              </span>
                            )}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrashLesson(lesson.id);
                            }}
                            className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={section === 'trash' ? 'Delete permanently' : 'Move to trash'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <CheckCircle2
                              size={12}
                              className={lesson.progress === 100 ? 'text-green-400' : ''}
                            />
                            {lesson.progress}%
                          </span>
                          {lesson.hasIpa && (
                            <span className="flex items-center gap-1 text-purple-400" title="IPA Generated">
                              <Wand2 size={12} /> IPA
                            </span>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full ${
                              lesson.progress === 100 ? 'bg-green-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${lesson.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
