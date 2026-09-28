import React, { useState } from 'react';
import { Task, FilterOptions } from '../../types';
import { TaskItem } from '../TaskItem';
import {
  ListFilter,
  ArrowUpDown,
  Search,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Sparkles,
  Inbox,
  GripVertical,
  Check,
} from 'lucide-react';
import { soundManager } from '../../utils/audio';
import { urgencyScore, isOverdue, isUrgentNow } from '../../utils/scoring';
import { isSameLocalDay } from '../../utils/dates';

const SORT_KEY = 'auratask_list_sort_v1';

interface ListViewProps {
  tasks: Task[];
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  onToggleComplete: (taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onStartFocus: (task: Task) => void;
  onReorderTasks?: (newTasks: Task[]) => void;
}

export const ListView: React.FC<ListViewProps> = ({
  tasks,
  filters,
  setFilters,
  onToggleComplete,
  onTaskClick,
  onDeleteTask,
  onStartFocus,
  onReorderTasks,
}) => {
  const [sortBy, setSortByState] = useState<'ai' | 'custom' | 'priority' | 'date'>(
    () => (localStorage.getItem(SORT_KEY) as 'ai' | 'custom' | 'priority' | 'date') || 'ai'
  );
  const setSortBy = (value: typeof sortBy) => {
    setSortByState(value);
    localStorage.setItem(SORT_KEY, value);
  };
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);
  const [reorderNotification, setReorderNotification] = useState<string | null>(null);

  // Filter tasks
  const filtered = tasks.filter((t) => {
    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchTag = t.tags?.some((tag) => tag.toLowerCase().includes(q.replace(/^#/, '')));
      const matchSub = t.subtasks?.some((st) => st.title.toLowerCase().includes(q));
      const matchCat = t.category?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchTag && !matchSub && !matchCat) return false;
    }

    // Category
    if (filters.category && t.category !== filters.category) return false;

    // View tab
    if (filters.viewTab === 'today') {
      if (t.completed) return false;
      // Aujourd'hui = échéance du jour, ou en retard (encore à faire aujourd'hui)
      if (!t.dueDate) return false;
      if (!isSameLocalDay(t.dueDate) && !isOverdue(t)) return false;
    } else if (filters.viewTab === 'overdue') {
      if (!isOverdue(t)) return false;
    } else if (filters.viewTab === 'ai_prioritized') {
      if (!isUrgentNow(t)) return false;
    } else if (filters.viewTab === 'upcoming') {
      if (t.completed) return false;
      if (isOverdue(t)) return false;
    } else if (filters.viewTab === 'completed') {
      if (!t.completed) return false;
    }

    // Priority filter
    if (filters.priority && t.priority !== filters.priority) return false;

    return true;
  });

  // Sort tasks
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'custom') {
      // Preserve current array ordering
      return 0;
    }
    if (sortBy === 'ai') {
      return urgencyScore(b) - urgencyScore(a);
    }
    if (sortBy === 'priority') {
      const pMap: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (pMap[b.priority] || 0) - (pMap[a.priority] || 0) || urgencyScore(b) - urgencyScore(a);
    }
    if (sortBy === 'date') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  });

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDropPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const pos: 'top' | 'bottom' = offset < rect.height / 2 ? 'top' : 'bottom';

    if (dragOverTaskId !== targetTask.id || dropPosition !== pos) {
      setDragOverTaskId(targetTask.id);
      setDropPosition(pos);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!sourceId || sourceId === targetTask.id) {
      handleDragEnd();
      return;
    }

    const currentPos = dropPosition || 'bottom';
    const newTasks = [...tasks];
    const sourceIdx = newTasks.findIndex((t) => t.id === sourceId);
    if (sourceIdx === -1) {
      handleDragEnd();
      return;
    }

    const [movedTask] = newTasks.splice(sourceIdx, 1);
    const targetIdx = newTasks.findIndex((t) => t.id === targetTask.id);

    if (targetIdx === -1) {
      newTasks.push(movedTask);
    } else {
      const insertAt = currentPos === 'bottom' ? targetIdx + 1 : targetIdx;
      newTasks.splice(insertAt, 0, movedTask);
    }

    onReorderTasks?.(newTasks);
    setSortBy('custom');
    soundManager.playSubtaskCheck();
    setReorderNotification(`« ${movedTask.title.slice(0, 28)}${movedTask.title.length > 28 ? '...' : ''} » réorganisée avec succès !`);
    setTimeout(() => setReorderNotification(null), 3000);
    handleDragEnd();
  };

  // Groupings for intuitive visual clarity when not purely in custom manual mode:
  const isCustomMode = sortBy === 'custom';
  const urgentGroup = sorted.filter(t => isUrgentNow(t));
  const todayGroup = sorted.filter(t => !t.completed && t.dueDate && isSameLocalDay(t.dueDate) && !urgentGroup.includes(t));
  const upcomingGroup = sorted.filter(t => !t.completed && !urgentGroup.includes(t) && !todayGroup.includes(t));
  const completedGroup = sorted.filter(t => t.completed);

  return (
    <div className="space-y-5">
      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="task-search"
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Rechercher une tâche, un tag, une sous-tâche…  ( / )"
            onKeyDown={(e) => { if (e.key === 'Escape') { setFilters((prev) => ({ ...prev, search: '' })); (e.target as HTMLInputElement).blur(); } }}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-400 font-medium hidden md:inline">Trier par :</span>
          <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setSortBy('ai')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'ai'
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              title="Priorisation intelligente par l'IA"
            >
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Score IA</span>
            </button>
            <button
              onClick={() => setSortBy('custom')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'custom'
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              title="Ordre personnalisé manuel par glisser-déposer"
            >
              <GripVertical className="w-3 h-3 text-indigo-500" />
              <span>Manuel (Glisser)</span>
            </button>
            <button
              onClick={() => setSortBy('priority')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'priority'
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Priorité
            </button>
            <button
              onClick={() => setSortBy('date')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                sortBy === 'date'
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Échéance
            </button>
          </div>
        </div>
      </div>

      {/* Floating feedback for drag-and-drop reorder */}
      {reorderNotification && (
        <div className="flex items-center gap-2 p-2.5 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
          <Check className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>{reorderNotification}</span>
        </div>
      )}

      {/* Empty State */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40">
          <Inbox className="w-12 h-12 text-zinc-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white mb-1">
            Aucune tâche trouvée
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {tasks.length === 0
              ? 'Tapez une tâche dans la barre du haut (ex. « Appeler Paul demain 14h ») ou appuyez sur N.'
              : 'Aucune tâche ne correspond à ces filtres.'}
          </p>
          {(filters.search || filters.category || filters.viewTab !== 'all') && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, search: '', category: '', viewTab: 'all' }))}
              className="mt-4 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : isCustomMode ? (
        /* Unified Custom Drag-and-Drop Sequence */
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <GripVertical className="w-4 h-4" />
              Ordre Personnalisé Manuel ({sorted.length} tâches)
            </span>
            <span className="text-[11px] text-zinc-400">
              Glissez et déposez n'importe quelle carte pour changer sa position
            </span>
          </div>

          <div className="space-y-2">
            {sorted.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onClick={onTaskClick}
                onDelete={onDeleteTask}
                onStartFocus={onStartFocus}
                isDraggable={true}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                isBeingDragged={draggedTaskId === task.id}
                isDragOver={dragOverTaskId === task.id}
                dropPosition={dragOverTaskId === task.id ? dropPosition : null}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Grouped Sections (AI, Date, Priority) with Drag-and-Drop support */
        <div className="space-y-6">
          {/* Urgent / AI Top Priority Section */}
          {urgentGroup.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Urgences Critiques & Priorités IA ({urgentGroup.length})
                </span>
                <span className="text-[11px] text-zinc-400">À traiter immédiatement</span>
              </div>
              <div className="space-y-2">
                {urgentGroup.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onClick={onTaskClick}
                    onDelete={onDeleteTask}
                    onStartFocus={onStartFocus}
                    isDraggable={true}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    isBeingDragged={draggedTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id}
                    dropPosition={dragOverTaskId === task.id ? dropPosition : null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Today's Tasks */}
          {todayGroup.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                  <Calendar className="w-3.5 h-3.5" />
                  À accomplir Aujourd'hui ({todayGroup.length})
                </span>
              </div>
              <div className="space-y-2">
                {todayGroup.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onClick={onTaskClick}
                    onDelete={onDeleteTask}
                    onStartFocus={onStartFocus}
                    isDraggable={true}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    isBeingDragged={draggedTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id}
                    dropPosition={dragOverTaskId === task.id ? dropPosition : null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming or General Tasks */}
          {upcomingGroup.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Autres Tâches Planifiées ({upcomingGroup.length})
                </span>
              </div>
              <div className="space-y-2">
                {upcomingGroup.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onClick={onTaskClick}
                    onDelete={onDeleteTask}
                    onStartFocus={onStartFocus}
                    isDraggable={true}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    isBeingDragged={draggedTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id}
                    dropPosition={dragOverTaskId === task.id ? dropPosition : null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedGroup.length > 0 && (
            <div className="space-y-2.5 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-500">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tâches Accomplies ({completedGroup.length})
                </span>
              </div>
              <div className="space-y-2">
                {completedGroup.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onClick={onTaskClick}
                    onDelete={onDeleteTask}
                    onStartFocus={onStartFocus}
                    isDraggable={true}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    isBeingDragged={draggedTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id}
                    dropPosition={dragOverTaskId === task.id ? dropPosition : null}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
