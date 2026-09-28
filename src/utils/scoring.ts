import { Task, QuadrantType } from '../types';

const PRIORITY_BASE: Record<string, number> = { urgent: 70, high: 55, medium: 40, low: 25 };
const HOUR = 3600000;

export const isOverdue = (t: Task, now = Date.now()) =>
  !t.completed && !!t.dueDate && new Date(t.dueDate).getTime() < now;

/** Score d'urgence local (1-99) : priorité + proximité de l'échéance + statut.
 *  Une analyse IA, si elle existe, est mélangée au calcul local pour rester à jour. */
export const urgencyScore = (t: Task, now = Date.now()): number => {
  let score = PRIORITY_BASE[t.priority] ?? 40;
  if (t.dueDate) {
    const left = new Date(t.dueDate).getTime() - now;
    if (left < 0) score += 30;
    else if (left < 24 * HOUR) score += 22;
    else if (left < 48 * HOUR) score += 15;
    else if (left < 7 * 24 * HOUR) score += 7;
  }
  if (t.status === 'in_progress') score += 5;
  if (t.status === 'waiting') score -= 10;
  if (typeof t.aiUrgencyScore === 'number') score = 0.6 * t.aiUrgencyScore + 0.4 * score;
  return Math.max(1, Math.min(99, Math.round(score)));
};

export const isUrgentNow = (t: Task, now = Date.now()) =>
  !t.completed && (t.priority === 'urgent' || isOverdue(t, now) || urgencyScore(t, now) >= 80);

/** Quadrant d'Eisenhower : urgence = échéance < 48 h (ou priorité urgente), importance = priorité haute/urgente. */
export const quadrantOf = (t: Task, now = Date.now()): QuadrantType => {
  if (t.aiQuadrant) return t.aiQuadrant;
  const important = t.priority === 'urgent' || t.priority === 'high';
  const urgent = t.priority === 'urgent' ||
    (!!t.dueDate && new Date(t.dueDate).getTime() - now < 48 * HOUR);
  if (urgent && important) return 'q1_urgent_important';
  if (important) return 'q2_not_urgent_important';
  if (urgent) return 'q3_urgent_not_important';
  return 'q4_not_urgent_not_important';
};

export const QUADRANT_PRIORITY: Record<QuadrantType, Task['priority']> = {
  q1_urgent_important: 'urgent',
  q2_not_urgent_important: 'high',
  q3_urgent_not_important: 'medium',
  q4_not_urgent_not_important: 'low',
};
