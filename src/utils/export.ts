import { jsPDF } from 'jspdf';
import { Task } from '../types';
import { saveFile } from './platform';
import { localDateKey } from './dates';
import { urgencyScore, isUrgentNow } from './scoring';

const stamp = () => localDateKey(new Date());

// RFC 4180 CSV Export with Excel UTF-8 BOM
export const exportTasksToCSV = (tasks: Task[], filename = `auratask-${stamp()}.csv`) => {
  const headers = [
    'ID',
    'Titre',
    'Description',
    'Priorite',
    'Statut',
    'Categorie',
    'Echeance',
    'Temps Estime (min)',
    'Temps Passe (min)',
    'Complete',
    'Score Urgence',
    'Sous-taches',
    'Tags',
    'Cree le',
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = tasks.map(t => [
    escapeCSV(t.id),
    escapeCSV(t.title),
    escapeCSV(t.description),
    escapeCSV(t.priority),
    escapeCSV(t.status),
    escapeCSV(t.category),
    escapeCSV(t.dueDate ? new Date(t.dueDate).toLocaleString('fr-FR') : ''),
    escapeCSV(t.estimatedMinutes),
    escapeCSV(t.timeSpentMinutes),
    escapeCSV(t.completed ? 'Oui' : 'Non'),
    escapeCSV(urgencyScore(t)),
    escapeCSV((t.subtasks || []).map(s => `[${s.completed ? 'x' : ' '}] ${s.title}`).join(' | ')),
    escapeCSV((t.tags || []).join(', ')),
    escapeCSV(new Date(t.createdAt).toLocaleDateString('fr-FR')),
  ]);

  const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  return saveFile(filename, csvContent, 'text/csv;charset=utf-8');
};

// Elegant PDF Productivity Report using jsPDF
export const exportTasksToPDF = (tasks: Task[], title = 'Rapport de Productivité & Tâches') => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const urgent = tasks.filter(t => isUrgentNow(t)).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Header Banner
  doc.setFillColor(30, 27, 75); // Indigo dark
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('AURATASK AI', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(199, 210, 254);
  doc.text(title, 15, 29);

  doc.setFontSize(9);
  doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 15, 36);

  // KPI Cards
  const drawCard = (x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x + 6, y + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 6, y + 17);
  };

  drawCard(15, 48, 42, 22, 'Tâches Totales', String(total), [79, 70, 229]);
  drawCard(63, 48, 42, 22, 'Accomplies', `${completed} (${completionRate}%)`, [16, 185, 129]);
  drawCard(111, 48, 42, 22, 'En cours / En attente', String(pending), [59, 130, 246]);
  drawCard(159, 48, 42, 22, 'Urgences Critiques', String(urgent), [239, 68, 68]);

  // Section: Top Urgent & Prioritized Tasks
  let currentY = 78;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Tâches et Échéances Prioritaires', 15, currentY);

  currentY += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(15, currentY, 195, currentY);
  currentY += 8;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(15, currentY, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('STATUT', 18, currentY + 5.5);
  doc.text('TITRE DE LA TÂCHE', 40, currentY + 5.5);
  doc.text('CATÉGORIE', 120, currentY + 5.5);
  doc.text('PRIORITÉ', 152, currentY + 5.5);
  doc.text('ÉCHÉANCE', 174, currentY + 5.5);
  currentY += 9;

  // Render tasks
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return urgencyScore(b) - urgencyScore(a);
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  sorted.forEach((task) => {
    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }

    // Row zebra or line
    doc.setDrawColor(241, 245, 249);
    doc.line(15, currentY + 7, 195, currentY + 7);

    // Status pill text
    if (task.completed) {
      doc.setTextColor(16, 185, 129);
      doc.text('Terminé', 18, currentY + 5);
    } else {
      doc.setTextColor(79, 70, 229);
      doc.text(task.status === 'in_progress' ? 'En cours' : task.status === 'waiting' ? 'En attente' : 'À faire', 18, currentY + 5);
    }

    // Title (truncate if too long)
    doc.setTextColor(30, 41, 59);
    const shortTitle = task.title.length > 46 ? task.title.substring(0, 44) + '...' : task.title;
    doc.text(shortTitle, 40, currentY + 5);

    // Category
    doc.setTextColor(100, 116, 139);
    doc.text((task.category || 'Général').substring(0, 18), 120, currentY + 5);

    // Priority
    const pLabels: Record<string, string> = { urgent: 'URGENT', high: 'Haute', medium: 'Moyenne', low: 'Basse' };
    if (task.priority === 'urgent') doc.setTextColor(220, 38, 38);
    else if (task.priority === 'high') doc.setTextColor(234, 88, 12);
    else doc.setTextColor(100, 116, 139);
    doc.text(pLabels[task.priority] || task.priority, 152, currentY + 5);

    // Due Date
    doc.setTextColor(100, 116, 139);
    const dueStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '-';
    doc.text(dueStr, 174, currentY + 5);

    currentY += 8;
  });

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('AuraTask AI • Document confidentiel généré automatiquement • Compatible partage collaborateurs', 15, 287);

  return saveFile(`auratask-rapport-${stamp()}.pdf`, doc.output('arraybuffer'), 'application/pdf');
};

// Generates direct Google Calendar web event URL
export const createGoogleCalendarUrl = (task: Task): string => {
  const title = encodeURIComponent(task.title);
  const details = encodeURIComponent(
    `${task.description || ''}\n\nPriorité: ${task.priority}\nCatégorie: ${task.category}\nScore IA: ${task.aiUrgencyScore || 'N/A'}`
  );

  const start = task.dueDate ? new Date(task.dueDate) : new Date();
  const end = new Date(start.getTime() + (task.estimatedMinutes || 45) * 60000);

  const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const dates = `${formatGoogleDate(start)}/${formatGoogleDate(end)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
};

const icsEscape = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

export const buildIcs = (tasks: Task[]): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AuraTask AI//Calendar Sync//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:AuraTask Agenda',
  ];
  tasks.forEach(t => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    if (isNaN(d.getTime())) return;
    const end = new Date(d.getTime() + (t.estimatedMinutes || 60) * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:auratask-${t.id}@auratask.app`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(d)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(t.title)}`,
      `DESCRIPTION:${icsEscape(t.description || '')}`,
      `CATEGORIES:${icsEscape(t.category || '')}`,
      `STATUS:${t.completed ? 'COMPLETED' : 'CONFIRMED'}`,
      `PRIORITY:${t.priority === 'urgent' ? '1' : t.priority === 'high' ? '3' : t.priority === 'medium' ? '5' : '9'}`,
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const downloadIcsFile = (tasks: Task[], filename = `auratask-agenda-${stamp()}.ics`) =>
  saveFile(filename, buildIcs(tasks), 'text/calendar;charset=utf-8');

const icsUnescape = (value: string) =>
  value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// YYYYMMDD, YYYYMMDDTHHmmss (heure locale) ou YYYYMMDDTHHmmssZ (UTC)
const parseIcsDate = (value: string): string | null => {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  const date = h === undefined
    ? new Date(+y, +mo - 1, +d, 23, 59, 59)
    : z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)) : new Date(+y, +mo - 1, +d, +h, +mi);
  return isNaN(date.getTime()) ? null : date.toISOString();
};

// Import .ics : lignes repliées, paramètres (TZID, VALUE=DATE), UID stable pour éviter les doublons.
export const parseIcsFile = (content: string): Partial<Task>[] => {
  const events: Partial<Task>[] = [];
  const lines = content.replace(/\r?\n[ \t]/g, '').split(/\r\n|\n|\r/);
  let current: Record<string, string> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT' && current) {
      if (current.SUMMARY) {
        const start = current.DTSTART ? parseIcsDate(current.DTSTART) : null;
        const end = current.DTEND ? parseIcsDate(current.DTEND) : null;
        const minutes = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) : 0;
        const uid = (current.UID || '').replace(/^auratask-(.+)@auratask\.app$/, '$1');
        events.push({
          id: uid ? (uid === current.UID ? `ics_${uid}` : uid) : `ics_${Math.random().toString(36).slice(2, 11)}`,
          title: icsUnescape(current.SUMMARY),
          description: icsUnescape(current.DESCRIPTION || ''),
          dueDate: start,
          priority: 'medium',
          status: current.STATUS === 'COMPLETED' ? 'done' : 'todo',
          completed: current.STATUS === 'COMPLETED',
          category: 'Calendrier Importé',
          estimatedMinutes: minutes > 0 && minutes <= 24 * 60 ? minutes : 45,
          tags: ['Calendrier'],
        });
      }
      current = null;
    } else if (current) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).split(';')[0].toUpperCase();
      current[key] = line.slice(colon + 1);
    }
  }
  return events;
};
