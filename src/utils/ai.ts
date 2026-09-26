import { Task, UserHabits, DailyBriefing } from '../types';

export const callAiPrioritize = async (
  tasks: Task[],
  userHabits: UserHabits
): Promise<{ prioritizations: any[]; overallAnalysis: string }> => {
  try {
    const res = await fetch('/api/ai/prioritize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks,
        userHabits,
        currentTime: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error('API prioritize failed');
    return await res.json();
  } catch (err) {
    console.warn('Network / AI prioritize fallback:', err);
    // Intelligent client-side heuristic fallback
    const prioritizations = tasks.map((t, idx) => {
      const pOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      const base = (pOrder[t.priority] || 2) * 22;
      const score = Math.min(99, Math.max(15, base + (10 - idx * 2)));
      return {
        taskId: t.id,
        newPriorityScore: score,
        quadrant: t.priority === 'urgent' ? 'q1_urgent_important' : (t.priority === 'high' ? 'q2_not_urgent_important' : 'q3_urgent_not_important'),
        suggestedPriority: t.priority,
        suggestedSlot: 'À traiter selon votre pic de concentration',
        reasoning: 'Priorisé localement (mode hors-ligne) selon les critères d\'urgence.',
      };
    });
    return {
      prioritizations,
      overallAnalysis: 'Priorisation calculée en mode local/hors-ligne selon la matrice d\'impact et vos délais.',
    };
  }
};

export const callAiSmartReminders = async (
  task: Partial<Task>,
  userHabits: UserHabits
): Promise<{ reminders: any[]; coachingNote: string }> => {
  try {
    const res = await fetch('/api/ai/smart-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, userHabits }),
    });
    if (!res.ok) throw new Error('API reminders failed');
    return await res.json();
  } catch (err) {
    console.warn('Network / AI smart reminders fallback:', err);
    const now = Date.now();
    return {
      reminders: [
        {
          time: new Date(now + 2 * 3600000).toISOString(),
          label: 'Rappel de concentration optimal (dans 2h)',
          reason: 'Aligné avec votre tranche horaire productive',
        },
        {
          time: new Date(now + 5 * 3600000).toISOString(),
          label: 'Alerte de vérification avant fin de journée',
          reason: 'Évite l\'accumulation en soirée',
        },
      ],
      coachingNote: 'Anticipez les blocages dès le début de votre session de travail.',
    };
  }
};

export const callAiBreakdown = async (
  title: string,
  description: string
): Promise<{ subtasks: any[]; totalEstimatedMinutes: number; tip: string }> => {
  try {
    const res = await fetch('/api/ai/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) throw new Error('API breakdown failed');
    return await res.json();
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

export const callAiNaturalParse = async (text: string): Promise<any> => {
  try {
    const res = await fetch('/api/ai/parse-natural', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, currentTime: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error('API parse natural failed');
    return await res.json();
  } catch (err) {
    console.warn('Network / AI parse natural fallback:', err);
    const isUrgent = /urgent|asap|important/i.test(text);
    return {
      title: text.replace(/urgent|demain|ce soir/gi, '').trim() || text,
      description: '',
      priority: isUrgent ? 'urgent' : 'medium',
      category: 'Travail',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      estimatedMinutes: 30,
      tags: ['Saisie-Rapide'],
    };
  }
};

export const callAiDailyBriefing = async (
  tasks: Task[],
  userHabits: UserHabits,
  completedTodayCount: number
): Promise<DailyBriefing> => {
  try {
    const res = await fetch('/api/ai/daily-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks, userHabits, completedTodayCount }),
    });
    if (!res.ok) throw new Error('API briefing failed');
    return await res.json();
  } catch (err) {
    console.warn('Network / AI briefing fallback:', err);
    const topPending = tasks.find(t => !t.completed);
    return {
      greeting: 'Bonjour ! Préparez une session de travail sereine et ciblée.',
      highlightFrog: topPending?.title || 'Choisissez votre première victoire du jour',
      energyAdvice: 'Accordez 45 minutes de concentration pure sans onglets ouverts dès ce matin.',
      motivationalQuote: 'La régularité bat l\'intensité : chaque tâche cochée libère de la clarté mentale.',
    };
  }
};
