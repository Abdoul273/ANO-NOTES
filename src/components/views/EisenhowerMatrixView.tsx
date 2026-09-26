import React from 'react';
import { Task, QuadrantType } from '../../types';
import {
  Sparkles,
  AlertOctagon,
  CalendarCheck,
  Users,
  Archive,
  Plus,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface EisenhowerMatrixViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onOpenNewTaskModal: () => void;
  onTriggerAiPrioritize: () => void;
  isAiPrioritizing: boolean;
}

export const EisenhowerMatrixView: React.FC<EisenhowerMatrixViewProps> = ({
  tasks,
  onTaskClick,
  onOpenNewTaskModal,
  onTriggerAiPrioritize,
  isAiPrioritizing,
}) => {
  // Determine quadrant for each task
  const getQuadrant = (t: Task): QuadrantType => {
    if (t.aiQuadrant) return t.aiQuadrant;
    if (t.priority === 'urgent') return 'q1_urgent_important';
    if (t.priority === 'high') return 'q2_not_urgent_important';
    if (t.priority === 'medium') return 'q3_urgent_not_important';
    return 'q4_not_urgent_not_important';
  };

  const quadrants: {
    id: QuadrantType;
    title: string;
    subtitle: string;
    strategy: string;
    icon: any;
    border: string;
    badge: string;
    bg: string;
  }[] = [
    {
      id: 'q1_urgent_important',
      title: 'Quadrant 1 : Faire Immédiatement',
      subtitle: 'Urgent & Important (Crises, Échéances critiques)',
      strategy: 'Exécution prioritaire sans délai',
      icon: AlertOctagon,
      border: 'border-rose-500/30',
      badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      bg: 'bg-rose-500/5',
    },
    {
      id: 'q2_not_urgent_important',
      title: 'Quadrant 2 : Planifier & Deep Work',
      subtitle: 'Important mais Non Urgent (Stratégie, Santé, Projets)',
      strategy: 'Créneau haute valeur ajoutée',
      icon: CalendarCheck,
      border: 'border-indigo-500/30',
      badge: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      bg: 'bg-indigo-500/5',
    },
    {
      id: 'q3_urgent_not_important',
      title: 'Quadrant 3 : Déléguer ou Expédier',
      subtitle: 'Urgent mais Moins Important (Demandes, Tâches rapides)',
      strategy: 'Traiter en lot ou déléguer',
      icon: Users,
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      bg: 'bg-amber-500/5',
    },
    {
      id: 'q4_not_urgent_not_important',
      title: 'Quadrant 4 : Éliminer ou Reporter',
      subtitle: 'Ni Urgent Ni Important (Distractions, Trivialités)',
      strategy: 'Éliminer ou archiver',
      icon: Archive,
      border: 'border-zinc-500/30',
      badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
      bg: 'bg-zinc-500/5',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with AI Re-optimization CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-3xl bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-zinc-900/40 border border-indigo-500/20 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
              Matrice Eisenhower & Priorisation IA
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            L'IA classe automatiquement vos priorités pour réduire la charge mentale et cibler le travail à fort impact.
          </p>
        </div>

        <button
          onClick={onTriggerAiPrioritize}
          disabled={isAiPrioritizing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAiPrioritizing ? 'animate-spin' : ''}`} />
          <span>{isAiPrioritizing ? 'Calcul IA en cours...' : 'Optimiser la Matrice'}</span>
        </button>
      </div>

      {/* 2x2 Quadrants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {quadrants.map((quad) => {
          const quadTasks = tasks.filter((t) => !t.completed && getQuadrant(t) === quad.id);
          const Icon = quad.icon;

          return (
            <div
              key={quad.id}
              className={`rounded-3xl border ${quad.border} ${quad.bg} p-5 flex flex-col min-h-[380px] bg-white dark:bg-zinc-900/80 shadow-sm`}
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-zinc-200/60 dark:border-zinc-800">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {quad.title}
                    </h3>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{quad.subtitle}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${quad.badge}`}>
                  {quadTasks.length} tâche(s)
                </span>
              </div>

              {/* Tasks List */}
              <div className="space-y-2 mt-3 flex-1 overflow-y-auto max-h-[340px] pr-1">
                {quadTasks.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center text-zinc-400 text-xs">
                    <p>Aucune tâche dans ce quadrant</p>
                    <span className="text-[10px] text-zinc-500 mt-1">Stratégie : {quad.strategy}</span>
                  </div>
                ) : (
                  quadTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className="p-3 rounded-2xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/60 hover:border-indigo-500/50 shadow-sm cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {task.title}
                        </span>
                        {task.aiUrgencyScore && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 shrink-0">
                            {task.aiUrgencyScore}/100
                          </span>
                        )}
                      </div>

                      {task.aiReasoning && (
                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 line-clamp-1 italic">
                          💡 {task.aiReasoning}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                        <span>{task.category || 'Général'}</span>
                        {task.dueDate && (
                          <span>
                            {new Date(task.dueDate).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
