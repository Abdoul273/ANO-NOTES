import React, { useState, useEffect, useRef } from 'react';
import {
  Task,
  UserHabits,
  UserProfile,
  DailyBriefing,
  ViewMode,
  FilterOptions,
  TaskStatus,
} from './types';
import {
  loadTasksFromStorage,
  saveTasksToStorage,
  loadHabitsFromStorage,
  saveHabitsToStorage,
  loadProfileFromStorage,
  saveProfileToStorage,
  loadCategoriesFromStorage,
  saveCategoriesToStorage,
  loadBriefingFromStorage,
  saveBriefingToStorage,
} from './utils/storage';
import { soundManager } from './utils/audio';
import { LocalTaskSync } from './utils/localTaskSync';
import { exportTasksToCSV, exportTasksToPDF } from './utils/export';
import { callAiPrioritize, callAiDailyBriefing } from './utils/ai';
import { makeTask } from './utils/nlp';
import { notify, ensureNotificationPermission } from './utils/platform';
import { isSameLocalDay, formatDue } from './utils/dates';
import { QUADRANT_PRIORITY } from './utils/scoring';

// Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DailyBriefingBanner } from './components/DailyBriefingBanner';
import { NaturalLanguageInput } from './components/NaturalLanguageInput';
import { TaskModal } from './components/TaskModal';
import { HabitsModal } from './components/HabitsModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { CalendarExportModal } from './components/CalendarExportModal';
import { Toaster, toast } from './components/Toaster';

// Views
import { ListView } from './components/views/ListView';
import { KanbanView } from './components/views/KanbanView';
import { CalendarView } from './components/views/CalendarView';
import { EisenhowerMatrixView } from './components/views/EisenhowerMatrixView';
import { FocusZenView } from './components/views/FocusZenView';
import { AnalyticsView } from './components/views/AnalyticsView';

const VIEW_KEY = 'auratask_view_v1';
const DUE_ALERTS_KEY = 'auratask_due_alerts_v1';
const VIEWS: ViewMode[] = ['list', 'kanban', 'calendar', 'matrix', 'focus', 'analytics'];

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('auratask_dark_mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Connectivity
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);

  // App core state
  const [tasks, setTasks] = useState<Task[]>(() => loadTasksFromStorage());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const taskSync = useRef<LocalTaskSync | null>(null);
  const [habits, setHabits] = useState<UserHabits>(() => loadHabitsFromStorage());
  const habitsRef = useRef(habits);
  habitsRef.current = habits;
  const [profile, setProfile] = useState<UserProfile>(() => loadProfileFromStorage());
  const [categories, setCategories] = useState(() => loadCategoriesFromStorage());
  const [briefing, setBriefing] = useState<DailyBriefing | null>(() => loadBriefingFromStorage());

  // Navigation & filters
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_KEY) as ViewMode | null;
    return stored && VIEWS.includes(stored) ? stored : 'list';
  });
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    category: '',
    priority: '',
    status: '',
    tag: '',
    viewTab: 'all',
  });

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskDefaults, setTaskDefaults] = useState<Partial<Task> | null>(null);
  const [isHabitsModalOpen, setIsHabitsModalOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isCalendarExportModalOpen, setIsCalendarExportModalOpen] = useState(false);
  const anyModalOpen = isTaskModalOpen || isHabitsModalOpen || isCloudSyncModalOpen || isCalendarExportModalOpen;

  // Focus view direct target
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  // Loading states
  const [isAiPrioritizing, setIsAiPrioritizing] = useState(false);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);

  // Sync theme with HTML root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('auratask_dark_mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, viewMode);
  }, [viewMode]);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Migrate browser tasks once, then share every change with the Caelestia panel (Super+Shift+T).
  useEffect(() => {
    const sync = new LocalTaskSync(setTasks);
    taskSync.current = sync;
    void sync.start(tasksRef.current);
    return () => { sync.stop(); taskSync.current = null; };
  }, []);

  // Keep a browser copy for offline use while the local shared store is unavailable.
  useEffect(() => {
    saveTasksToStorage(tasks);
    taskSync.current?.queue(tasks);
  }, [tasks]);

  useEffect(() => {
    saveHabitsToStorage(habits);
    soundManager.enabled = habits.soundEnabled;
  }, [habits]);

  useEffect(() => {
    saveProfileToStorage(profile);
  }, [profile]);

  useEffect(() => {
    saveCategoriesToStorage(categories);
  }, [categories]);

  useEffect(() => {
    if (habits.notificationsEnabled) void ensureNotificationPermission();
  }, [habits.notificationsEnabled]);

  // Rappels personnalisés et alertes d'échéance. Un rappel manqué pendant que
  // l'app était fermée est tout de même signalé (dans les 12 h).
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const { soundEnabled, notificationsEnabled } = habitsRef.current;
      const alert = (title: string, body: string) => {
        if (soundEnabled) soundManager.playReminder();
        if (notificationsEnabled) void notify(title, body);
        toast(`${title} — ${body}`, { tone: 'info', duration: 8000 });
      };

      // Effets hors du setState (StrictMode rejoue les updaters).
      const fired = new Set<string>();
      for (const task of tasksRef.current) {
        if (task.completed) continue;
        for (const rem of task.smartReminders || []) {
          const at = new Date(rem.time).getTime();
          if (rem.triggered || isNaN(at) || at > now) continue;
          fired.add(`${task.id}|${rem.id}`);
          if (now - at < 12 * 3600000) alert(`⏰ ${rem.label}`, `${task.title}${rem.reason ? ` · ${rem.reason}` : ''}`);
        }
      }
      if (fired.size) {
        const hit = (task: Task, r: { id: string }) => fired.has(`${task.id}|${r.id}`);
        setTasks(prev => prev.map(task => task.smartReminders?.some(r => hit(task, r))
          ? { ...task, smartReminders: task.smartReminders.map(r => (hit(task, r) ? { ...r, triggered: true, notified: true } : r)) }
          : task));
      }

      // Échéances : une alerte 15 min avant, et une à l'heure dite (hors tâches « toute la journée »).
      const sent: Record<string, number> = readJson(DUE_ALERTS_KEY, {});
      let dirty = false;
      for (const task of tasksRef.current) {
        if (task.completed || !task.dueDate) continue;
        const at = new Date(task.dueDate).getTime();
        const d = new Date(at);
        if (d.getHours() === 23 && d.getMinutes() === 59) continue;
        for (const [key, when, title] of [
          [`${task.id}|${task.dueDate}|soon`, at - 15 * 60000, '⏳ Échéance dans 15 min'],
          [`${task.id}|${task.dueDate}|now`, at, '🔔 Échéance atteinte'],
        ] as const) {
          if (sent[key] || now < when || now - when > 30 * 60000) continue;
          sent[key] = now;
          dirty = true;
          alert(title, task.title);
        }
      }
      if (dirty) {
        for (const [key, time] of Object.entries(sent)) if (now - time > 7 * 86400000) delete sent[key];
        localStorage.setItem(DUE_ALERTS_KEY, JSON.stringify(sent));
      }
    };
    const first = setTimeout(check, 3000);
    const interval = setInterval(check, 20000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);

  const refreshBriefing = async () => {
    setIsBriefingLoading(true);
    try {
      const current = tasksRef.current;
      const completedToday = current.filter(t => t.completed && t.completedAt && isSameLocalDay(t.completedAt)).length;
      const res = await callAiDailyBriefing(current, habitsRef.current, completedToday);
      setBriefing(res);
      saveBriefingToStorage(res);
    } catch (err) {
      console.error('Error fetching briefing:', err);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // Un briefing par jour, calculé une fois les tâches partagées chargées.
  useEffect(() => {
    if (briefing?.generatedAt && isSameLocalDay(briefing.generatedAt)) return;
    const timer = setTimeout(() => { void refreshBriefing(); }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Trigger full AI task prioritization
  const handleTriggerAiPrioritize = async () => {
    setIsAiPrioritizing(true);
    try {
      const res = await callAiPrioritize(tasksRef.current.filter(t => !t.completed), habits);
      if (res.prioritizations?.length) {
        const map = new Map(res.prioritizations.map((p: any) => [p.taskId, p]));
        setTasks(prev => prev.map(t => {
          const p = map.get(t.id);
          if (!p) return t;
          return {
            ...t,
            priority: ['urgent', 'high', 'medium', 'low'].includes(p.suggestedPriority) ? p.suggestedPriority : t.priority,
            aiUrgencyScore: typeof p.newPriorityScore === 'number' ? Math.round(p.newPriorityScore) : t.aiUrgencyScore,
            aiQuadrant: p.quadrant || t.aiQuadrant,
            aiSlotRecommendation: p.suggestedSlot || t.aiSlotRecommendation,
            aiReasoning: p.reasoning || t.aiReasoning,
          };
        }));
        soundManager.playTaskComplete();
        toast(res.overallAnalysis || `${res.prioritizations.length} tâche(s) repriorisée(s).`, { duration: 6000 });
      } else {
        toast('Aucune tâche en cours à prioriser.', { tone: 'info' });
      }
    } catch (err) {
      console.error('AI prioritize error:', err);
      toast('La priorisation a échoué.', { tone: 'error' });
    } finally {
      setIsAiPrioritizing(false);
    }
  };

  const openNewTask = (defaults: Partial<Task> | null = null) => {
    setTaskToEdit(null);
    setTaskDefaults(defaults);
    setIsTaskModalOpen(true);
  };

  const openTask = (task: Task) => {
    setTaskToEdit(task);
    setTaskDefaults(null);
    setIsTaskModalOpen(true);
  };

  // Keyboard shortcuts
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcuts.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsTaskModalOpen(false);
      setIsHabitsModalOpen(false);
      setIsCloudSyncModalOpen(false);
      setIsCalendarExportModalOpen(false);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openNewTask();
      return;
    }
    const target = e.target as HTMLElement;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey || anyModalOpen) return;

    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openNewTask();
    } else if (e.key === '/') {
      e.preventDefault();
      setViewMode('list');
      setTimeout(() => document.getElementById('task-search')?.focus(), 0);
    } else if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      document.getElementById('quick-add')?.focus();
    } else if (/^[1-6]$/.test(e.key)) {
      setViewMode(VIEWS[Number(e.key) - 1]);
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => shortcuts.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Task Mutations
  const handleToggleComplete = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const willComplete = !t.completed;
      return {
        ...t,
        completed: willComplete,
        status: willComplete ? 'done' : 'todo',
        completedAt: willComplete ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
    }));
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const isDone = newStatus === 'done';
      return {
        ...t,
        status: newStatus,
        completed: isDone,
        completedAt: isDone ? (t.completedAt || new Date().toISOString()) : null,
        updatedAt: new Date().toISOString(),
      };
    }));
  };

  const handleSaveTask = (savedTask: Task) => {
    setTasks(prev => {
      const exists = prev.some(t => t.id === savedTask.id);
      if (exists) return prev.map(t => (t.id === savedTask.id ? savedTask : t));
      return [savedTask, ...prev];
    });
  };

  const handlePatchTask = (taskId: string, patch: (task: Task) => Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...patch(t), updatedAt: new Date().toISOString() } : t)));
  };

  const handleDeleteTask = (taskId: string) => {
    const index = tasksRef.current.findIndex(t => t.id === taskId);
    const removed = tasksRef.current[index];
    if (!removed) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    toast(`« ${removed.title} » supprimée`, {
      tone: 'info',
      action: {
        label: 'Annuler',
        onClick: () => setTasks(prev => {
          if (prev.some(t => t.id === removed.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        }),
      },
    });
  };

  const handleStartFocus = (task: Task) => {
    setFocusTaskId(task.id);
    setViewMode('focus');
  };

  const handleReorderTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
  };

  const categoryColor = (name?: string) =>
    categories.find((c: { name: string; color: string }) => c.name === name)?.color || '#6366f1';

  const handleTaskCreatedFromInput = (partial: Partial<Task>) => {
    const task = makeTask({ ...partial, color: categoryColor(partial.category) });
    handleSaveTask(task);
    soundManager.playSubtaskCheck();
    toast(`Ajoutée : ${task.title}${task.dueDate ? ` · ${formatDue(task.dueDate)}` : ''}`, {
      action: { label: 'Modifier', onClick: () => openTask(task) },
    });
  };

  // Les imports remplacent une tâche du même identifiant au lieu de la dupliquer.
  const handleImportTasks = (imported: Partial<Task>[]) => {
    const created = imported
      .filter(item => item && typeof item === 'object' && typeof item.title === 'string')
      .map(item => makeTask({ ...item, color: item.color || categoryColor(item.category) }));
    if (!created.length) {
      toast('Aucune tâche valide dans ce fichier.', { tone: 'error' });
      return;
    }
    const ids = new Set(created.map(t => t.id));
    const updated = tasksRef.current.filter(t => ids.has(t.id)).length;
    setTasks(prev => [...created.filter(t => !prev.some(p => p.id === t.id)), ...prev.map(t => created.find(c => c.id === t.id) || t)]);
    toast(`${created.length - updated} tâche(s) importée(s)${updated ? `, ${updated} mise(s) à jour` : ''}.`);
  };

  const handleRestoreCloudBackup = (backupData: any) => {
    const previousTasks = tasksRef.current;
    const previousCategories = categories;
    if (Array.isArray(backupData.tasks)) {
      setTasks(backupData.tasks.filter((t: any) => t && typeof t.title === 'string').map((t: Partial<Task>) => makeTask(t)));
    }
    if (Array.isArray(backupData.categories) && backupData.categories.length) setCategories(backupData.categories);
    toast(`${backupData.tasks?.length ?? 0} tâche(s) restaurée(s).`, {
      action: {
        label: 'Annuler',
        onClick: () => { setTasks(previousTasks); setCategories(previousCategories); },
      },
    });
  };

  const runExport = async (label: string, run: () => Promise<boolean>) => {
    try {
      if (await run()) toast(`${label} enregistré.`);
    } catch (error) {
      console.error(error);
      toast(`Export ${label} impossible.`, { tone: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <Navbar
        isOnline={isOnline}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenNewTaskModal={() => openNewTask()}
        onOpenHabitsModal={() => setIsHabitsModalOpen(true)}
        onOpenCloudSyncModal={() => setIsCloudSyncModalOpen(true)}
        onTriggerAiPrioritize={handleTriggerAiPrioritize}
        isAiPrioritizing={isAiPrioritizing}
        profile={profile}
        habits={habits}
        tasks={tasks}
        onTaskClick={openTask}
        onOpenCalendarExport={() => setIsCalendarExportModalOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        {/* Sidebar */}
        <Sidebar
          viewMode={viewMode}
          setViewMode={setViewMode}
          filters={filters}
          setFilters={setFilters}
          categories={categories}
          tasks={tasks}
          onExportCSV={() => runExport('CSV', () => exportTasksToCSV(tasks))}
          onExportPDF={() => runExport('PDF', () => exportTasksToPDF(tasks))}
        />

        {/* Dynamic Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Natural Language Quick Input Bar */}
          <div className="mb-6">
            <NaturalLanguageInput onTaskCreated={handleTaskCreatedFromInput} categories={categories} />
          </div>

          {/* Daily AI Briefing Banner (collapsible) */}
          <DailyBriefingBanner
            briefing={briefing}
            onRefreshBriefing={refreshBriefing}
            isLoading={isBriefingLoading}
            onSelectFrogTask={(frogTitle) => {
              const needle = frogTitle.toLowerCase();
              const matched = tasks.find(t => !t.completed && (needle.includes(t.title.toLowerCase()) || t.title.toLowerCase().includes(needle)));
              if (matched) handleStartFocus(matched);
            }}
          />

          {/* Active View Rendering */}
          {viewMode === 'list' && (
            <ListView
              tasks={tasks}
              filters={filters}
              setFilters={setFilters}
              onToggleComplete={handleToggleComplete}
              onTaskClick={openTask}
              onDeleteTask={handleDeleteTask}
              onStartFocus={handleStartFocus}
              onReorderTasks={handleReorderTasks}
            />
          )}

          {viewMode === 'kanban' && (
            <KanbanView
              tasks={tasks}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onTaskClick={openTask}
              onOpenNewTaskModal={(initialStatus) => openNewTask(initialStatus ? { status: initialStatus } : null)}
              onDeleteTask={handleDeleteTask}
              onReorderTasks={handleReorderTasks}
            />
          )}

          {viewMode === 'calendar' && (
            <CalendarView
              tasks={tasks}
              onTaskClick={openTask}
              onOpenNewTaskModal={(initialDate) => openNewTask(initialDate ? { dueDate: initialDate } : null)}
              onImportTasks={handleImportTasks}
              onRescheduleTask={(taskId, dateKey) =>
                handlePatchTask(taskId, t => {
                  const due = t.dueDate ? new Date(t.dueDate) : null;
                  const [y, m, d] = dateKey.split('-').map(Number);
                  const next = new Date(y, m - 1, d, due ? due.getHours() : 23, due ? due.getMinutes() : 59, due ? 0 : 59);
                  return { dueDate: next.toISOString() };
                })
              }
              syncCode={profile.syncCode}
            />
          )}

          {viewMode === 'matrix' && (
            <EisenhowerMatrixView
              tasks={tasks}
              onTaskClick={openTask}
              onOpenNewTaskModal={(priority) => openNewTask(priority ? { priority } : null)}
              onMoveTask={(taskId, quadrant) =>
                handlePatchTask(taskId, () => ({ aiQuadrant: quadrant, priority: QUADRANT_PRIORITY[quadrant] }))
              }
              onTriggerAiPrioritize={handleTriggerAiPrioritize}
              isAiPrioritizing={isAiPrioritizing}
            />
          )}

          {viewMode === 'focus' && (
            <FocusZenView
              tasks={tasks}
              userHabits={habits}
              initialTaskId={focusTaskId}
              onAddTimeSpent={(taskId, minutes) =>
                handlePatchTask(taskId, t => ({ timeSpentMinutes: (t.timeSpentMinutes || 0) + minutes }))
              }
              onCompleteTask={(taskId) =>
                handlePatchTask(taskId, () => ({ completed: true, status: 'done', completedAt: new Date().toISOString() }))
              }
              onToggleSubtask={(taskId, subtaskId) =>
                handlePatchTask(taskId, t => ({
                  subtasks: t.subtasks.map(s => (s.id === subtaskId ? { ...s, completed: !s.completed } : s)),
                }))
              }
            />
          )}

          {viewMode === 'analytics' && (
            <AnalyticsView
              tasks={tasks}
              userHabits={habits}
              onImportTasks={handleImportTasks}
            />
          )}
        </main>
      </div>

      {/* Task Creation & Editing Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
          setTaskDefaults(null);
        }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        taskToEdit={taskToEdit}
        defaults={taskDefaults}
        categories={categories}
        userHabits={habits}
      />

      {/* Habits & Productivity Settings Modal */}
      {isHabitsModalOpen && (
        <HabitsModal
          isOpen
          onClose={() => setIsHabitsModalOpen(false)}
          habits={habits}
          onSaveHabits={(updated) => { setHabits(updated); toast('Préférences enregistrées.'); }}
        />
      )}

      {/* Multiplatform Cloud Sync & Backup Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncModalOpen}
        onClose={() => setIsCloudSyncModalOpen(false)}
        profile={profile}
        tasks={tasks}
        categories={categories}
        onRestoreData={handleRestoreCloudBackup}
        onUpdateProfile={(updated) => setProfile(updated)}
      />

      {/* Calendar Export & Sync Modal */}
      <CalendarExportModal
        isOpen={isCalendarExportModalOpen}
        onClose={() => setIsCalendarExportModalOpen(false)}
        tasks={tasks}
        syncCode={profile.syncCode}
        onImportTasks={handleImportTasks}
      />

      <Toaster />
    </div>
  );
}
