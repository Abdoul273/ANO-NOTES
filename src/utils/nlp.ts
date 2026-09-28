// Analyseur local de saisie rapide en français, sans réseau.
// ex. « Appeler Paul demain 14h30 !! #client @Travail 20min »
import { Priority, Task } from '../types';

export interface ParsedTask {
  title: string;
  priority: Priority;
  dueDate: string | null;
  estimatedMinutes: number;
  tags: string[];
  category: string | null;
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CATEGORY_HINTS: [RegExp, string[]][] = [
  [/\b(client|partenaire|prospect|devis|rdv client)\b/, ['client', 'partenaire']],
  [/\b(facture|payer|paiement|impots?|banque|compta|budget|loyer|admin)\b/, ['finance', 'admin']],
  [/\b(sport|medecin|dentiste|pharmacie|courses|famille|anniversaire|sante|gym|footing|marche)\b/, ['perso', 'sante']],
  [/\b(projet|roadmap|strategie|prototype|lancement)\b/, ['projet']],
  [/\b(reunion|mail|email|rapport|presentation|dossier|travail|boulot)\b/, ['travail']],
];

export const parseTaskText = (
  input: string,
  categories: { name: string }[] = [],
  now = new Date()
): ParsedTask => {
  let text = ` ${input.normalize('NFC').trim()} `;
  let priority: Priority = 'medium';
  let estimatedMinutes = 30;
  const tags: string[] = [];
  let category: string | null = null;
  let day: Date | null = null;
  let hour: number | null = null;
  let minute = 0;
  let defaultHour: number | null = null;

  // Retire un motif (insensible aux accents) et renvoie la correspondance.
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = fold(text).match(re);
    if (!m || m.index === undefined) return null;
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
    return m;
  };
  const startOfToday = () => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (n: number) => { const d = startOfToday(); d.setDate(d.getDate() + n); return d; };

  // Tags et catégorie explicites
  for (const m of [...input.matchAll(/(^|\s)#([\p{L}\p{N}_-]+)/gu)]) tags.push(m[2]);
  text = text.replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, ' ');
  const at = text.match(/(^|\s)@([\p{L}\p{N}&_-]+)/u);
  if (at) {
    const wanted = fold(at[2]);
    category = categories.find(c => fold(c.name).startsWith(wanted))?.name
      ?? categories.find(c => fold(c.name).includes(wanted))?.name ?? at[2];
    text = text.replace(at[0], ' ');
  }

  // Priorité : « !! », « !urgent », « urgent », « asap » ; « ! », « !haute », « important » ; « !basse »
  if (take(/\s(!!|!urgente?|urgente?|asap|au plus vite)(?=\s)/)) priority = 'urgent';
  else if (take(/\s(!basse?|!low|pas urgent)(?=\s)/)) priority = 'low';
  else if (take(/\s(!haute?|!high|!|importante?|prioritaire)(?=\s)/)) priority = 'high';

  // Durée : « 20min », « pendant 2h », « 1h30 de travail »
  const dur = take(/\s(?:pendant|duree|environ|~)?\s*(\d+)\s*(?:min|minutes?|mn)(?=\s)/)
    ?? take(/\s(?:pendant|duree|environ|~)\s*(\d+)\s*h(?:eures?)?\s*(\d{1,2})?(?=\s)/);
  if (dur) estimatedMinutes = dur[0].includes('min') || dur[0].includes('mn')
    ? Number(dur[1]) : Number(dur[1]) * 60 + Number(dur[2] || 0);

  // Jour
  let m: RegExpMatchArray | null;
  if (take(/\s(apres-demain|apres demain)(?=\s)/)) day = addDays(2);
  else if (take(/\s(demain)(?=\s)/)) day = addDays(1);
  else if (take(/\s(aujourd'hui|aujourd’hui|auj)(?=\s)/)) day = addDays(0);
  else if ((m = take(/\sce (soir|matin)(?=\s)|\s(cet? (?:apres-midi|aprem))(?=\s)|\s(ce midi)(?=\s)/))) {
    day = addDays(0);
    defaultHour = m[1] === 'soir' ? 20 : m[1] === 'matin' ? 9 : m[3] ? 12 : 14;
  } else if ((m = take(/\sdans (\d+) (jours?|semaines?|mois|heures?|h|minutes?|min)(?=\s)/))) {
    const n = Number(m[1]);
    const unit = m[2];
    if (unit.startsWith('jour')) day = addDays(n);
    else if (unit.startsWith('semaine')) day = addDays(7 * n);
    else if (unit === 'mois') { day = startOfToday(); day.setMonth(day.getMonth() + n); }
    else {
      const t = new Date(now.getTime() + n * (unit.startsWith('h') ? 3600000 : 60000));
      day = new Date(t); day.setHours(0, 0, 0, 0);
      hour = t.getHours(); minute = t.getMinutes();
    }
  } else if (take(/\s(la )?semaine prochaine(?=\s)/)) {
    day = addDays(((8 - now.getDay()) % 7) || 7);
  } else if (take(/\s(ce )?(week-?end|fin de semaine)(?=\s)/)) {
    day = addDays((6 - now.getDay() + 7) % 7);
  } else if ((m = take(new RegExp(`\\s(?:ce |le )?(${DAYS.join('|')})(?: prochain)?(?=\\s)`)))) {
    const target = DAYS.indexOf(m[1]);
    day = addDays(((target - now.getDay() + 7) % 7) || 7);
  } else if ((m = take(/\s(?:le )?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s)/))) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : now.getFullYear();
    day = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (!m[3] && day < startOfToday()) day.setFullYear(year + 1);
  } else if ((m = take(new RegExp(`\\s(?:le )?(\\d{1,2})(?:er)? (${MONTHS.join('|')})(?: (\\d{4}))?(?=\\s)`)))) {
    const year = m[3] ? Number(m[3]) : now.getFullYear();
    day = new Date(year, MONTHS.indexOf(m[2]), Number(m[1]));
    if (!m[3] && day < startOfToday()) day.setFullYear(year + 1);
  }

  // Heure : « à 14h », « 14h30 », « 14:30 », « midi », « minuit »
  if (hour === null) {
    if ((m = take(/\s(?:a |vers |avant )?(\d{1,2})(?:h|:)(\d{2})?(?=\s)/)) && Number(m[1]) < 24) {
      hour = Number(m[1]); minute = Number(m[2] || 0);
    } else if (take(/\s(?:a )?midi(?=\s)/)) hour = 12;
    else if (take(/\s(?:a )?minuit(?=\s)/)) { hour = 23; minute = 59; }
    else if (defaultHour !== null) hour = defaultHour;
  }

  let dueDate: string | null = null;
  if (day || hour !== null) {
    const due = day ? new Date(day) : startOfToday();
    if (hour !== null) due.setHours(hour, minute, 0, 0);
    else due.setHours(23, 59, 59, 0); // jour sans heure, comme le panneau
    // Une heure seule déjà passée vise le lendemain.
    if (!day && due.getTime() < now.getTime()) due.setDate(due.getDate() + 1);
    dueDate = due.toISOString();
  }

  // Titre : on retire les mots de liaison restés en bout de phrase.
  let title = text.replace(/\s+/g, ' ').trim()
    .replace(/(\s(pour|a|à|le|la|avant|de|d'|et|vers|ce|cet|cette))+$/i, '')
    .replace(/^((pour|a|à|le|la|de)\s)+/i, '')
    .trim();
  if (!title) title = input.trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);

  if (!category && categories.length) {
    const folded = fold(title);
    for (const [re, keys] of CATEGORY_HINTS) {
      if (!re.test(folded)) continue;
      const found = categories.find(c => keys.some(k => fold(c.name).includes(k)));
      if (found) { category = found.name; break; }
    }
  }

  return { title, priority, dueDate, estimatedMinutes, tags, category };
};

/** Tâche complète et valide à partir de champs partiels. */
export const makeTask = (partial: Partial<Task>): Task => {
  const now = new Date().toISOString();
  return {
    id: partial.id || `task_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    title: partial.title?.trim() || 'Nouvelle tâche',
    description: partial.description || '',
    priority: (['urgent', 'high', 'medium', 'low'] as const).includes(partial.priority as Priority)
      ? partial.priority as Priority : 'medium',
    status: partial.status || (partial.completed ? 'done' : 'todo'),
    category: partial.category || 'Travail',
    dueDate: partial.dueDate && !isNaN(new Date(partial.dueDate).getTime()) ? partial.dueDate : null,
    estimatedMinutes: Number(partial.estimatedMinutes) > 0 ? Number(partial.estimatedMinutes) : 30,
    timeSpentMinutes: Number(partial.timeSpentMinutes) || 0,
    completed: !!partial.completed,
    completedAt: partial.completed ? partial.completedAt || now : null,
    createdAt: partial.createdAt || now,
    updatedAt: now,
    tags: Array.isArray(partial.tags) ? partial.tags : [],
    subtasks: Array.isArray(partial.subtasks) ? partial.subtasks : [],
    smartReminders: Array.isArray(partial.smartReminders) ? partial.smartReminders : [],
    ...(partial.color ? { color: partial.color } : {}),
    ...(partial.aiUrgencyScore !== undefined ? { aiUrgencyScore: partial.aiUrgencyScore } : {}),
    ...(partial.aiQuadrant ? { aiQuadrant: partial.aiQuadrant } : {}),
    ...(partial.aiSlotRecommendation ? { aiSlotRecommendation: partial.aiSlotRecommendation } : {}),
    ...(partial.aiReasoning ? { aiReasoning: partial.aiReasoning } : {}),
  };
};
