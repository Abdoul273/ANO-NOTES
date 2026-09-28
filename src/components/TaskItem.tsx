import React from 'react';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  Timer,
  MoreVertical,
  CheckSquare,
  AlertCircle,
  Tag,
  Trash2,
  GripVertical,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Task } from '../types';
import { soundManager } from '../utils/audio';
import { createGoogleCalendarUrl } from '../utils/export';
import { openExternal } from '../utils/platform';
import { formatDue, isSameLocalDay } from '../utils/dates';
import { urgencyScore } from '../utils/scoring';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (taskId: string) => void;
  onClick: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStartFocus: (task: Task) => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent, task: Task) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, task: Task) => void;
  isDragOver?: boolean;
  dropPosition?: 'top' | 'bottom' | null;
  isBeingDragged?: boolean;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggleComplete,
  onClick,
  onDelete,
  onStartFocus,
  isDraggable = true,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
  dropPosition,
  isBeingDragged,
}) => {
  const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate).getTime() < Date.now();
  const isToday = task.dueDate && !task.completed && !isOverdue && isSameLocalDay(task.dueDate);
  const score = urgencyScore(task);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.completed) {
      soundManager.playTaskComplete();
      try {
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.8 },
          colors: ['#6366f1', '#a855f7', '#10b981'],
        });
      } catch {
        // ignore
      }
    }
    onToggleComplete(task.id);
  };

  const priorityConfig = {
    urgent: { bg: 'bg-rose-500/10 text-rose-500 border-rose-500/30', label: 'Urgent' },
    high: { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/30', label: 'Haute' },
    medium: { bg: 'bg-blue-500/10 text-blue-500 border-blue-500/30', label: 'Moyenne' },
    low: { bg: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30', label: 'Basse' },
  }[task.priority] || { bg: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30', label: task.priority };

  const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div
      onClick={() => onClick(task)}
      draggable={isDraggable}
      onDragStart={(e) => onDragStart?.(e, task)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onDragOver={(e) => onDragOver?.(e, task)}
      onDragLeave={(e) => onDragLeave?.(e)}
      onDrop={(e) => onDrop?.(e, task)}
      className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isBeingDragged
          ? 'opacity-30 border-dashed border-indigo-500 scale-[0.99] bg-indigo-50/20 dark:bg-indigo-950/20'
          : task.completed
          ? 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/40 opacity-70'
          : 'bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/40 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Drop position indicator lines */}
      {isDragOver && dropPosition === 'top' && (
        <div className="absolute -top-1.5 left-2 right-2 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-lg shadow-indigo-500/50 z-30 pointer-events-none animate-pulse" />
      )}
      {isDragOver && dropPosition === 'bottom' && (
        <div className="absolute -bottom-1.5 left-2 right-2 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full shadow-lg shadow-indigo-500/50 z-30 pointer-events-none animate-pulse" />
      )}

      <div className="flex items-start gap-2.5 sm:gap-3">
        {/* Drag handle */}
        {isDraggable && (
          <div
            className="mt-0.5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 cursor-grab active:cursor-grabbing p-0.5 -ml-1 transition-colors"
            title="Glisser pour réorganiser"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Completion Checkbox */}
        <button
          onClick={handleToggle}
          className="mt-0.5 shrink-0 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          title={task.completed ? 'Marquer comme non terminé' : 'Marquer comme terminé'}
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
          ) : (
            <Circle className="w-5 h-5 hover:scale-110 transition-transform" />
          )}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* Title */}
            <h4
              className={`font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate ${
                task.completed ? 'line-through text-zinc-400 dark:text-zinc-500' : ''
              }`}
            >
              {task.title}
            </h4>

            {/* AI Urgency Score Badge */}
            {!task.completed && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                  score >= 80
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                    : score >= 60
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                    : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30'
                }`}
                title={task.aiUrgencyScore !== undefined ? 'Score d\'urgence (analyse IA + échéance)' : 'Score d\'urgence (priorité + échéance)'}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {score}
              </span>
            )}
          </div>

          {/* Description snippet */}
          {task.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mb-2">
              {task.description}
            </p>
          )}

          {/* Meta Info Row */}
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {/* Category tag */}
            <span className="flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.color || '#6366f1' }} />
              {task.category || 'Général'}
            </span>

            {/* Priority tag */}
            <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] border ${priorityConfig.bg}`}>
              {priorityConfig.label}
            </span>

            {/* Due date */}
            {task.dueDate && (
              <span
                className={`flex items-center gap-1 font-medium ${
                  isOverdue
                    ? 'text-rose-500 font-semibold'
                    : isToday
                    ? 'text-amber-500 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <Calendar className="w-3 h-3" />
                {formatDue(task.dueDate)}
                {isOverdue && ' · en retard'}
              </span>
            )}

            {/* Subtasks pill */}
            {totalSubtasks > 0 && (
              <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                <CheckSquare className="w-3 h-3" />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}

            {/* Estimated time */}
            {task.estimatedMinutes > 0 && (
              <span className="flex items-center gap-1 text-zinc-400" title="Temps passé / estimé">
                <Clock className="w-3 h-3" />
                {task.timeSpentMinutes > 0 ? `${task.timeSpentMinutes}/` : ''}{task.estimatedMinutes}m
              </span>
            )}

            {task.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="flex items-center gap-0.5 text-zinc-400">
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}

            {task.smartReminders?.some((r) => !r.triggered) && (
              <span className="text-indigo-400" title="Rappel programmé">🔔</span>
            )}
          </div>

          {/* AI Recommended Slot or Rationale */}
          {task.aiSlotRecommendation && !task.completed && (
            <div className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400/90 flex items-center gap-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 px-2 py-1 rounded-lg border border-indigo-500/20">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="truncate">
                <strong>Créneau suggéré :</strong> {task.aiSlotRecommendation}
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Buttons (shown on hover or active) */}
        <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Start Focus Mode */}
          {!task.completed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartFocus(task);
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Démarrer une session Focus Zen (Pomodoro)"
            >
              <Timer className="w-4 h-4" />
            </button>
          )}

          {/* Add to Google Calendar direct link */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void openExternal(createGoogleCalendarUrl(task));
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Ajouter directement à Google Calendar"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Delete Task */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Supprimer la tâche"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
