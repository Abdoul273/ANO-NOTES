// Dates en heure locale : `toISOString()` renvoie l'heure UTC et décale les
// jours autour de minuit selon le fuseau.

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' dans le fuseau local. */
export const localDateKey = (value: Date | string | number): string => {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 'HH:MM' dans le fuseau local. */
export const localTimeKey = (value: Date | string | number): string => {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Date + heure saisies (heure locale) vers ISO. */
export const fromLocalInputs = (date: string, time?: string): string | null => {
  if (!date) return null;
  const d = new Date(`${date}T${time || '12:00'}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export const isValidDate = (value: unknown): boolean =>
  (typeof value === 'string' || typeof value === 'number') && !isNaN(new Date(value).getTime());

export const isSameLocalDay = (a: Date | string | number, b: Date | string | number = Date.now()) =>
  localDateKey(a) === localDateKey(b);

export const startOfLocalDay = (value: Date | number = Date.now()) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfLocalDay = (value: Date | number = Date.now()) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 0);
  return d;
};

/** Libellé court et humain pour une échéance : « Aujourd'hui 14:00 », « Demain », « lun. 12 oct. ». */
export const formatDue = (iso: string): string => {
  const d = new Date(iso);
  const today = startOfLocalDay();
  const day = startOfLocalDay(d);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = d.getHours() === 23 && d.getMinutes() === 59 ? '' : ` ${localTimeKey(d)}`;
  if (diff === 0) return `Aujourd'hui${time}`;
  if (diff === 1) return `Demain${time}`;
  if (diff === -1) return `Hier${time}`;
  if (diff > 1 && diff < 7) return `${d.toLocaleDateString('fr-FR', { weekday: 'long' })}${time}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })}${time}`;
};
