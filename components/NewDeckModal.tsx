import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Upload } from 'lucide-react';
import { isLessonNameTaken } from '@/lib/utils';

export interface DeckData {
  name: string;
  language: 'en' | 'de';
  content: string;
}

interface NewDeckModalProps {
  onClose: () => void;
  onSubmit: (data: DeckData) => void;
  getTakenFlashcardDeckNames: () => string[];
}

export function NewDeckModal({ onClose, onSubmit, getTakenFlashcardDeckNames }: NewDeckModalProps) {
  const [deckName, setDeckName] = useState('');
  const [language, setLanguage] = useState<'en' | 'de'>('de');
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
        content
      });
    }
  };

  return (
    <div className="app-modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="app-modal-panel bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/80">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🎴 Create Flashcard Deck</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Deck Name</label>
            <input
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="Deck name (e.g., German Verbs A1)"
              value={deckName}
              onChange={(e) => {
                setDeckName(e.target.value);
                setUploadedFileNameConflict(null);
              }}
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
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              Flashcard Content
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
                placeholder={`der Apfel\ndie Katze\ndas Haus\nlernen\nmachen\n...`}
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            {uploadedFileNameConflict && (
              <p className="text-sm text-amber-400 mt-2" role="alert">
                {uploadedFileNameConflict}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">Drop a .txt file onto the box above to import lines.</p>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                <Layers size={16} />
                <span>{cardCount} cards</span>
              </div>

              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">or</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors">
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

          <button
            type="button"
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
              deckName && cardCount > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!deckName || cardCount === 0}
            onClick={handleSubmit}
          >
            Create Deck ({cardCount} cards)
          </button>
        </div>
      </div>
    </div>
  );
}
