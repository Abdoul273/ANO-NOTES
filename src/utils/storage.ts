import { Task, UserHabits, UserProfile, DailyBriefing } from '../types';

const STORAGE_KEYS = {
  TASKS: 'auratask_tasks_v1',
  HABITS: 'auratask_habits_v1',
  PROFILE: 'auratask_profile_v1',
  CATEGORIES: 'auratask_categories_v1',
  BRIEFING: 'auratask_briefing_v1',
  THEME: 'auratask_theme_v1',
  OFFLINE_QUEUE: 'auratask_offline_queue_v1',
};

export const DEFAULT_HABITS: UserHabits = {
  workHoursStart: '08:30',
  workHoursEnd: '18:00',
  energyPeak: 'matin',
  chronotype: 'alouette',
  focusDuration: 25,
  breakDuration: 5,
  notificationsEnabled: true,
  soundEnabled: true,
  autoPrioritize: true,
};

export const DEFAULT_CATEGORIES = [
  { id: 'cat_work', name: 'Travail', color: '#6366f1' },
  { id: 'cat_projets', name: 'Projets Stratégiques', color: '#8b5cf6' },
  { id: 'cat_client', name: 'Clients & Partenaires', color: '#06b6d4' },
  { id: 'cat_finance', name: 'Finance & Admin', color: '#10b981' },
  { id: 'cat_perso', name: 'Personnel & Santé', color: '#f59e0b' },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Finaliser la synthèse du rapport trimestriel Q3',
    description: 'Consolider les métriques clés de performance, les projections de croissance et les arbitrages budgétaires pour la direction.',
    priority: 'urgent',
    status: 'in_progress',
    category: 'Travail',
    dueDate: new Date(Date.now() + 6 * 3600000).toISOString(),
    estimatedMinutes: 60,
    timeSpentMinutes: 25,
    completed: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Stratégie', 'Rapport', 'Direction'],
    aiUrgencyScore: 94,
    aiQuadrant: 'q1_urgent_important',
    aiSlotRecommendation: 'Ce matin à 10:00 (Pic d\'énergie optimal)',
    aiReasoning: 'Échéance aujourd\'hui à fort impact sur la décision budgétaire.',
    subtasks: [
      { id: 'st-1', title: 'Extraire les graphiques financiers', completed: true, estimatedMinutes: 15 },
      { id: 'st-2', title: 'Rédiger l\'executive summary', completed: false, estimatedMinutes: 25 },
      { id: 'st-3', title: 'Relecture et mise en page PDF', completed: false, estimatedMinutes: 20 },
    ],
    smartReminders: [
      {
        id: 'rem-1',
        time: new Date(Date.now() + 2 * 3600000).toISOString(),
        label: 'Alerte d\'avancement intermédiaire',
        reason: 'Conserver 1h de marge avant l\'envoi final',
        triggered: false,
      },
    ],
    color: '#6366f1',
  },
  {
    id: 'task-2',
    title: 'Préparer la réunion d\'alignement équipe produit',
    description: 'Définir l\'ordre du jour, les objectifs des 2 prochaines semaines et le récapitulatif des blocages identifiés.',
    priority: 'high',
    status: 'todo',
    category: 'Projets Stratégiques',
    dueDate: new Date(Date.now() + 24 * 3600000).toISOString(),
    estimatedMinutes: 45,
    timeSpentMinutes: 0,
    completed: false,
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Equipe', 'Sprint', 'Roadmap'],
    aiUrgencyScore: 82,
    aiQuadrant: 'q2_not_urgent_important',
    aiSlotRecommendation: 'Demain matin dès 09:30',
    aiReasoning: 'Non urgent dans l\'heure mais essentiel pour la clarté du sprint.',
    subtasks: [
      { id: 'st-4', title: 'Collecter les inputs des leads', completed: false, estimatedMinutes: 20 },
      { id: 'st-5', title: 'Mettre à jour le tableau Kanban', completed: false, estimatedMinutes: 25 },
    ],
    smartReminders: [],
    color: '#8b5cf6',
  },
  {
    id: 'task-3',
    title: 'Audit de sécurité des accès et sauvegardes cloud',
    description: 'Vérifier la validité des protocoles de chiffrement et tester la restauration automatique des sauvegardes.',
    priority: 'medium',
    status: 'todo',
    category: 'Finance & Admin',
    dueDate: new Date(Date.now() + 72 * 3600000).toISOString(),
    estimatedMinutes: 30,
    timeSpentMinutes: 0,
    completed: false,
    createdAt: new Date(Date.now() - 120000000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Sécurité', 'Cloud'],
    aiUrgencyScore: 65,
    aiQuadrant: 'q2_not_urgent_important',
    aiSlotRecommendation: 'Jeudi après-midi en créneau calme',
    aiReasoning: 'Tâche préventive indispensable pour éviter tout risque de perte.',
    subtasks: [],
    smartReminders: [],
    color: '#10b981',
  },
  {
    id: 'task-4',
    title: 'Séance de déconnexion & marche en plein air',
    description: 'Pause régénératrice pour optimiser la créativité et préserver la concentration cognitive.',
    priority: 'low',
    status: 'done',
    category: 'Personnel & Santé',
    dueDate: new Date(Date.now() - 3600000 * 2).toISOString(),
    estimatedMinutes: 25,
    timeSpentMinutes: 25,
    completed: true,
    completedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Santé', 'Récupération'],
    aiUrgencyScore: 40,
    aiQuadrant: 'q4_not_urgent_not_important',
    subtasks: [],
    smartReminders: [],
    color: '#f59e0b',
  },
];

export const loadTasksFromStorage = (): Task[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      saveTasksToStorage(INITIAL_TASKS);
      return INITIAL_TASKS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load tasks:', e);
    return INITIAL_TASKS;
  }
};

export const saveTasksToStorage = (tasks: Task[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks:', e);
  }
};

export const loadHabitsFromStorage = (): UserHabits => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HABITS);
    if (!raw) return DEFAULT_HABITS;
    return { ...DEFAULT_HABITS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_HABITS;
  }
};

export const saveHabitsToStorage = (habits: UserHabits): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
  } catch (e) {
    console.error('Failed to save habits:', e);
  }
};

export const generateSyncCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = 'AURA-';
  for (let i = 0; i < 4; i++) res += chars[Math.floor(Math.random() * chars.length)];
  res += '-';
  for (let i = 0; i < 4; i++) res += chars[Math.floor(Math.random() * chars.length)];
  return res;
};

export const loadProfileFromStorage = (): UserProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  const defaultProfile: UserProfile = {
    name: 'Utilisateur Aura',
    email: '',
    syncCode: generateSyncCode(),
    autoSync: true,
  };
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(defaultProfile));
  } catch {
    // ignore
  }
  return defaultProfile;
};

export const saveProfileToStorage = (profile: UserProfile): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save profile:', e);
  }
};

export const loadCategoriesFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return DEFAULT_CATEGORIES;
};

export const saveCategoriesToStorage = (cats: any[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
  } catch {
    // ignore
  }
};

export const loadBriefingFromStorage = (): DailyBriefing | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BRIEFING);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
};

export const saveBriefingToStorage = (briefing: DailyBriefing) => {
  try {
    localStorage.setItem(STORAGE_KEYS.BRIEFING, JSON.stringify(briefing));
  } catch {
    // ignore
  }
};
