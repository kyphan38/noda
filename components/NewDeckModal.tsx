import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Upload } from 'lucide-react';
import { isLessonNameTaken } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DeckData {
  name: string;
  language: 'en' | 'de';
  folderId: string | null;
  content: string;
}

interface NewDeckModalProps {
  onClose: () => void;
  onSubmit: (data: DeckData) => void;
  getTakenFlashcardDeckNames: () => string[];
  folders?: Array<{ id: string; name: string }>;
}

export function NewDeckModal({ onClose, onSubmit, getTakenFlashcardDeckNames, folders = [] }: NewDeckModalProps) {
  const [deckName, setDeckName] = useState('');
  const [language, setLanguage] = useState<'en' | 'de'>('de');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [cardCount, setCardCount] = useState(0);
  const [dropActive, setDropActive] = useState(false);
  const [uploadedFileNameConflict, setUploadedFileNameConflict] = useState<string | null>(null);

  useEffect(() => {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    setCardCount(lines.length);
  }, [content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ingestTextFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const stem = file.name.replace(/\.[^/.]+$/, '');
        const taken = getTakenFlashcardDeckNames();
        if (isLessonNameTaken(stem, taken)) {
          setUploadedFileNameConflict(
            `A deck named "${stem}" already exists. Use another file or type a different deck name above.`
          );
          return;
        }
        setUploadedFileNameConflict(null);
        setContent(text);
        setDeckName(stem);
      };
      reader.readAsText(file);
    },
    [getTakenFlashcardDeckNames]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) ingestTextFile(file);
    e.target.value = '';
  };

  const handleTextareaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const isTxt = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';
    if (isTxt) ingestTextFile(file);
  };

  const handleSubmit = () => {
    if (deckName && cardCount > 0) {
      onSubmit({
        name: deckName,
        language,
        folderId,
        content
      });
    }
  };

  return (
    <div className="app-modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="app-modal-panel bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/80">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🎴 New Deck</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </Button>
        </div>

        {uploadedFileNameConflict ? (
          <Alert variant="warning" className="mb-4">
            <AlertTitle>Name already in use</AlertTitle>
            <AlertDescription>{uploadedFileNameConflict}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Deck Name</label>
            <input
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder=""
              value={deckName}
              onChange={(e) => {
                setDeckName(e.target.value);
                setUploadedFileNameConflict(null);
              }}
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Language</label>
            <select
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'de')}
            >
              <option value="de">de</option>
              <option value="en">en</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Folder</label>
            <select
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              value={folderId ?? ''}
              onChange={(e) => setFolderId(e.target.value ? e.target.value : null)}
            >
              <option value="">(Root)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              Content
              <span className="text-gray-500 text-xs font-normal">(One item per line)</span>
            </label>

            <div
              onDragEnter={(e) => { e.preventDefault(); setDropActive(true); }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false);
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={handleTextareaDrop}
              className={`rounded-xl transition-[box-shadow,background-color] ${dropActive ? 'ring-2 ring-blue-500/40 bg-blue-500/5' : ''}`}
            >
              <textarea
                className="w-full min-h-[200px] max-h-[280px] bg-gray-900/80 border border-gray-700 rounded-xl p-4 font-mono text-sm leading-relaxed text-white resize-y focus:outline-none focus:border-blue-500"
                placeholder=""
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Drop a .txt file onto the box above to import lines.</p>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                <Layers size={16} />
                <span>{cardCount} cards</span>
              </div>

              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">or</p>
                <label
                  className={cn(
                    buttonVariants({ variant: 'secondary', size: 'sm' }),
                    'inline-flex cursor-pointer items-center gap-2',
                  )}
                >
                  <Upload size={16} />
                  Upload .txt file
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            className="h-auto w-full justify-center rounded-xl py-4 text-lg font-bold"
            disabled={!deckName || cardCount === 0}
            onClick={handleSubmit}
          >
            Create ({cardCount} cards)
          </Button>
        </div>
      </div>
    </div>
  );
}
