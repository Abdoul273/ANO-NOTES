import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Moon,
  Sun,
  Cloud,
  CloudOff,
  Bell,
  RefreshCw,
  Sliders,
  Share2,
  Calendar as CalendarIcon,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { UserProfile, UserHabits, SmartReminder, Task } from '../types';
import { isOverdue } from '../utils/scoring';
import { formatDue } from '../utils/dates';

interface NavbarProps {
  isOnline: boolean;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onOpenNewTaskModal: () => void;
  onOpenHabitsModal: () => void;
  onOpenCloudSyncModal: () => void;
  onTriggerAiPrioritize: () => void;
  isAiPrioritizing: boolean;
  profile: UserProfile;
  habits: UserHabits;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onOpenCalendarExport: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isOnline,
  darkMode,
  toggleDarkMode,
  onOpenNewTaskModal,
  onOpenHabitsModal,
  onOpenCloudSyncModal,
  onTriggerAiPrioritize,
  isAiPrioritizing,
  profile,
  habits,
  tasks,
  onTaskClick,
  onOpenCalendarExport,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  // Rappels à venir dans les 24 h, ou déclenchés depuis moins de 2 h ; plus les tâches en retard.
  const now = Date.now();
  const activeReminders: { task: Task; reminder: SmartReminder }[] = [];
  tasks.forEach(t => {
    if (t.completed) return;
    t.smartReminders?.forEach(r => {
      const rTime = new Date(r.time).getTime();
      if (isNaN(rTime)) return;
      const upcoming = !r.triggered && rTime >= now && rTime - now < 24 * 3600000;
      const recent = rTime <= now && now - rTime < 2 * 3600000;
      if (upcoming || recent) activeReminders.push({ task: t, reminder: r });
    });
  });
  activeReminders.sort((a, b) => new Date(a.reminder.time).getTime() - new Date(b.reminder.time).getTime());
  const overdueTasks = tasks.filter(t => isOverdue(t, now));
  const badge = activeReminders.filter(({ reminder }) => new Date(reminder.time).getTime() <= now).length + overdueTasks.length;

  useEffect(() => {
    if (!showNotifications) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-notifications]')) setShowNotifications(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showNotifications]);

  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors bg-white/80 dark:bg-zinc-950/80 border-zinc-200 dark:border-zinc-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-xl tracking-tight">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">
                AuraTask <span className="text-xs uppercase px-1.5 py-0.5 rounded font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">AI</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium hidden sm:block">
              Gestion de Tâches & Productivité Optimisée
            </p>
          </div>
        </div>

        {/* Status Pills & Smart Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline / Online Status */}
          <div
            title={isOnline ? 'Connecté aux services cloud et IA' : 'Mode hors-ligne actif (Données sécurisées localement)'}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isOnline ? 'En ligne' : 'Hors-ligne'}</span>
          </div>

          {/* AI Prioritize Button */}
          <button
            onClick={onTriggerAiPrioritize}
            disabled={isAiPrioritizing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm disabled:opacity-50"
            title="Analyser et prioriser automatiquement mes urgences avec l'IA"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiPrioritizing ? 'animate-spin text-purple-400' : 'text-indigo-500'}`} />
            <span className="hidden sm:inline">
              {isAiPrioritizing ? 'Priorisation en cours...' : 'Optimiser avec l\'IA'}
            </span>
            <span className="sm:hidden">IA</span>
          </button>

          {/* Calendar Sync Quick Action */}
          <button
            onClick={onOpenCalendarExport}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 transition-colors"
            title="Synchronisation Agenda & Calendrier (Google Calendar, iCal, Outlook)"
          >
            <CalendarIcon className="w-4 h-4" />
          </button>

          {/* Notifications Popover Trigger */}
          <div className="relative" data-notifications>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 transition-colors"
              title="Notifications & Rappels Intelligents"
            >
              <Bell className="w-4 h-4" />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>

            {/* Notifications Menu */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 z-50">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-sm text-zinc-900 dark:text-white">Rappels Intelligents</span>
                  </div>
                  <span className="text-xs text-zinc-400">{activeReminders.length + overdueTasks.length} élément(s)</span>
                </div>

                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                  {overdueTasks.slice(0, 5).map(task => (
                    <div
                      key={`overdue-${task.id}`}
                      onClick={() => { onTaskClick(task); setShowNotifications(false); }}
                      className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 border border-rose-500/20 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200 line-clamp-1">{task.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-semibold shrink-0">En retard</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Échéance : {formatDue(task.dueDate!)}</p>
                    </div>
                  ))}
                  {activeReminders.length === 0 && overdueTasks.length === 0 ? (
                    <div className="text-center py-6 text-zinc-400 text-xs">
                      Aucun rappel en attente. Tout est sous contrôle !
                    </div>
                  ) : (
                    activeReminders.map(({ task, reminder }) => (
                      <div
                        key={reminder.id}
                        onClick={() => {
                          onTaskClick(task);
                          setShowNotifications(false);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-indigo-50/50 dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200 line-clamp-1">
                            {task.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-semibold shrink-0">
                            {formatDue(reminder.time)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                          {reminder.label} {reminder.reason ? `• ${reminder.reason}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cloud Sync Status & Multiplatform link */}
          <button
            onClick={onOpenCloudSyncModal}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 transition-colors"
            title="Sauvegarde Cloud Sécurisée & Synchronisation Multiplateforme"
          >
            <Cloud className="w-4 h-4 text-sky-500" />
          </button>

          {/* User Habits & Settings */}
          <button
            onClick={onOpenHabitsModal}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 transition-colors"
            title="Habitudes de travail & Configuration Productivité"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 transition-colors"
            title={darkMode ? 'Basculer en mode clair' : 'Basculer en mode sombre'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Add Task Primary CTA */}
          <button
            onClick={onOpenNewTaskModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle Tâche</span>
          </button>
        </div>
      </div>
    </header>
  );
};
