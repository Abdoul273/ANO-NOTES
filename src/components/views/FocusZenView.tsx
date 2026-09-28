import React, { useState, useEffect, useRef } from 'react';
import { Task, UserHabits } from '../../types';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  CheckCircle2,
  ChevronDown,
  Maximize2,
  Minimize2,
  Flame,
  Coffee,
  Bell,
  BellRing,
  Lightbulb,
  ArrowRight,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';
import { soundManager } from '../../utils/audio';
import { notify, ensureNotificationPermission } from '../../utils/platform';
import { localDateKey } from '../../utils/dates';
import confetti from 'canvas-confetti';

interface FocusZenViewProps {
  tasks: Task[];
  userHabits: UserHabits;
  initialTaskId?: string | null;
  onAddTimeSpent: (taskId: string, minutes: number) => void;
  onCompleteTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

// Le minuteur survit aux changements de vue et au redémarrage de l'app.
const TIMER_KEY = 'auratask_focus_timer_v1';
interface TimerState {
  mode: 'focus' | 'break';
  timeLeft: number;
  endAt: number | null;
  focusMinutes: number;
  breakMinutes: number;
  sessions: number;
  sessionsDay: string;
  taskId: string | null;
}
const loadTimer = (): Partial<TimerState> => {
  try {
    return JSON.parse(localStorage.getItem(TIMER_KEY) || '{}');
  } catch {
    return {};
  }
};

export const FocusZenView: React.FC<FocusZenViewProps> = ({
  tasks,
  userHabits,
  initialTaskId,
  onAddTimeSpent,
  onCompleteTask,
  onToggleSubtask,
}) => {
  const saved = useRef(loadTimer()).current;
  const today = localDateKey(new Date());

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTaskId || saved.taskId || tasks.find((t) => !t.completed)?.id || null
  );
  // Toujours la version à jour de la tâche (modifiée ailleurs ou depuis le panneau).
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const [focusMinutes, setFocusMinutes] = useState<number>(saved.focusMinutes || userHabits.focusDuration || 25);
  const [breakMinutes, setBreakMinutes] = useState<number>(saved.breakMinutes || userHabits.breakDuration || 5);

  const [mode, setMode] = useState<'focus' | 'break'>(saved.mode || 'focus');
  const [endAt, setEndAt] = useState<number | null>(saved.endAt ?? null);
  const [timeLeft, setTimeLeft] = useState<number>(() =>
    saved.endAt ? Math.max(0, Math.ceil((saved.endAt - Date.now()) / 1000)) : saved.timeLeft ?? focusMinutes * 60
  );
  const isRunning = endAt !== null;
  const [sessionsCompleted, setSessionsCompleted] = useState<number>(saved.sessionsDay === today ? saved.sessions || 0 : 0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [sessionEndNotice, setSessionEndNotice] = useState<{
    taskTitle: string;
    suggestedBreak: number;
    advice: string;
    label: string;
  } | null>(null);

  const setIsRunning = (run: boolean) => {
    setEndAt(run ? Date.now() + timeLeft * 1000 : null);
  };
  const setDuration = (seconds: number, run = false) => {
    setTimeLeft(seconds);
    setEndAt(run ? Date.now() + seconds * 1000 : null);
  };

  useEffect(() => {
    if (initialTaskId) setSelectedTaskId(initialTaskId);
  }, [initialTaskId]);

  useEffect(() => {
    const state: TimerState = {
      mode, timeLeft, endAt, focusMinutes, breakMinutes,
      sessions: sessionsCompleted, sessionsDay: today, taskId: selectedTaskId,
    };
    localStorage.setItem(TIMER_KEY, JSON.stringify(state));
  }, [mode, timeLeft, endAt, focusMinutes, breakMinutes, sessionsCompleted, selectedTaskId, today]);

  // Calculate adaptive break based on task's estimated time and completed cycles
  const getAdaptiveBreak = (task: Task | null, cycles: number) => {
    const est = task?.estimatedMinutes || 30;

    // Every 4 cycles, recommend a long break
    if (cycles > 0 && cycles % 4 === 0) {
      const longBreak = est >= 60 ? 20 : 15;
      return {
        minutes: longBreak,
        label: `Grande Pause Méritée (${longBreak} min)`,
        advice: `Félicitations pour 4 cycles Pomodoro accomplis sur « ${task?.title || 'votre session'} » ! Accordez-vous un vrai répit loin des écrans.`,
      };
    }

    if (est <= 20) {
      return {
        minutes: 3,
        label: 'Micro-pause active (3 min)',
        advice: 'Tâche courte et ciblée : hydratez-vous, étirez vos bras et vos épaules.',
      };
    } else if (est <= 45) {
      return {
        minutes: 5,
        label: 'Pause Standard Pomodoro (5 min)',
        advice: 'Respirez profondément, faites quelques pas pour stimuler votre circulation sanguine.',
      };
    } else if (est <= 75) {
      return {
        minutes: 8,
        label: 'Pause Récupération Cognitive (8 min)',
        advice: 'Tâche exigeante (>1h) : reposez vos yeux en fixant un point à l\'horizon.',
      };
    } else {
      return {
        minutes: 12,
        label: 'Pause Déconnexion & Énergie (12 min)',
        advice: 'Projet lourd à haute intensité : accordez-vous une coupure pour éviter la fatigue décisionnelle.',
      };
    }
  };

  // Send system notification when session ends
  const notifySessionEnd = (completedMode: 'focus' | 'break', adaptive: ReturnType<typeof getAdaptiveBreak>) => {
    if (userHabits.soundEnabled) soundManager.playTimerBell();
    if (!userHabits.notificationsEnabled) return;
    if (completedMode === 'focus') {
      void notify('🍅 Session terminée !', `Bravo ! Prenez votre ${adaptive.label.toLowerCase()} pour recharger votre concentration.`);
    } else {
      void notify('⚡ Fin de la pause', 'Prêt pour une nouvelle session de concentration ?');
    }
  };

  // Horloge basée sur l'heure de fin : pas de dérive quand la fenêtre est en arrière-plan.
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endAt]);

  // Fin de session
  useEffect(() => {
    if (endAt === null || timeLeft > 0) return;
    if (mode === 'focus') {
      const newCount = sessionsCompleted + 1;
      setSessionsCompleted(newCount);
      if (selectedTaskId) onAddTimeSpent(selectedTaskId, focusMinutes);

      const adaptive = getAdaptiveBreak(selectedTask, newCount);
      setBreakMinutes(adaptive.minutes);
      notifySessionEnd('focus', adaptive);
      setSessionEndNotice({
        taskTitle: selectedTask?.title || 'Session de travail',
        suggestedBreak: adaptive.minutes,
        advice: adaptive.advice,
        label: adaptive.label,
      });
      setMode('break');
      setDuration(adaptive.minutes * 60);
    } else {
      notifySessionEnd('break', getAdaptiveBreak(selectedTask, sessionsCompleted));
      setMode('focus');
      setDuration(focusMinutes * 60);
      setSessionEndNotice(null);
    }
  }, [timeLeft, endAt]);

  const toggleTimer = () => {
    if (!isRunning && userHabits.notificationsEnabled) void ensureNotificationPermission();
    setIsRunning(!isRunning);
  };
  const toggleRef = useRef(toggleTimer);
  toggleRef.current = toggleTimer;

  // Espace : démarrer / suspendre
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (e.code !== 'Space' || tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const resetTimer = () => {
    setDuration(mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60);
  };

  const handleSwitchMode = (newMode: 'focus' | 'break') => {
    setMode(newMode);
    setDuration(newMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60);
    setSessionEndNotice(null);
  };

  const applyPreset = (focusM: number, breakM: number) => {
    setFocusMinutes(focusM);
    setBreakMinutes(breakM);
    setDuration(mode === 'focus' ? focusM * 60 : breakM * 60);
    setSessionEndNotice(null);
  };

  const applyAdaptivePresetForTask = () => {
    if (!selectedTask) return;
    const est = selectedTask.estimatedMinutes || 30;
    // Suggest focus chunk (25 min standard or 45 for longer tasks)
    const suggestedFocus = est >= 60 ? 45 : est <= 20 ? 15 : 25;
    const adaptive = getAdaptiveBreak(selectedTask, sessionsCompleted);
    applyPreset(suggestedFocus, adaptive.minutes);
  };

  const startSuggestedBreak = (minutes: number) => {
    setBreakMinutes(minutes);
    setMode('break');
    setDuration(minutes * 60, true);
    setSessionEndNotice(null);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const total = mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
  const progressPercent = total > 0 ? Math.round(((total - timeLeft) / total) * 100) : 0;

  const handleCompleteCurrentTask = () => {
    if (!selectedTask) return;
    soundManager.playTaskComplete();
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }
    onCompleteTask(selectedTask.id);
    setSelectedTaskId(tasks.find((t) => !t.completed && t.id !== selectedTask.id)?.id || null);
    setSessionEndNotice(null);
  };

  // Current Pomodoro cycle (1 to 4)
  const currentCycle = (sessionsCompleted % 4) + 1;

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-6 sm:p-10 rounded-3xl bg-zinc-950 text-white border border-zinc-800 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none overflow-y-auto' : 'min-h-[620px]'
      }`}
    >
      {/* Background ambient gradient glow */}
      <div className="absolute w-96 h-96 rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

      {/* Top Header & Presets */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 z-10 max-w-2xl">
        {/* Mode switcher tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSwitchMode('focus')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'focus'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Travail ({focusMinutes}m)</span>
          </button>
          <button
            onClick={() => handleSwitchMode('break')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mode === 'break'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
            }`}
          >
            <Coffee className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pause ({breakMinutes}m)</span>
          </button>
        </div>

        {/* Quick Pomodoro Presets */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-[11px]">
          <button
            onClick={() => applyPreset(25, 5)}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              focusMinutes === 25 && breakMinutes === 5
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Pomodoro Classique (25m focus / 5m pause)"
          >
            25/5
          </button>
          <button
            onClick={() => applyPreset(50, 10)}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              focusMinutes === 50 && breakMinutes === 10
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Deep Work (50m focus / 10m pause)"
          >
            50/10
          </button>
          <button
            onClick={() => applyPreset(15, 3)}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              focusMinutes === 15 && breakMinutes === 3
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Sprint Rapide (15m focus / 3m pause)"
          >
            15/3
          </button>

          {selectedTask && (
            <button
              onClick={applyAdaptivePresetForTask}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-400 hover:text-indigo-300 font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
              title={`Ajuster automatiquement les créneaux selon l'estimation de la tâche (${selectedTask.estimatedMinutes} min)`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Adaptatif</span>
            </button>
          )}
        </div>

        {/* Right tools (Notifications & Fullscreen) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors"
            title={isFullscreen ? 'Quitter le mode plein écran' : 'Mode plein écran zen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Selected Task Target Selector */}
      <div className="w-full max-w-md z-10 mb-4 text-center space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-center gap-1.5">
          <span>Objectif de Concentration Unique</span>
          {selectedTask?.estimatedMinutes && (
            <span className="text-zinc-500 font-normal">
              (Est. {selectedTask.estimatedMinutes} min)
            </span>
          )}
        </label>
        <div className="relative">
          <select
            value={selectedTask?.id || ''}
            onChange={(e) => setSelectedTaskId(e.target.value || null)}
            className="w-full px-4 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none pr-8 cursor-pointer"
          >
            <option value="">-- Choisir une tâche à exécuter --</option>
            {tasks
              .filter((t) => !t.completed)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.priority === 'urgent' ? '🔴 ' : ''}
                  {t.title} (~{t.estimatedMinutes}m)
                </option>
              ))}
          </select>
          <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {selectedTask && selectedTask.subtasks.length > 0 && (
          <div className="text-left space-y-1 pt-1">
            {selectedTask.subtasks.map((st) => (
              <label key={st.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs cursor-pointer hover:border-indigo-500/40">
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={() => { soundManager.playSubtaskCheck(); onToggleSubtask(selectedTask.id, st.id); }}
                  className="rounded text-indigo-600"
                />
                <span className={st.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}>{st.title}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 4-Pomodoro Cycle Progress Indicators */}
      <div className="flex items-center gap-2.5 mb-2 z-10">
        <span className="text-[11px] text-zinc-400 font-medium mr-1">Cycle Pomodoro :</span>
        {[1, 2, 3, 4].map((step) => {
          const isDone = sessionsCompleted % 4 >= step || (sessionsCompleted > 0 && sessionsCompleted % 4 === 0);
          const isCurrent = currentCycle === step && mode === 'focus';

          return (
            <div
              key={step}
              title={`Pomodoro ${step}/4 ${isDone ? '(Terminé)' : isCurrent ? '(En cours)' : '(À venir)'}`}
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                isDone
                  ? 'bg-rose-500 shadow-sm shadow-rose-500/50 ring-2 ring-rose-500/30'
                  : isCurrent
                  ? 'bg-amber-400 animate-pulse ring-2 ring-amber-400/50'
                  : 'bg-zinc-800 border border-zinc-700'
              }`}
            >
              {isDone && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
          );
        })}
        <span className="text-[10px] text-zinc-500 ml-1">
          {sessionsCompleted > 0 && sessionsCompleted % 4 === 0
            ? 'Grande pause disponible !'
            : `${currentCycle}/4`}
        </span>
      </div>

      {/* Adaptive Break Suggestion Banner (Appears when focus ends) */}
      {sessionEndNotice && (
        <div className="w-full max-w-lg mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-indigo-950/60 border border-emerald-500/30 shadow-xl text-left z-20 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Coffee className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-white">
                  Session terminée ! Pause suggérée : {sessionEndNotice.label}
                </h4>
                <p className="text-[11px] text-emerald-400/90 font-medium">
                  Recommandation adaptée à l'estimation de la tâche ({selectedTask?.estimatedMinutes || 30} min)
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-300 mt-2 mb-3">
            {sessionEndNotice.advice}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800">
            <button
              onClick={() => startSuggestedBreak(sessionEndNotice.suggestedBreak)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Lancer la pause ({sessionEndNotice.suggestedBreak} min)</span>
            </button>

            <button
              onClick={() => {
                setSessionEndNotice(null);
                setMode('focus');
                setDuration(focusMinutes * 60, true);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              Enchaîner le focus
            </button>
          </div>
        </div>
      )}

      {/* Big Digital Timer Display */}
      <div className="relative flex flex-col items-center justify-center my-2 z-10">
        <div className="text-7xl sm:text-9xl font-black font-mono tracking-tighter text-white drop-shadow-2xl select-none">
          {formattedTime}
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mt-1 flex items-center gap-2">
          <span>
            {mode === 'focus'
              ? 'Session de Concentration Intense'
              : 'Pause Récupération & Respiration'}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span className="text-zinc-500 font-mono">{progressPercent}%</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-6 z-10">
        <button
          onClick={resetTimer}
          className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
          title="Réinitialiser le chronomètre"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={toggleTimer}
          className={`px-8 py-3.5 rounded-2xl font-bold text-sm sm:text-base shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${
            mode === 'focus'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-5 h-5" />
              <span>Suspendre</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>{mode === 'focus' ? 'Démarrer le Focus' : 'Démarrer la Pause'}</span>
            </>
          )}
        </button>

        {selectedTask && (
          <button
            onClick={handleCompleteCurrentTask}
            className="p-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors"
            title="Marquer la tâche comme accomplie"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Streak / Sessions Footer */}
      <div className="mt-8 text-xs text-zinc-500 z-10 flex flex-wrap items-center justify-center gap-3">
        <span>
          Sessions aujourd'hui : <strong>{sessionsCompleted}</strong>
        </span>
        <span>•</span>
        <span>
          Temps cumulé : <strong>{sessionsCompleted * focusMinutes} min</strong>
        </span>
        {selectedTask?.estimatedMinutes && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1 text-indigo-400 font-medium">
              <Clock className="w-3 h-3" />
              Tâche estimée : {selectedTask.estimatedMinutes} min
            </span>
          </>
        )}
      </div>
    </div>
  );
};

