export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done';
export type QuadrantType = 'q1_urgent_important' | 'q2_not_urgent_important' | 'q3_urgent_not_important' | 'q4_not_urgent_not_important';
export type Chronotype = 'alouette' | 'hibou' | 'regulier';
export type EnergyPeak = 'matin' | 'aprem' | 'soir' | 'nuit';
export type ViewMode = 'list' | 'kanban' | 'calendar' | 'matrix' | 'analytics' | 'focus';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes?: number;
}

export interface SmartReminder {
  id: string;
  time: string; // ISO date-time string
  label: string;
  reason?: string;
  triggered: boolean;
  notified?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  category: string;
  dueDate: string | null; // ISO string
  estimatedMinutes: number;
  timeSpentMinutes: number;
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  subtasks: SubTask[];
  smartReminders: SmartReminder[];
  aiUrgencyScore?: number; // 1 to 100
  aiQuadrant?: QuadrantType;
  aiSlotRecommendation?: string;
  aiReasoning?: string;
  color?: string;
}

export interface UserHabits {
  workHoursStart: string; // "09:00"
  workHoursEnd: string;   // "18:00"
  energyPeak: EnergyPeak;
  chronotype: Chronotype;
  focusDuration: number;  // 25
  breakDuration: number;  // 5
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  autoPrioritize: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  syncCode: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}

export interface DailyBriefing {
  greeting: string;
  highlightFrog: string;
  energyAdvice: string;
  motivationalQuote: string;
  generatedAt?: string;
}

export interface FilterOptions {
  search: string;
  category: string;
  priority: string;
  status: string;
  tag: string;
  viewTab: 'all' | 'today' | 'upcoming' | 'overdue' | 'completed' | 'ai_prioritized';
}
