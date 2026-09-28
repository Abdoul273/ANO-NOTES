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

export const loadTasksFromStorage = (): Task[] => {
  try {
    // Pas de tâches de démonstration : elles finiraient aussi dans le panneau Caelestia.
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load tasks:', e);
    return [];
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
