import React, { useState, useEffect, useCallback } from 'react';
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
import { exportTasksToCSV, exportTasksToPDF } from './utils/export';
import { callAiPrioritize, callAiDailyBriefing } from './utils/ai';

// Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DailyBriefingBanner } from './components/DailyBriefingBanner';
import { NaturalLanguageInput } from './components/NaturalLanguageInput';
import { TaskModal } from './components/TaskModal';
import { HabitsModal } from './components/HabitsModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { CalendarExportModal } from './components/CalendarExportModal';

// Views
import { ListView } from './components/views/ListView';
import { KanbanView } from './components/views/KanbanView';
import { CalendarView } from './components/views/CalendarView';
import { EisenhowerMatrixView } from './components/views/EisenhowerMatrixView';
import { FocusZenView } from './components/views/FocusZenView';
import { AnalyticsView } from './components/views/AnalyticsView';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auratask_dark_mode');
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Connectivity
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  // App core state
  const [tasks, setTasks] = useState<Task[]>(() => loadTasksFromStorage());
  const [habits, setHabits] = useState<UserHabits>(() => loadHabitsFromStorage());
  const [profile, setProfile] = useState<UserProfile>(() => loadProfileFromStorage());
  const [categories, setCategories] = useState(() => loadCategoriesFromStorage());
  const [briefing, setBriefing] = useState<DailyBriefing | null>(() => loadBriefingFromStorage());

  // Navigation & filters
  const [viewMode, setViewMode] = useState<ViewMode>('list');
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
  const [isHabitsModalOpen, setIsHabitsModalOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isCalendarExportModalOpen, setIsCalendarExportModalOpen] = useState(false);

  // Focus view direct target
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  // Loading states
  const [isAiPrioritizing, setIsAiPrioritizing] = useState(false);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);

  // Sync theme with HTML root
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('auratask_dark_mode', String(darkMode));
  }, [darkMode]);

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

  // Sync storage on task state change
  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  useEffect(() => {
    saveHabitsToStorage(habits);
  }, [habits]);

  useEffect(() => {
    saveProfileToStorage(profile);
  }, [profile]);

  useEffect(() => {
    saveCategoriesToStorage(categories);
  }, [categories]);

  // Request browser notification permissions if enabled
  useEffect(() => {
    if (habits.notificationsEnabled && typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [habits.notificationsEnabled]);

  // Periodic Smart Reminders & Deadline alert loop
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = Date.now();
      setTasks((prevTasks) => {
        let changed = false;
        const updated = prevTasks.map((task) => {
          if (task.completed || !task.smartReminders) return task;

          const updatedReminders = task.smartReminders.map((rem) => {
            const remTime = new Date(rem.time).getTime();
            // Trigger if within 1 minute of time and not yet triggered
            if (!rem.triggered && Math.abs(now - remTime) < 60000) {
              changed = true;
              if (habits.soundEnabled) soundManager.playReminder();

              if (habits.notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(`AuraTask : ${rem.label}`, {
                  body: `${task.title} • ${rem.reason || 'Moment optimal pour exécuter cette tâche'}`,
                  icon: '/favicon.ico',
                });
              }
              return { ...rem, triggered: true, notified: true };
            }
            return rem;
          });

          return { ...task, smartReminders: updatedReminders };
        });

        return changed ? updated : prevTasks;
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [habits]);

  // Initial AI Daily Briefing fetch
  useEffect(() => {
    if (!briefing && tasks.length > 0) {
      refreshBriefing();
    }
  }, []);

  const refreshBriefing = async () => {
    setIsBriefingLoading(true);
    try {
      const completedToday = tasks.filter(
        (t) => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()
      ).length;
      const res = await callAiDailyBriefing(tasks, habits, completedToday);
      setBriefing(res);
      saveBriefingToStorage(res);
    } catch (err) {
      console.error('Error fetching briefing:', err);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  // Trigger full AI task prioritization
  const handleTriggerAiPrioritize = async () => {
    setIsAiPrioritizing(true);
    try {
      const res = await callAiPrioritize(tasks, habits);
      if (res.prioritizations && res.prioritizations.length > 0) {
        setTasks((prevTasks) => {
          const map = new Map(res.prioritizations.map((p: any) => [p.taskId, p]));
          return prevTasks.map((t) => {
            const p = map.get(t.id);
            if (!p) return t;
            return {
              ...t,
              priority: (p.suggestedPriority as any) || t.priority,
              aiUrgencyScore: p.newPriorityScore || t.aiUrgencyScore,
              aiQuadrant: p.quadrant || t.aiQuadrant,
              aiSlotRecommendation: p.suggestedSlot || t.aiSlotRecommendation,
              aiReasoning: p.reasoning || t.aiReasoning,
            };
          });
        });
        soundManager.playTaskComplete();
      }
    } catch (err) {
      console.error('AI prioritize error:', err);
    } finally {
      setIsAiPrioritizing(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when focused on input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setTaskToEdit(null);
        setIsTaskModalOpen(true);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setTaskToEdit(null);
        setIsTaskModalOpen(true);
      } else if (e.key === 'Escape') {
        setIsTaskModalOpen(false);
        setIsHabitsModalOpen(false);
        setIsCloudSyncModalOpen(false);
        setIsCalendarExportModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Task Mutations
  const handleToggleComplete = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const willComplete = !t.completed;
        return {
          ...t,
          completed: willComplete,
          status: willComplete ? 'done' : 'todo',
          completedAt: willComplete ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const isDone = newStatus === 'done';
        return {
          ...t,
          status: newStatus,
          completed: isDone,
          completedAt: isDone ? (t.completedAt || new Date().toISOString()) : null,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleSaveTask = (savedTask: Task) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === savedTask.id);
      if (exists) {
        return prev.map((t) => (t.id === savedTask.id ? savedTask : t));
      }
      return [savedTask, ...prev];
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleStartFocus = (task: Task) => {
    setFocusTask(task);
    setViewMode('focus');
  };

  const handleReorderTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
  };

  const handleTaskCreatedFromInput = (partial: Partial<Task>) => {
    const newTask: Task = {
      id: 'task_' + Date.now(),
      title: partial.title || 'Nouvelle tâche',
      description: partial.description || '',
      priority: partial.priority || 'medium',
      status: partial.status || 'todo',
      category: partial.category || 'Travail',
      dueDate: partial.dueDate || null,
      estimatedMinutes: partial.estimatedMinutes || 30,
      timeSpentMinutes: 0,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: partial.tags || [],
      subtasks: partial.subtasks || [],
      smartReminders: partial.smartReminders || [],
      color: '#6366f1',
      aiUrgencyScore: partial.priority === 'urgent' ? 90 : 50,
      aiQuadrant: partial.priority === 'urgent' ? 'q1_urgent_important' : 'q2_not_urgent_important',
    };
    handleSaveTask(newTask);
    soundManager.playReminder();
  };

  const handleImportTasks = (imported: Partial<Task>[]) => {
    const created: Task[] = imported.map((item, idx) => ({
      id: item.id || `imp_${Date.now()}_${idx}`,
      title: item.title || 'Tâche importée',
      description: item.description || '',
      priority: item.priority || 'medium',
      status: item.status || 'todo',
      category: item.category || 'Importé',
      dueDate: item.dueDate || null,
      estimatedMinutes: item.estimatedMinutes || 30,
      timeSpentMinutes: item.timeSpentMinutes || 0,
      completed: !!item.completed,
      completedAt: item.completedAt || null,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: item.tags || ['Calendrier'],
      subtasks: item.subtasks || [],
      smartReminders: item.smartReminders || [],
      color: '#8b5cf6',
      aiUrgencyScore: 60,
    }));

    setTasks((prev) => [...created, ...prev]);
  };

  const handleRestoreCloudBackup = (backupData: any) => {
    if (backupData.tasks && Array.isArray(backupData.tasks)) {
      setTasks(backupData.tasks);
    }
    if (backupData.categories && Array.isArray(backupData.categories)) {
      setCategories(backupData.categories);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <Navbar
        isOnline={isOnline}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenNewTaskModal={() => {
          setTaskToEdit(null);
          setIsTaskModalOpen(true);
        }}
        onOpenHabitsModal={() => setIsHabitsModalOpen(true)}
        onOpenCloudSyncModal={() => setIsCloudSyncModalOpen(true)}
        onTriggerAiPrioritize={handleTriggerAiPrioritize}
        isAiPrioritizing={isAiPrioritizing}
        profile={profile}
        habits={habits}
        tasks={tasks}
        onTaskClick={(t) => {
          setTaskToEdit(t);
          setIsTaskModalOpen(true);
        }}
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
          onExportCSV={() => exportTasksToCSV(tasks)}
          onExportPDF={() => exportTasksToPDF(tasks)}
        />

        {/* Dynamic Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Natural Language Quick Input Bar */}
          <div className="mb-6">
            <NaturalLanguageInput onTaskCreated={handleTaskCreatedFromInput} />
          </div>

          {/* Daily AI Briefing Banner (collapsible) */}
          <DailyBriefingBanner
            briefing={briefing}
            onRefreshBriefing={refreshBriefing}
            isLoading={isBriefingLoading}
            onSelectFrogTask={(frogTitle) => {
              const matched = tasks.find((t) => t.title.toLowerCase().includes(frogTitle.toLowerCase()));
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
              onTaskClick={(t) => {
                setTaskToEdit(t);
                setIsTaskModalOpen(true);
              }}
              onDeleteTask={handleDeleteTask}
              onStartFocus={handleStartFocus}
              onReorderTasks={handleReorderTasks}
            />
          )}

          {viewMode === 'kanban' && (
            <KanbanView
              tasks={tasks}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onTaskClick={(t) => {
                setTaskToEdit(t);
                setIsTaskModalOpen(true);
              }}
              onOpenNewTaskModal={(initialStatus) => {
                setTaskToEdit(null);
                setIsTaskModalOpen(true);
              }}
              onDeleteTask={handleDeleteTask}
              onReorderTasks={handleReorderTasks}
            />
          )}

          {viewMode === 'calendar' && (
            <CalendarView
              tasks={tasks}
              onTaskClick={(t) => {
                setTaskToEdit(t);
                setIsTaskModalOpen(true);
              }}
              onOpenNewTaskModal={(initialDate) => {
                setTaskToEdit(null);
                setIsTaskModalOpen(true);
              }}
              onImportTasks={handleImportTasks}
              syncCode={profile.syncCode}
            />
          )}

          {viewMode === 'matrix' && (
            <EisenhowerMatrixView
              tasks={tasks}
              onTaskClick={(t) => {
                setTaskToEdit(t);
                setIsTaskModalOpen(true);
              }}
              onOpenNewTaskModal={() => {
                setTaskToEdit(null);
                setIsTaskModalOpen(true);
              }}
              onTriggerAiPrioritize={handleTriggerAiPrioritize}
              isAiPrioritizing={isAiPrioritizing}
            />
          )}

          {viewMode === 'focus' && (
            <FocusZenView
              tasks={tasks}
              userHabits={habits}
              onUpdateTask={handleSaveTask}
              initialTask={focusTask}
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
        }}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        categories={categories}
        userHabits={habits}
      />

      {/* Habits & Productivity Settings Modal */}
      <HabitsModal
        isOpen={isHabitsModalOpen}
        onClose={() => setIsHabitsModalOpen(false)}
        habits={habits}
        onSaveHabits={(updated) => setHabits(updated)}
      />

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
    </div>
  );
}
