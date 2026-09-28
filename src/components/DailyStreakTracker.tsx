import React, { useMemo } from 'react';
import { Task } from '../types';
import { localDateKey } from '../utils/dates';
import { Flame, Trophy, Calendar, CheckCircle2, TrendingUp, Sparkles, Award } from 'lucide-react';

interface DailyStreakTrackerProps {
  tasks: Task[];
}

export const DailyStreakTracker: React.FC<DailyStreakTrackerProps> = ({ tasks }) => {
  // Compute completion stats over the last 30 days
  const streakStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Map: dateKey 'YYYY-MM-DD' -> count of completed tasks
    const completionsByDay: Record<string, number> = {};

    tasks.forEach((t) => {
      if (t.completed) {
        const dateSource = t.completedAt || t.updatedAt || t.createdAt;
        if (dateSource) {
          const d = new Date(dateSource);
          const key = localDateKey(d);
          completionsByDay[key] = (completionsByDay[key] || 0) + 1;
        }
      }
    });

    // Generate last 28 days (4 full weeks) array
    const daysArray: { dateStr: string; date: Date; count: number; isToday: boolean; dayLetter: string }[] = [];
    const dayLetters = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = localDateKey(d);
      daysArray.push({
        dateStr: key,
        date: d,
        count: completionsByDay[key] || 0,
        isToday: i === 0,
        dayLetter: dayLetters[d.getDay()],
      });
    }

    // Calculate current streak: consecutive days with at least 1 completed task
    let currentStreak = 0;
    const checkDate = new Date(today);
    const todayKey = localDateKey(checkDate);
    const completedToday = (completionsByDay[todayKey] || 0) > 0;

    // If completed today, count today and go backwards; if not yet today, start checking from yesterday
    if (!completedToday) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const k = localDateKey(checkDate);
      if (completionsByDay[k] && completionsByDay[k] > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate best streak in the tracked window
    let bestStreak = currentStreak;
    let tempStreak = 0;
    daysArray.forEach((day) => {
      if (day.count > 0) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    });

    const activeDaysCount = daysArray.filter((d) => d.count > 0).length;
    const consistencyPercentage = Math.round((activeDaysCount / 28) * 100);

    return {
      daysArray,
      currentStreak,
      bestStreak: Math.max(bestStreak, currentStreak),
      completedToday,
      activeDaysCount,
      consistencyPercentage,
    };
  }, [tasks]);

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
      {/* Tracker Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Flame className="w-4 h-4 fill-amber-500" />
            </span>
            <h3 className="font-bold text-base text-zinc-900 dark:text-white">
              Série d'Activité & Régularité (Daily Streak)
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Visualisez votre constance quotidienne dans l'accomplissement de vos objectifs.
          </p>
        </div>

        {/* Badges / Stats Chips */}
        <div className="flex items-center gap-2">
          {/* Current Streak badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-sm">
            <Flame className={`w-4 h-4 fill-amber-500 ${streakStats.currentStreak > 0 ? 'animate-bounce' : ''}`} />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider">Série Actuelle</div>
              <div className="text-sm font-black leading-none">{streakStats.currentStreak} jour(s)</div>
            </div>
          </div>

          {/* Record / Best Streak badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-sm">
            <Trophy className="w-4 h-4" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider">Record</div>
              <div className="text-sm font-black leading-none">{streakStats.bestStreak} jour(s)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap / Consistency Activity Grid (Last 28 Days) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium">Historique des 4 dernières semaines</span>
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {streakStats.consistencyPercentage}% de régularité ({streakStats.activeDaysCount}/28 j)
          </span>
        </div>

        {/* Grid of days */}
        <div className="grid grid-cols-7 sm:grid-cols-14 md:grid-cols-28 gap-1.5">
          {streakStats.daysArray.map((day) => {
            const hasActivity = day.count > 0;
            const intensity =
              day.count >= 4
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                : day.count >= 2
                ? 'bg-amber-400/90 text-zinc-900'
                : day.count === 1
                ? 'bg-amber-500/40 text-amber-900 dark:text-amber-200'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-600';

            return (
              <div
                key={day.dateStr}
                title={`${day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })} : ${day.count} tâche(s) complétée(s)`}
                className={`group relative flex flex-col items-center justify-center h-12 rounded-xl border transition-all cursor-pointer ${
                  day.isToday
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-105 z-10'
                    : 'border-zinc-200/50 dark:border-zinc-800/50 hover:scale-110'
                } ${intensity}`}
              >
                <span className="text-[9px] font-medium opacity-70">
                  {day.dayLetter}
                </span>
                <span className="text-xs font-bold leading-tight">
                  {day.date.getDate()}
                </span>
                {hasActivity && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 border border-white dark:border-zinc-900" />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-1">
          <div className="flex items-center gap-2">
            <span>Moins actif</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
              <span className="w-3 h-3 rounded bg-amber-500/40" />
              <span className="w-3 h-3 rounded bg-amber-400/90" />
              <span className="w-3 h-3 rounded bg-amber-500" />
            </div>
            <span>Plus actif</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              <span className="w-2 h-2 rounded-full ring-2 ring-indigo-500/50 bg-indigo-500 inline-block" />
              Aujourd'hui
            </span>
            {streakStats.completedToday ? (
              <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Série validée aujourd'hui !
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500 font-medium">
                Complétez une tâche aujourd'hui pour maintenir votre série
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
