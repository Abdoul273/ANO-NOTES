import React from 'react';
import {
  ListTodo,
  Columns3,
  CalendarDays,
  Grid2X2,
  BarChart3,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Download,
  Tag,
  FolderOpen,
  Zap,
} from 'lucide-react';
import { ViewMode, FilterOptions, Task } from '../types';

interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  categories: { id: string; name: string; color: string }[];
  tasks: Task[];
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  viewMode,
  setViewMode,
  filters,
  setFilters,
  categories,
  tasks,
  onExportCSV,
  onExportPDF,
}) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const urgentTasks = tasks.filter(t => !t.completed && (t.priority === 'urgent' || (t.aiUrgencyScore || 0) >= 80)).length;
  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate).getTime() < Date.now()).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const views = [
    { id: 'list', label: 'Vue Liste', icon: ListTodo },
    { id: 'kanban', label: 'Tableau Kanban', icon: Columns3 },
    { id: 'calendar', label: 'Agenda & Calendrier', icon: CalendarDays },
    { id: 'matrix', label: 'Matrice Eisenhower', icon: Grid2X2 },
    { id: 'focus', label: 'Focus Zen (Pomodoro)', icon: Timer },
    { id: 'analytics', label: 'Analyses & Rapports', icon: BarChart3 },
  ];

  const quickFilters = [
    { id: 'all', label: 'Toutes les tâches', count: totalTasks, icon: ListTodo },
    { id: 'today', label: 'Aujourd\'hui', count: tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length, icon: Clock },
    { id: 'ai_prioritized', label: 'Priorités IA Élevées', count: urgentTasks, icon: Sparkles, color: 'text-amber-500' },
    { id: 'overdue', label: 'En retard', count: overdueTasks, icon: AlertTriangle, color: overdueTasks > 0 ? 'text-rose-500' : '' },
    { id: 'completed', label: 'Terminées', count: completedTasks, icon: CheckCircle2, color: 'text-emerald-500' },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-6 p-4 border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/50 text-sm">
      {/* Productivity Score Card */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Score Productivité
          </span>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {completionRate}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{completedTasks} accomplies</span>
          <span>{totalTasks - completedTasks} restantes</span>
        </div>
      </div>

      {/* Main Views Navigation */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-2">
          Vues de Travail
        </div>
        <div className="space-y-1">
          {views.map(v => {
            const Icon = v.icon;
            const active = viewMode === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id as ViewMode)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-xs transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-zinc-400'}`} />
                <span>{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-2">
          Filtres Rapides
        </div>
        <div className="space-y-1">
          {quickFilters.map(f => {
            const Icon = f.icon;
            const active = filters.viewTab === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilters(prev => ({ ...prev, viewTab: f.id as any }))}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  active
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${f.color || 'text-zinc-400'}`} />
                  <span>{f.label}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 px-2 flex items-center justify-between">
          <span>Catégories</span>
          <FolderOpen className="w-3 h-3 text-zinc-400" />
        </div>
        <div className="space-y-1">
          <button
            onClick={() => setFilters(prev => ({ ...prev, category: '' }))}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
              filters.category === ''
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              Toutes les catégories
            </span>
          </button>
          {categories.map(cat => {
            const count = tasks.filter(t => t.category === cat.name && !t.completed).length;
            const active = filters.category === cat.name;
            return (
              <button
                key={cat.id}
                onClick={() => setFilters(prev => ({ ...prev, category: active ? '' : cat.name }))}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  active
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate">{cat.name}</span>
                </div>
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Export Reports Buttons */}
      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1 px-2">
          Partage & Rapports
        </div>
        <button
          onClick={onExportPDF}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-rose-500" />
          <span>Exporter Rapport PDF</span>
        </button>
        <button
          onClick={onExportCSV}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-emerald-500" />
          <span>Exporter Fichier CSV</span>
        </button>
      </div>
    </aside>
  );
};
