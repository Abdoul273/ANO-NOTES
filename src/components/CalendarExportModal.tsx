import React, { useState } from 'react';
import {
  X,
  Calendar,
  Download,
  Upload,
  Link,
  CheckCircle2,
  Copy,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Task } from '../types';
import { downloadIcsFile, parseIcsFile } from '../utils/export';

interface CalendarExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  syncCode: string;
  onImportTasks: (tasks: Partial<Task>[]) => void;
}

export const CalendarExportModal: React.FC<CalendarExportModalProps> = ({
  isOpen,
  onClose,
  tasks,
  syncCode,
  onImportTasks,
}) => {
  const [copiedFeed, setCopiedFeed] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const calendarFeedUrl = `${origin}/api/calendar/feed.ics?code=${syncCode}`;

  const handleCopyFeed = () => {
    navigator.clipboard.writeText(calendarFeedUrl);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseIcsFile(content);
        if (parsed.length > 0) {
          onImportTasks(parsed);
          alert(`${parsed.length} événements importés avec succès !`);
          onClose();
        } else {
          alert('Aucun événement trouvé dans ce fichier .ics.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 text-zinc-900 dark:text-zinc-100 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                Synchronisation Agenda & Calendrier
              </h3>
              <p className="text-xs text-zinc-400">
                Liez AuraTask avec Google Calendar, Apple Calendar et Outlook
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method 1: Download Standard iCal File */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-zinc-900 dark:text-white">
              1. Téléchargement Fichier .ICS
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-semibold">
              Universel
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Exportez l'ensemble de vos échéances dans un fichier calendrier prêt à être ouvert avec n'importe quelle application.
          </p>
          <button
            onClick={() => downloadIcsFile(tasks)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all mt-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Télécharger l'agenda (.ics)</span>
          </button>
        </div>

        {/* Method 2: Live Subscription Feed URL */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-zinc-900 dark:text-white">
              2. Flux d'Abonnement en Temps Réel
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
              Synchro Auto
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Ajoutez cette URL dans Google Calendar (« Ajouter un calendrier via une URL ») pour une synchronisation automatique en continu.
          </p>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-mono">
            <span className="truncate flex-1 text-zinc-600 dark:text-zinc-300">
              {calendarFeedUrl}
            </span>
            <button
              onClick={handleCopyFeed}
              className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold shrink-0"
            >
              {copiedFeed ? 'Copié !' : 'Copier'}
            </button>
          </div>
        </div>

        {/* Method 3: Import Existing Calendar */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-zinc-900 dark:text-white">
              3. Importer votre Calendrier Existant
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-semibold">
              Rétro-Synchro
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Importez un fichier exporté de Google Agenda ou Outlook (.ics) pour convertir vos rendez-vous en tâches productives.
          </p>
          <label className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-semibold text-xs transition-colors cursor-pointer mt-1">
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span>Sélectionner un fichier .ics</span>
            <input
              type="file"
              accept=".ics,text/calendar"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
