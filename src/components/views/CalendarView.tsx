import React, { useState } from 'react';
import { Task } from '../../types';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Download,
  Upload,
  Plus,
  Clock,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { downloadIcsFile, createGoogleCalendarUrl, parseIcsFile } from '../../utils/export';
import { openExternal } from '../../utils/platform';
import { localDateKey } from '../../utils/dates';
import { toast } from '../Toaster';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onOpenNewTaskModal: (initialDate?: string) => void;
  onImportTasks: (imported: Partial<Task>[]) => void;
  onRescheduleTask: (taskId: string, dateKey: string) => void;
  syncCode: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onTaskClick,
  onOpenNewTaskModal,
  onImportTasks,
  onRescheduleTask,
  syncCode,
}) => {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(localDateKey(new Date()));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // Days in month calculation
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Adjust so Monday is 0
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(localDateKey(now));
  };

  // Handle iCal import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseIcsFile(content);
        if (parsed.length > 0) onImportTasks(parsed);
        else toast('Aucun événement trouvé dans ce fichier .ics.', { tone: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter tasks for selected day
  const dayTasks = tasks.filter((t) => {
    if (!t.dueDate) return false;
    return localDateKey(t.dueDate) === selectedDate;
  }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  return (
    <div className="space-y-6">
      {/* Calendar Header with Sync Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Aujourd'hui
          </button>
        </div>

        {/* Sync & Integration Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export to .ics / Google Calendar */}
          <button
            onClick={async () => { if (await downloadIcsFile(tasks)) toast('Agenda .ics enregistré.'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors"
            title="Télécharger l'agenda au format standard .ics (Google Calendar, Apple, Outlook)"
          >
            <Download className="w-3.5 h-3.5 text-indigo-500" />
            <span>Télécharger .ics</span>
          </button>

          {/* Import existing calendar */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-purple-500" />
            <span>Importer calendrier (.ics)</span>
            <input
              type="file"
              accept=".ics,text/calendar"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Main Calendar & Day Planner Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Month Grid */}
        <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-zinc-400 mb-2">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mer</span>
            <span>Jeu</span>
            <span>Ven</span>
            <span>Sam</span>
            <span>Dim</span>
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Empty offset padding */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-16 sm:h-24 rounded-2xl bg-zinc-50/40 dark:bg-zinc-950/20" />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateObj = new Date(year, month, dayNum);
              const dateString = localDateKey(dateObj);
              const isSelected = selectedDate === dateString;
              const isToday = new Date().toDateString() === dateObj.toDateString();

              // Tasks on this day
              const dayTasksList = tasks.filter((t) => {
                if (!t.dueDate) return false;
                return localDateKey(t.dueDate) === dateString;
              });

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDate(dateString)}
                  onDoubleClick={() => onOpenNewTaskModal(dateString)}
                  onDragOver={(e) => { e.preventDefault(); setDropTarget(dateString); }}
                  onDragLeave={() => setDropTarget((d) => (d === dateString ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    const id = e.dataTransfer.getData('text/plain');
                    if (id) { onRescheduleTask(id, dateString); setSelectedDate(dateString); }
                  }}
                  title="Double-clic : nouvelle tâche · Déposez une tâche pour la replanifier"
                  className={`h-16 sm:h-24 p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    dropTarget === dateString
                      ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-950/40'
                      : isSelected
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-sm ring-2 ring-indigo-500/20'
                      : isToday
                      ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-amber-500 text-white'
                          : isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayTasksList.length > 0 && (
                      <span className="text-[10px] font-semibold text-zinc-400">
                        {dayTasksList.length}
                      </span>
                    )}
                  </div>

                  {/* Task indicators dots/bars */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayTasksList.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded truncate font-medium ${
                          t.completed
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 line-through'
                            : t.priority === 'urgent'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasksList.length > 2 && (
                      <div className="text-[9px] text-zinc-400 pl-1">
                        +{dayTasksList.length - 2} autre(s)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda Planner */}
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                Planning du Jour
              </span>
              <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
            </div>
            <button
              onClick={() => onOpenNewTaskModal(selectedDate)}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              title="Ajouter une tâche à ce jour"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* List of day's tasks */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {dayTasks.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-xs">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-400" />
                <p>Aucune tâche planifiée pour ce jour.</p>
                <button
                  onClick={() => onOpenNewTaskModal(selectedDate)}
                  className="mt-3 text-indigo-500 font-semibold text-xs hover:underline"
                >
                  + Planifier une tâche
                </button>
              </div>
            ) : (
              dayTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onClick={() => onTaskClick(task)}
                  title="Glissez sur un autre jour pour replanifier"
                  className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 hover:border-indigo-500/40 transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                      {task.category || 'Général'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); void openExternal(createGoogleCalendarUrl(task)); }}
                      className="p-1 rounded text-zinc-400 hover:text-blue-500"
                      title="Ajouter à Google Calendar"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4
                    className={`font-semibold text-xs text-zinc-900 dark:text-zinc-100 ${
                      task.completed ? 'line-through text-zinc-400' : ''
                    }`}
                  >
                    {task.title}
                  </h4>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      {new Date(task.dueDate!).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {task.estimatedMinutes > 0 && <span>{task.estimatedMinutes} min</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
