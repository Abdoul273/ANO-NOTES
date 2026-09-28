import { Task, UserHabits, DailyBriefing } from '../types';
import { hasApiServer } from './platform';
import { parseTaskText } from './nlp';
import { urgencyScore, quadrantOf } from './scoring';
import { isValidDate } from './dates';

// Dans l'app native compilée, il n'y a pas de serveur : on passe directement au mode local.
const post = async (url: string, body: unknown) => {
  if (!hasApiServer()) throw new Error('offline');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

export const callAiPrioritize = async (
  tasks: Task[],
  userHabits: UserHabits
): Promise<{ prioritizations: any[]; overallAnalysis: string }> => {
  try {
    const data = await post('/api/ai/prioritize', { tasks, userHabits, currentTime: new Date().toISOString() });
    if (!Array.isArray(data.prioritizations)) throw new Error('invalid');
    return { prioritizations: data.prioritizations, overallAnalysis: data.overallAnalysis || data.analysis || '' };
  } catch (err) {
    console.warn('Network / AI prioritize fallback:', err);
    // Intelligent client-side heuristic fallback
    const slot: Record<string, string> = {
      matin: 'Ce matin, pendant votre pic d\'énergie',
      aprem: 'Cet après-midi, pendant votre pic d\'énergie',
      soir: 'En soirée, pendant votre pic d\'énergie',
      nuit: 'En fin de journée, au calme',
    };
    const prioritizations = tasks.filter(t => !t.completed).map((t) => {
      const plain = { ...t, aiUrgencyScore: undefined, aiQuadrant: undefined };
      const score = urgencyScore(plain);
      const due = t.dueDate ? new Date(t.dueDate).getTime() - Date.now() : Infinity;
      return {
        taskId: t.id,
        newPriorityScore: score,
        quadrant: quadrantOf(plain),
        suggestedPriority: t.priority,
        suggestedSlot: due < 0 ? 'Immédiatement : l\'échéance est dépassée' : due < 86400000 ? 'Aujourd\'hui, avant l\'échéance' : slot[userHabits.energyPeak] || slot.matin,
        reasoning: due < 0 ? 'En retard : à traiter ou replanifier maintenant.'
          : due < 172800000 ? 'Échéance sous 48 h.'
          : t.priority === 'urgent' || t.priority === 'high' ? 'Importante : bloquez un créneau de concentration.'
          : 'Peut être regroupée avec d\'autres tâches rapides.',
      };
    });
    return {
      prioritizations,
      overallAnalysis: 'Priorisation calculée localement selon vos échéances, priorités et votre pic d\'énergie.',
    };
  }
};

export const callAiSmartReminders = async (
  task: Partial<Task>,
  userHabits: UserHabits
): Promise<{ reminders: any[]; coachingNote: string }> => {
  try {
    const data = await post('/api/ai/smart-reminders', { task, userHabits });
    const reminders = (data.reminders || data.recommendedReminders || []).filter((r: any) => isValidDate(r.time));
    if (!reminders.length) throw new Error('no valid reminders');
    return { reminders, coachingNote: data.coachingNote || data.advice || '' };
  } catch (err) {
    console.warn('Network / AI smart reminders fallback:', err);
    const now = Date.now();
    const due = task.dueDate ? new Date(task.dueDate).getTime() : NaN;
    const lead = Math.max(30, task.estimatedMinutes || 30) * 60000;
    const reminders = isNaN(due) || due < now
      ? [{ time: new Date(now + 2 * 3600000).toISOString(), label: 'Point d\'étape (dans 2 h)', reason: 'Aucune échéance future : un rappel pour s\'y mettre' }]
      : [
          { time: new Date(due - lead - 3600000).toISOString(), label: 'Commencer maintenant', reason: 'Laisse le temps estimé plus une heure de marge' },
          { time: new Date(due - 15 * 60000).toISOString(), label: 'Échéance dans 15 min', reason: 'Dernière vérification avant la limite' },
        ].filter(r => new Date(r.time).getTime() > now);
    return {
      reminders,
      coachingNote: 'Commencez par la plus petite étape concrète pour lancer l\'élan.',
    };
  }
};

export const callAiBreakdown = async (
  title: string,
  description: string
): Promise<{ subtasks: any[]; totalEstimatedMinutes: number; tip: string }> => {
  try {
    return await post('/api/ai/breakdown', { title, description });
  } catch (err) {
    console.warn('Network / AI breakdown fallback:', err);
    return {
      subtasks: [
        { title: `Définir le résultat clé de : ${title}`, estimatedMinutes: 15, difficulty: 'facile' },
        { title: 'Exécuter le bloc principal sans distraction', estimatedMinutes: 30, difficulty: 'moyen' },
        { title: 'Relire, valider et archiver', estimatedMinutes: 15, difficulty: 'facile' },
      ],
      totalEstimatedMinutes: 60,
      tip: 'Commencez par la plus petite étape pour briser l\'inertie.',
    };
  }
};

export const callAiNaturalParse = async (
  text: string,
  categories: { name: string }[] = []
): Promise<Partial<Task>> => {
  // L'analyse locale est instantanée et fiable pour les dates ; l'IA l'enrichit si elle répond.
  const local = parseTaskText(text, categories);
  const base: Partial<Task> = {
    title: local.title,
    priority: local.priority,
    dueDate: local.dueDate,
    estimatedMinutes: local.estimatedMinutes,
    tags: local.tags,
    category: local.category || categories[0]?.name || 'Travail',
  };
  try {
    const ai = await post('/api/ai/parse-natural', { text, currentTime: new Date().toISOString() });
    return {
      ...base,
      title: ai.title || base.title,
      description: ai.description || '',
      priority: ['urgent', 'high', 'medium', 'low'].includes(ai.priority) ? ai.priority : base.priority,
      dueDate: base.dueDate || (isValidDate(ai.dueDate) ? new Date(ai.dueDate).toISOString() : null),
      estimatedMinutes: Number(ai.estimatedMinutes) > 0 ? Number(ai.estimatedMinutes) : base.estimatedMinutes,
      tags: [...new Set([...(base.tags || []), ...(Array.isArray(ai.tags) ? ai.tags : [])])],
      category: local.category || categories.find(c => c.name === ai.category)?.name || base.category,
    };
  } catch {
    return base;
  }
};

export const callAiDailyBriefing = async (
  tasks: Task[],
  userHabits: UserHabits,
  completedTodayCount: number
): Promise<DailyBriefing> => {
  try {
    return { ...(await post('/api/ai/daily-briefing', { tasks, userHabits, completedTodayCount })), generatedAt: new Date().toISOString() };
  } catch (err) {
    console.warn('Network / AI briefing fallback:', err);
    const pending = tasks.filter(t => !t.completed).sort((a, b) => urgencyScore(b) - urgencyScore(a));
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const overdue = pending.filter(t => t.dueDate && new Date(t.dueDate).getTime() < Date.now()).length;
    const peak: Record<string, string> = { matin: 'ce matin', aprem: 'cet après-midi', soir: 'ce soir', nuit: 'en fin de journée' };
    return {
      greeting: `${greeting} ! ${pending.length} tâche(s) en cours${overdue ? `, dont ${overdue} en retard` : ''} · ${completedTodayCount} terminée(s) aujourd'hui.`,
      highlightFrog: pending[0]?.title || 'Tout est à jour : ajoutez votre prochaine victoire',
      energyAdvice: `Réservez vos ${userHabits.focusDuration} min de concentration les plus exigeantes ${peak[userHabits.energyPeak] || 'ce matin'}.`,
      motivationalQuote: 'La régularité bat l\'intensité : chaque tâche cochée libère de la clarté mentale.',
      generatedAt: new Date().toISOString(),
    };
  }
};
