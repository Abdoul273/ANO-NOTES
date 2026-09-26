import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import {
  Circle,
  Clock,
  CheckCircle2,
  Hourglass,
  ArrowRight,
  ArrowLeft,
  Plus,
  Sparkles,
  Calendar,
  GripVertical,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../../utils/audio';

interface KanbanViewProps {
  tasks: Task[];
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onOpenNewTaskModal: (initialStatus?: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTasks?: (newTasks: Task[]) => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  tasks,
  onUpdateTaskStatus,
  onTaskClick,
  onOpenNewTaskModal,
  onDeleteTask,
  onReorderTasks,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<TaskStatus | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const columns: { id: TaskStatus; label: string; icon: any; color: string; bg: string }[] = [
    {
      id: 'todo',
      label: 'À Faire',
      icon: Circle,
      color: 'text-zinc-500 dark:text-zinc-400',
      bg: 'bg-zinc-500/10 border-zinc-500/20',
    },
    {
      id: 'in_progress',
      label: 'En Cours',
      icon: Clock,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      id: 'waiting',
      label: 'En Attente / Délégué',
      icon: Hourglass,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      id: 'done',
      label: 'Terminé',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  const handleStatusChange = (e: React.MouseEvent, taskId: string, newStatus: TaskStatus) => {
    e.stopPropagation();
    applyStatusChange(taskId, newStatus);
  };

  const applyStatusChange = (taskId: string, newStatus: TaskStatus, targetTaskId?: string, position?: 'top' | 'bottom') => {
    const isDone = newStatus === 'done';
    if (isDone) {
      soundManager.playTaskComplete();
      try {
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.8 },
        });
      } catch {
        // ignore
      }
    } else {
      soundManager.playSubtaskCheck();
    }

    if (onReorderTasks) {
      const newTasks = [...tasks];
      const sourceIdx = newTasks.findIndex((t) => t.id === taskId);
      if (sourceIdx !== -1) {
        const [movedTask] = newTasks.splice(sourceIdx, 1);
        const updatedTask: Task = {
          ...movedTask,
          status: newStatus,
          completed: isDone,
          completedAt: isDone ? (movedTask.completedAt || new Date().toISOString()) : null,
          updatedAt: new Date().toISOString(),
        };

        if (targetTaskId && targetTaskId !== taskId) {
          const targetIdx = newTasks.findIndex((t) => t.id === targetTaskId);
          if (targetIdx !== -1) {
            const insertIdx = position === 'bottom' ? targetIdx + 1 : targetIdx;
            newTasks.splice(insertIdx, 0, updatedTask);
          } else {
            newTasks.push(updatedTask);
          }
        } else {
          newTasks.push(updatedTask);
        }

        onReorderTasks(newTasks);
        setActionNotice(`Tâche déplacée dans « ${columns.find((c) => c.id === newStatus)?.label} »`);
        setTimeout(() => setActionNotice(null), 3000);
        return;
      }
    }

    onUpdateTaskStatus(taskId, newStatus);
  };

  const getNextStatus = (current: TaskStatus): TaskStatus | null => {
    if (current === 'todo') return 'in_progress';
    if (current === 'in_progress') return 'done';
    if (current === 'waiting') return 'in_progress';
    return null;
  };

  const getPrevStatus = (current: TaskStatus): TaskStatus | null => {
    if (current === 'done') return 'in_progress';
    if (current === 'in_progress') return 'todo';
    if (current === 'waiting') return 'todo';
    return null;
  };

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumnId(null);
    setDragOverTaskId(null);
    setDropPosition(null);
  };

  const handleColumnDragOver = (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverColumnId !== colId) {
      setDragOverColumnId(colId);
    }
  };

  const handleColumnDrop = (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!sourceId) {
      handleDragEnd();
      return;
    }
    applyStatusChange(sourceId, colId);
    handleDragEnd();
  };

  const handleCardDragOver = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const pos: 'top' | 'bottom' = offset < rect.height / 2 ? 'top' : 'bottom';

    if (dragOverTaskId !== targetTask.id || dropPosition !== pos) {
      setDragOverTaskId(targetTask.id);
      setDropPosition(pos);
      setDragOverColumnId(targetTask.status);
    }
  };

  const handleCardDrop = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!sourceId || sourceId === targetTask.id) {
      handleDragEnd();
      return;
    }

    applyStatusChange(sourceId, targetTask.status, targetTask.id, dropPosition || 'bottom');
    handleDragEnd();
  };

  return (
    <div className="space-y-4">
      {/* Notice Feedback Banner */}
      {actionNotice && (
        <div className="flex items-center gap-2 p-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const Icon = col.icon;
          const totalMinutes = colTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
          const isColumnHovered = dragOverColumnId === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleColumnDragOver(e, col.id)}
              onDrop={(e) => handleColumnDrop(e, col.id)}
              className={`flex flex-col rounded-3xl border p-3.5 min-h-[520px] transition-all duration-200 ${
                isColumnHovered
                  ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg'
                  : 'bg-zinc-50/80 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg border ${col.bg}`}>
                    <Icon className={`w-4 h-4 ${col.color}`} />
                  </span>
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>{col.label}</span>
                      <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                        {colTasks.length}
                      </span>
                    </h3>
                    <span className="text-[10px] text-zinc-400">
                      ~{totalMinutes} min estimées
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onOpenNewTaskModal(col.id)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                  title={`Ajouter une tâche dans ${col.label}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Task Cards Container */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[70vh] pr-1 py-1">
                {colTasks.length === 0 ? (
                  <div
                    onDragOver={(e) => handleColumnDragOver(e, col.id)}
                    onDrop={(e) => handleColumnDrop(e, col.id)}
                    className={`h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-2xl text-xs transition-colors ${
                      isColumnHovered
                        ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-medium'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <p>{isColumnHovered ? 'Déposez la tâche ici' : 'Aucune tâche dans cette colonne'}</p>
                    {!isColumnHovered && (
                      <button
                        onClick={() => onOpenNewTaskModal(col.id)}
                        className="mt-2 text-indigo-500 hover:underline text-[11px] font-medium"
                      >
                        + Ajouter une tâche
                      </button>
                    )}
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const prev = getPrevStatus(task.status);
                    const next = getNextStatus(task.status);
                    const isBeingDragged = draggedTaskId === task.id;
                    const isDragOver = dragOverTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleCardDragOver(e, task)}
                        onDrop={(e) => handleCardDrop(e, task)}
                        onClick={() => onTaskClick(task)}
                        className={`group relative p-3 rounded-2xl border transition-all duration-150 cursor-pointer space-y-2 ${
                          isBeingDragged
                            ? 'opacity-30 border-dashed border-indigo-500 scale-[0.98] bg-indigo-50/20 dark:bg-indigo-950/20'
                            : 'bg-white dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700/60 hover:border-indigo-500/50 shadow-sm hover:shadow-md'
                        }`}
                      >
                        {/* Drop insertion line indicators */}
                        {isDragOver && dropPosition === 'top' && (
                          <div className="absolute -top-1.5 left-2 right-2 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-lg shadow-indigo-500/50 z-30 pointer-events-none animate-pulse" />
                        )}
                        {isDragOver && dropPosition === 'bottom' && (
                          <div className="absolute -bottom-1.5 left-2 right-2 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-lg shadow-indigo-500/50 z-30 pointer-events-none animate-pulse" />
                        )}

                        {/* Top Badges & Drag handle */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 cursor-grab active:cursor-grabbing p-0.5 -ml-1 transition-colors shrink-0"
                              title="Glisser pour déplacer entre colonnes ou réorganiser"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-zinc-700 dark:text-zinc-300 truncate"
                              style={{ backgroundColor: `${task.color || '#6366f1'}20` }}
                            >
                              {task.category || 'Général'}
                            </span>
                          </div>

                          {task.aiUrgencyScore && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                              <Sparkles className="w-2.5 h-2.5" />
                              {task.aiUrgencyScore}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-2">
                          {task.title}
                        </h4>

                        {/* Meta Footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-700/40 text-[10px] text-zinc-400">
                          {task.dueDate ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          ) : (
                            <span>Sans échéance</span>
                          )}

                          {/* Move status buttons as secondary quick action */}
                          <div className="flex items-center gap-1">
                            {prev && (
                              <button
                                onClick={(e) => handleStatusChange(e, task.id, prev)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                title="Déplacer vers la gauche"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                            )}
                            {next && (
                              <button
                                onClick={(e) => handleStatusChange(e, task.id, next)}
                                className="p-1 rounded text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                title="Déplacer vers la droite"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
