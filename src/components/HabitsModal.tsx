import React, { useState } from 'react';
import {
  X,
  Sliders,
  Clock,
  Sun,
  Moon,
  Zap,
  Bell,
  Volume2,
  Sparkles,
  Check,
} from 'lucide-react';
import { UserHabits, Chronotype, EnergyPeak } from '../types';

interface HabitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  habits: UserHabits;
  onSaveHabits: (updated: UserHabits) => void;
}

export const HabitsModal: React.FC<HabitsModalProps> = ({
  isOpen,
  onClose,
  habits,
  onSaveHabits,
}) => {
  const [workHoursStart, setWorkHoursStart] = useState(habits.workHoursStart || '08:30');
  const [workHoursEnd, setWorkHoursEnd] = useState(habits.workHoursEnd || '18:00');
  const [energyPeak, setEnergyPeak] = useState<EnergyPeak>(habits.energyPeak || 'matin');
  const [chronotype, setChronotype] = useState<Chronotype>(habits.chronotype || 'alouette');
  const [focusDuration, setFocusDuration] = useState(habits.focusDuration || 25);
  const [breakDuration, setBreakDuration] = useState(habits.breakDuration || 5);
  const [notificationsEnabled, setNotificationsEnabled] = useState(habits.notificationsEnabled ?? true);
  const [soundEnabled, setSoundEnabled] = useState(habits.soundEnabled ?? true);
  const [autoPrioritize, setAutoPrioritize] = useState(habits.autoPrioritize ?? true);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveHabits({
      workHoursStart,
      workHoursEnd,
      energyPeak,
      chronotype,
      focusDuration: Number(focusDuration),
      breakDuration: Number(breakDuration),
      notificationsEnabled,
      soundEnabled,
      autoPrioritize,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                Habitudes de Travail & Neuro-Productivité
              </h3>
              <p className="text-xs text-zinc-400">
                L'IA adapte vos rappels et priorités selon votre rythme biologique
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

        <form onSubmit={handleSave} className="space-y-4">
          {/* Work Hours Range */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Plage Horaire Active Habituelle
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-zinc-400">Début journée</span>
                <input
                  type="time"
                  value={workHoursStart}
                  onChange={(e) => setWorkHoursStart(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
                />
              </div>
              <div>
                <span className="text-[11px] text-zinc-400">Fin journée</span>
                <input
                  type="time"
                  value={workHoursEnd}
                  onChange={(e) => setWorkHoursEnd(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
                />
              </div>
            </div>
          </div>

          {/* Chronotype & Peak Energy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Pic d'Énergie Optimal
              </label>
              <select
                value={energyPeak}
                onChange={(e) => setEnergyPeak(e.target.value as EnergyPeak)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
              >
                <option value="matin">🌅 Matin (08h - 12h)</option>
                <option value="aprem">☀️ Après-midi (14h - 17h)</option>
                <option value="soir">🌆 Soirée (18h - 21h)</option>
                <option value="nuit">🌙 Nuit (21h+)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Profil Biologique (Chronotype)
              </label>
              <select
                value={chronotype}
                onChange={(e) => setChronotype(e.target.value as Chronotype)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
              >
                <option value="alouette">🐦 Alouette (Lève-tôt)</option>
                <option value="hibou">🦉 Hibou (Couche-tard)</option>
                <option value="regulier">⚡ Équilibré / Régulier</option>
              </select>
            </div>
          </div>

          {/* Pomodoro Focus & Break intervals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Durée Focus Zen (minutes)
              </label>
              <input
                type="number"
                min="10"
                max="90"
                step="5"
                value={focusDuration}
                onChange={(e) => setFocusDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Pause Régénératrice (minutes)
              </label>
              <input
                type="number"
                min="3"
                max="30"
                step="1"
                value={breakDuration}
                onChange={(e) => setBreakDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
              <span className="flex items-center gap-2 text-xs font-medium">
                <Bell className="w-4 h-4 text-indigo-500" />
                Rappels & Notifications Intelligentes
              </span>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
              <span className="flex items-center gap-2 text-xs font-medium">
                <Volume2 className="w-4 h-4 text-emerald-500" />
                Sons de Réussite & Carillon Zen
              </span>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
              <span className="flex items-center gap-2 text-xs font-medium">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Priorisation Automatique en Arrière-Plan
              </span>
              <input
                type="checkbox"
                checked={autoPrioritize}
                onChange={(e) => setAutoPrioritize(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all"
            >
              Enregistrer mes habitudes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
