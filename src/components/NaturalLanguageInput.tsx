import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, ArrowRight, Loader2, Mic, MicOff, AlertCircle } from 'lucide-react';
import { callAiNaturalParse } from '../utils/ai';
import { parseTaskText } from '../utils/nlp';
import { formatDue } from '../utils/dates';
import { Task } from '../types';

interface NaturalLanguageInputProps {
  onTaskCreated: (taskData: Partial<Task>) => void;
  categories?: { name: string }[];
}

const PRIORITY_CHIP: Record<string, [string, string]> = {
  urgent: ['Urgente', 'bg-rose-500/10 text-rose-500 border-rose-500/30'],
  high: ['Haute', 'bg-amber-500/10 text-amber-500 border-amber-500/30'],
  low: ['Basse', 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'],
};

// Extend window for Web Speech API typings
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const NaturalLanguageInput: React.FC<NaturalLanguageInputProps> = ({ onTaskCreated, categories = [] }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechFeedback, setSpeechFeedback] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  // Aperçu en direct de ce que l'analyse a compris.
  const preview = useMemo(() => (input.trim() ? parseTaskText(input, categories) : null), [input, categories]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechFeedback('Écoute en cours... Décrivez votre tâche');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechFeedback('Accès au microphone refusé');
        } else if (event.error === 'no-speech') {
          setSpeechFeedback('Aucune parole détectée');
        } else {
          setSpeechFeedback('Erreur microphone');
        }
        setTimeout(() => setSpeechFeedback(null), 3500);
      };

      recognition.onend = () => {
        setIsListening(false);
        setTimeout(() => setSpeechFeedback(null), 2000);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition init failed:', e);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      setSpeechFeedback('Reconnaissance vocale non supportée sur ce navigateur');
      setTimeout(() => setSpeechFeedback(null), 3000);
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      setSpeechFeedback(null);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn('Recognition start error:', e);
        try {
          recognitionRef.current?.abort();
          recognitionRef.current?.start();
        } catch {
          // ignore
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = input.trim();
    if (!clean || isLoading) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    setIsLoading(true);
    try {
      const parsed = await callAiNaturalParse(clean, categories);
      onTaskCreated({ ...parsed, title: parsed.title || clean, status: 'todo' });
      setInput('');
      setSpeechFeedback(null);
    } catch (err) {
      console.error('Error creating task from natural text:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-1.5">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`relative flex items-center rounded-2xl transition-all ${
            isListening
              ? 'ring-2 ring-rose-500/50 shadow-lg shadow-rose-500/10'
              : 'focus-within:ring-2 focus-within:ring-indigo-500/30'
          }`}
        >
          <div className="absolute left-3.5 text-indigo-500">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isListening ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            ) : (
              <Sparkles className="w-4 h-4 animate-pulse" />
            )}
          </div>

          <input
            id="quick-add"
            type="text"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isListening
                ? '🎙️ Parlez maintenant... (ex: "Préparer la présentation pour demain 10h urgent")'
                : "✨ Ajout rapide : « Appeler Paul demain 14h30 !! #client @Travail 20min »  (Q)"
            }
            disabled={isLoading}
            className={`w-full pl-10 pr-32 py-3 bg-white dark:bg-zinc-900 border ${
              isListening
                ? 'border-rose-500/60 bg-rose-50/20 dark:bg-rose-950/20'
                : 'border-zinc-200 dark:border-zinc-800'
            } rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500 transition-all shadow-sm`}
          />

          {/* Action buttons inside bar */}
          <div className="absolute right-2 flex items-center gap-1.5">
            {/* Voice Command Button (Web Speech API) */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={isLoading}
              title={
                !speechSupported
                  ? 'Reconnaissance vocale non supportée sur ce navigateur'
                  : isListening
                  ? 'Arrêter l\'écoute vocale'
                  : 'Créer une tâche par commande vocale (Web Speech API)'
              }
              className={`p-2 rounded-xl transition-all ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                  : speechSupported
                  ? 'text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  : 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
              }`}
            >
              {isListening ? (
                <Mic className="w-4 h-4 animate-bounce" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white font-medium text-xs flex items-center gap-1 transition-all shadow-sm"
            >
              <span>Créer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>

      {/* Aperçu de l'analyse */}
      {preview && !speechFeedback && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-200 truncate max-w-[16rem]">{preview.title}</span>
          {preview.dueDate && (
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">📅 {formatDue(preview.dueDate)}</span>
          )}
          {PRIORITY_CHIP[preview.priority] && (
            <span className={`px-1.5 py-0.5 rounded-md border ${PRIORITY_CHIP[preview.priority][1]}`}>{PRIORITY_CHIP[preview.priority][0]}</span>
          )}
          {preview.category && <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">{preview.category}</span>}
          {preview.estimatedMinutes !== 30 && <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">⏱ {preview.estimatedMinutes} min</span>}
          {preview.tags.map(tag => <span key={tag} className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">#{tag}</span>)}
        </div>
      )}

      {/* Voice status feedback pill */}
      {speechFeedback && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-[11px] text-zinc-600 dark:text-zinc-300 w-fit animate-in fade-in duration-150">
          {isListening ? (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          ) : (
            <AlertCircle className="w-3 h-3 text-amber-500" />
          )}
          <span>{speechFeedback}</span>
        </div>
      )}
    </div>
  );
};
