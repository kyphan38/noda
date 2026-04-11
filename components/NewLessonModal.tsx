import React, { useState } from 'react';
import { Music2, FileText } from 'lucide-react';

interface LessonData {
  name: string;
  language: 'en' | 'de';
  audioFile: File;
  transcriptFile: File | null;
}

interface NewLessonModalProps {
  onClose: () => void;
  onSubmit: (data: LessonData) => void;
}

export function NewLessonModal({ onClose, onSubmit }: NewLessonModalProps) {
  const [lessonName, setLessonName] = useState('');
  const [language, setLanguage] = useState<'en' | 'de'>('de');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      if (!lessonName) {
        setLessonName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleTranscriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTranscriptFile(file);
    }
  };

  const handleSubmit = () => {
    if (audioFile && lessonName) {
      onSubmit({
        name: lessonName,
        language,
        audioFile,
        transcriptFile
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-2xl w-[90%] max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🎧 Create New Audio Lesson</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        
        <div className="space-y-6">
          {/* Lesson name input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Lesson Name</label>
            <input
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              placeholder="Lesson name (e.g., German A1 Basics)"
              value={lessonName}
              onChange={(e) => setLessonName(e.target.value)}
            />
          </div>
          
          {/* Language selector */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Language</label>
            <select 
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              value={language} 
              onChange={(e) => setLanguage(e.target.value as 'en' | 'de')}
            >
              <option value="de">🇩🇪 German</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
          
          {/* Audio upload - SINGLE COMPACT ZONE */}
          <div className="bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-2xl p-6">
            <div className="text-center pb-6 border-b border-gray-700 mb-4 relative">
              <div className="flex justify-center mb-3 text-emerald-500">
                <Music2 size={40} />
              </div>
              <p className="text-lg font-medium text-white mb-1">Upload Audio File</p>
              <p className="text-sm text-gray-400 mb-4">MP3, WAV, M4A</p>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleAudioUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {audioFile && <p className="text-emerald-500 font-medium">✓ {audioFile.name}</p>}
            </div>
            
            {/* Transcript upload - INLINE */}
            <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg relative">
              <FileText size={20} className="text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-300">+ Add transcript (.srt) - Optional</p>
                {transcriptFile && <p className="text-xs text-emerald-500 mt-1">✓ {transcriptFile.name}</p>}
              </div>
              <input 
                type="file" 
                accept=".srt" 
                onChange={handleTranscriptUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
          
          {/* Submit button */}
          <button 
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
              audioFile && lessonName 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!audioFile || !lessonName}
            onClick={handleSubmit}
          >
            Create Lesson
          </button>
        </div>
      </div>
    </div>
  );
}
