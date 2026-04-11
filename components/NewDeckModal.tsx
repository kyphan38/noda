import React, { useState, useEffect } from 'react';
import { Layers, Upload } from 'lucide-react';

export interface DeckData {
  name: string;
  language: 'en' | 'de';
  content: string;
}

interface NewDeckModalProps {
  onClose: () => void;
  onSubmit: (data: DeckData) => void;
}

export function NewDeckModal({ onClose, onSubmit }: NewDeckModalProps) {
  const [deckName, setDeckName] = useState('');
  const [language, setLanguage] = useState<'en' | 'de'>('de');
  const [content, setContent] = useState('');
  const [cardCount, setCardCount] = useState(0);
  
  // Auto-count cards as user types
  useEffect(() => {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    setCardCount(lines.length);
  }, [content]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setContent(text);
        if (!deckName) {
          setDeckName(file.name.replace(/\.[^/.]+$/, ""));
        }
      };
      reader.readAsText(file);
    }
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-2xl w-[90%] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🎴 Create Flashcard Deck</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        
        <div className="space-y-6">
          {/* Deck name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Deck Name</label>
            <input
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="Deck name (e.g., German Verbs A1)"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
            />
          </div>
          
          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Language</label>
            <select 
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              value={language} 
              onChange={(e) => setLanguage(e.target.value as 'en' | 'de')}
            >
              <option value="de">🇩🇪 German</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
          
          {/* Content textarea */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
              Flashcard Content
              <span className="text-gray-500 text-xs font-normal">
                (One item per line)
              </span>
            </label>
            
            <textarea
              className="w-full min-h-[240px] bg-gray-900/80 border border-gray-700 rounded-xl p-4 font-mono text-sm leading-relaxed text-white resize-y focus:outline-none focus:border-blue-500"
              placeholder={`der Apfel\ndie Katze\ndas Haus\nlernen\nmachen\n...`}
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                <Layers size={16} />
                <span>{cardCount} cards</span>
              </div>

              {/* File upload alternative */}
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">or</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors">
                  <Upload size={16} />
                  Upload .txt file
                  <input 
                    type="file" 
                    accept=".txt" 
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
          
          {/* Submit */}
          <button
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
