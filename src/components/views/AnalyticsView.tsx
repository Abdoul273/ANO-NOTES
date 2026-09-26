import React from 'react';
import { Task, UserHabits } from '../../types';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Upload,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { exportTasksToCSV, exportTasksToPDF } from '../../utils/export';
import { DailyStreakTracker } from '../DailyStreakTracker';

interface AnalyticsViewProps {
  tasks: Task[];
  userHabits: UserHabits;
  onImportTasks: (tasks: Partial<Task>[]) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  tasks,
  userHabits,
  onImportTasks,
}) => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const overdue = tasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate).getTime() < Date.now()).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const totalTimeSpent = tasks.reduce((acc, t) => acc + (t.timeSpentMinutes || 0), 0);
  const totalEstimated = tasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

  // Group by category
  const categoryStats: Record<string, { count: number; completed: number }> = {};
  tasks.forEach((t) => {
    const cat = t.category || 'Général';
    if (!categoryStats[cat]) categoryStats[cat] = { count: 0, completed: 0 };
    categoryStats[cat].count++;
    if (t.completed) categoryStats[cat].completed++;
  });

  // Group by priority
  const priorityStats = {
    urgent: tasks.filter((t) => t.priority === 'urgent').length,
    high: tasks.filter((t) => t.priority === 'high').length,
    medium: tasks.filter((t) => t.priority === 'medium').length,
    low: tasks.filter((t) => t.priority === 'low').length,
  };

  // Handle JSON backup export
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `auratask-backup-${new Date().toISOString().substring(0, 10)}.json`);
    dl.click();
  };

  // Handle JSON backup import
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportTasks(parsed);
          alert(`${parsed.length} tâches importées avec succès !`);
        }
      } catch {
        alert('Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header and Productivity Index */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-zinc-900 border border-indigo-500/20 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Tableau de Bord & Performance
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Indice d'Efficacité Personnelle
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Analyse quantitative et qualitative de vos habitudes de travail et de votre flux d'exécution.
          </p>
        </div>

        {/* Big Rate Gauge */}
        <div className="flex items-center gap-4 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-500 flex items-center justify-center font-black text-xl text-white">
            {completionRate}%
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-300">Taux d'Accomplissement</span>
            <p className="text-[11px] text-zinc-500">{completed} sur {total} tâches terminées</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-1">
          <span className="text-xs text-zinc-400">Total Tâches</span>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">{total}</div>
          <span className="text-[10px] text-indigo-500 font-semibold">{pending} en cours</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-1">
          <span className="text-xs text-zinc-400">Terminées</span>
          <div className="text-2xl font-black text-emerald-500">{completed}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">{completionRate}% du total</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-1">
          <span className="text-xs text-zinc-400">En Retard</span>
          <div className="text-2xl font-black text-rose-500">{overdue}</div>
          <span className="text-[10px] text-rose-600 font-semibold">{overdue === 0 ? 'Aucun retard' : 'Action requise'}</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-1">
          <span className="text-xs text-zinc-400">Temps Focus Réalisé</span>
          <div className="text-2xl font-black text-purple-500">{totalTimeSpent}m</div>
          <span className="text-[10px] text-zinc-400">Prévu: {totalEstimated}m</span>
        </div>
      </div>

      {/* Daily Streak Consistency Tracker */}
      <DailyStreakTracker tasks={tasks} />

      {/* Category and Priority Visual Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categories Distribution */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center justify-between">
            <span>Répartition par Catégorie</span>
            <span className="text-xs font-normal text-zinc-400">{Object.keys(categoryStats).length} domaines</span>
          </h3>
          <div className="space-y-3">
            {Object.entries(categoryStats).map(([name, data]) => {
              const pct = data.count > 0 ? Math.round((data.completed / data.count) * 100) : 0;
              return (
                <div key={name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-700 dark:text-zinc-300">{name}</span>
                    <span className="text-zinc-400">{data.completed}/{data.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
            Niveaux d'Urgence & Charge Mentale
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
              <span className="font-semibold text-rose-600 dark:text-rose-400">🔴 Urgent</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{priorityStats.urgent} tâche(s)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <span className="font-semibold text-amber-600 dark:text-amber-400">🟠 Haute Priorité</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{priorityStats.high} tâche(s)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
              <span className="font-semibold text-blue-600 dark:text-blue-400">🔵 Moyenne Priorité</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{priorityStats.medium} tâche(s)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-500/10 border border-zinc-500/20 text-xs">
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">⚪ Basse Priorité</span>
              <span className="font-bold text-zinc-600 dark:text-zinc-400">{priorityStats.low} tâche(s)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Export & Collaboration Hub */}
      <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-base text-zinc-900 dark:text-white">
            Exportation & Partage Collaborateurs
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Exportez vos rapports d'avancement pour vos réunions d'équipe ou sauvegardez l'intégralité de vos données.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Export PDF Button */}
          <button
            onClick={() => exportTasksToPDF(tasks)}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-rose-400 transition-all font-semibold text-xs shadow-sm"
          >
            <FileText className="w-4 h-4 text-rose-500" />
            <span>Télécharger Rapport PDF</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={() => exportTasksToCSV(tasks)}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 transition-all font-semibold text-xs shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Exporter Tableur CSV</span>
          </button>

          {/* Export JSON Backup */}
          <button
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 transition-all font-semibold text-xs shadow-sm"
          >
            <Download className="w-4 h-4 text-indigo-500" />
            <span>Sauvegarde JSON Complète</span>
          </button>

          {/* Import JSON Backup */}
          <label className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-all font-semibold text-xs shadow-sm cursor-pointer">
            <Upload className="w-4 h-4 text-purple-500" />
            <span>Restaurer une Sauvegarde</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
