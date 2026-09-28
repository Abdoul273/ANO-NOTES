import React, { useState } from 'react';
import { Sparkles, Sun, ChevronRight, X, RefreshCw, Target, Zap } from 'lucide-react';
import { DailyBriefing } from '../types';
import { localDateKey } from '../utils/dates';

const HIDDEN_KEY = 'auratask_briefing_hidden_v1';

interface DailyBriefingBannerProps {
  briefing: DailyBriefing | null;
  onRefreshBriefing: () => void;
  isLoading: boolean;
  onSelectFrogTask?: (taskTitle: string) => void;
}

export const DailyBriefingBanner: React.FC<DailyBriefingBannerProps> = ({
  briefing,
  onRefreshBriefing,
  isLoading,
  onSelectFrogTask,
}) => {
  // Masqué jusqu'au lendemain
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(HIDDEN_KEY) === localDateKey(new Date()));
  const dismiss = () => {
    localStorage.setItem(HIDDEN_KEY, localDateKey(new Date()));
    setDismissed(true);
  };

  if (dismissed || !briefing) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-zinc-900/40 border border-indigo-500/20 backdrop-blur-md shadow-lg shadow-indigo-500/5 mb-6">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Briefing Quotidien IA • Coach Productivité
            </span>
          </div>

          <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
            {briefing.greeting}
          </h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <strong>Priorité Clé (Eat The Frog) :</strong>{' '}
              <button
                type="button"
                onClick={() => onSelectFrogTask?.(briefing.highlightFrog)}
                title="Démarrer une session Focus sur cette tâche"
                className="underline decoration-indigo-400/50 underline-offset-2 hover:text-indigo-500 text-left"
              >
                {briefing.highlightFrog}
              </button>
            </span>
            <span className="hidden sm:inline text-zinc-500 dark:text-zinc-500">•</span>
            <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              {briefing.energyAdvice}
            </span>
          </div>

          {briefing.motivationalQuote && (
            <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500 pt-1">
              « {briefing.motivationalQuote} »
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={onRefreshBriefing}
            disabled={isLoading}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700 transition-colors"
            title="Actualiser le briefing avec l'IA"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={dismiss}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700 transition-colors"
            title="Masquer pour la journée"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
