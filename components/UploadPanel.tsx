import React, { useState } from 'react';
import { Upload, FileText, Music, Play, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { AppMode } from '@/types';
import { LEARNING_MODES } from '@/constants';

interface UploadPanelProps {
  lessonName: string;
  setLessonName: (name: string) => void;
  mediaFile: File | null;
  currentLessonId: string | null;
  handleAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  transcriptText: string;
  handleTranscriptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  recognitionLang: string;
  setRecognitionLang: (lang: string) => void;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  handleStartLearning: () => void;
  handleFlashcardUpload: (text: string, name: string) => void;
}

export function UploadPanel({
  lessonName,
  setLessonName,
  mediaFile,
  currentLessonId,
  handleAudioUpload,
  transcriptText,
  handleTranscriptUpload,
  recognitionLang,
  setRecognitionLang,
  appMode,
  setAppMode,
  handleStartLearning,
  handleFlashcardUpload
}: UploadPanelProps) {
  const [flashcardText, setFlashcardText] = useState('');
  const [flashcardName, setFlashcardName] = useState('');

  return (
    <div className="flex flex-col gap-8 mb-8 shrink-0">
      {/* Audio Lesson Box */}
      <div className="bg-gray-900/80 backdrop-blur-sm p-6 md:p-8 rounded-2xl border border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Music className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Audio Lesson</h2>
            <p className="text-sm text-gray-400">Upload an audio file and its transcript to start learning.</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Lesson Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Lesson Name (Optional)</label>
            <input 
              type="text" 
              value={lessonName}
              onChange={(e) => setLessonName(e.target.value)}
              placeholder={mediaFile ? mediaFile.name.replace(/\.[^/.]+$/, "") : "My awesome lesson"}
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-3 outline-none"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Audio Upload */}
            <div className={`p-6 rounded-xl border-2 border-dashed transition-colors ${mediaFile ? 'border-green-500 bg-green-500/10' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'}`}>
              <label className="flex flex-col items-center justify-center cursor-pointer h-full min-h-[160px]">
                {mediaFile ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                    <span className="text-green-400 font-medium text-center">{mediaFile.name}</span>
                  </>
                ) : (
                  <>
                    {currentLessonId ? (
                      <AlertTriangle className="w-12 h-12 text-emerald-500 mb-3" />
                    ) : (
                      <Music className="w-12 h-12 text-gray-400 mb-3" />
                    )}
                    <span className="text-gray-300 font-medium text-center">
                      {currentLessonId ? "Audio file missing. Please re-upload to continue." : "Upload Audio File"}
                    </span>
                    <span className="text-gray-500 text-sm mt-1">MP3, WAV, M4A</span>
                  </>
                )}
                <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
              </label>
            </div>

            {/* Transcript Upload */}
            <div className={`p-6 rounded-xl border-2 border-dashed transition-colors ${transcriptText ? 'border-green-500 bg-green-500/10' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'}`}>
              <label className="flex flex-col items-center justify-center cursor-pointer h-full min-h-[160px]">
                {transcriptText ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                    <span className="text-green-400 font-medium text-center">Transcript Loaded</span>
                    <span className="text-green-500/70 text-sm mt-1">{transcriptText.split('\n').filter(s => s.trim()).length} sentences</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-12 h-12 text-gray-400 mb-3" />
                    <span className="text-gray-300 font-medium">Upload Transcript</span>
                    <span className="text-gray-500 text-sm mt-1">.srt file</span>
                  </>
                )}
                <input type="file" accept=".srt" className="hidden" onChange={handleTranscriptUpload} />
              </label>
            </div>
          </div>

          {/* Language Selection & Start Button */}
          <div className="flex flex-col items-center gap-6 bg-gray-800/30 p-6 rounded-xl border border-gray-700/50">
             <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
               <div className="flex items-center justify-between gap-4 bg-gray-800 p-3 rounded-lg border border-gray-700 flex-1 max-w-[240px]">
                 <span className="text-gray-300 font-medium text-sm">Language:</span>
                 <select 
                   value={recognitionLang} 
                   onChange={(e) => setRecognitionLang(e.target.value)}
                   className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-md focus:ring-emerald-500 focus:border-emerald-500 block p-1.5 outline-none"
                 >
                   <option value="de-DE">German (de-DE)</option>
                   <option value="en-US">English (en-US)</option>
                 </select>
               </div>

               <div className="flex items-center justify-between gap-4 bg-gray-800 p-3 rounded-lg border border-gray-700 flex-1 max-w-[240px]">
                 <span className="text-gray-300 font-medium text-sm">Mode:</span>
                 <select 
                   value={appMode} 
                   onChange={(e) => setAppMode(e.target.value as AppMode)}
                   className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-md focus:ring-emerald-500 focus:border-emerald-500 block p-1.5 outline-none"
                 >
                   {LEARNING_MODES.map(mode => (
                     <option key={mode.value} value={mode.value}>{mode.label}</option>
                   ))}
                 </select>
               </div>
             </div>
             
             <button 
               disabled={!mediaFile || !transcriptText}
               onClick={handleStartLearning}
               className="w-full max-w-md py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95"
             >
               {currentLessonId ? 'Restore Lesson & Continue' : 'Start Learning'}{' '}
               <Play className="w-6 h-6 fill-current" />
             </button>
          </div>
        </div>
      </div>

      {/* Flashcard Box */}
      <div className="bg-gray-900/80 backdrop-blur-sm p-6 md:p-8 rounded-2xl border border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Flashcard Deck</h2>
            <p className="text-sm text-gray-400">Paste your vocabulary or sentences to create a new deck.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Deck Name (Optional)</label>
            <input 
              type="text" 
              value={flashcardName}
              onChange={(e) => setFlashcardName(e.target.value)}
              placeholder="e.g., German Verbs 101"
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Flashcard Content (One item per line)</label>
            <textarea
              value={flashcardText}
              onChange={(e) => setFlashcardText(e.target.value)}
              placeholder="Paste your text here...&#10;Line 1&#10;Line 2&#10;..."
              className="w-full h-48 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-4 outline-none resize-y font-mono text-sm leading-relaxed"
            />
          </div>

          <div className="flex justify-end mt-2">
            <button
              disabled={!flashcardText.trim()}
              onClick={() => {
                handleFlashcardUpload(flashcardText, flashcardName);
                setFlashcardText('');
                setFlashcardName('');
              }}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
            >
              <FileText className="w-5 h-5" />
              Create Deck
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
