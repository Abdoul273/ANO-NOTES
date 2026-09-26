import { jsPDF } from 'jspdf';
import { Task } from '../types';

// RFC 4180 CSV Export with Excel UTF-8 BOM
export const exportTasksToCSV = (tasks: Task[], filename = 'auratask-export.csv') => {
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
    'Score Urgence IA',
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
    escapeCSV(t.aiUrgencyScore || ''),
    escapeCSV(t.subtasks.map(s => `[${s.completed ? 'x' : ' '}] ${s.title}`).join(' | ')),
    escapeCSV(t.tags.join(', ')),
    escapeCSV(new Date(t.createdAt).toLocaleDateString('fr-FR')),
  ]);

  const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  const urgent = tasks.filter(t => !t.completed && (t.priority === 'urgent' || (t.aiUrgencyScore || 0) >= 80)).length;
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
    return (b.aiUrgencyScore || 0) - (a.aiUrgencyScore || 0);
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  sorted.slice(0, 18).forEach((task) => {
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
      doc.text(task.status === 'in_progress' ? 'En cours' : 'À faire', 18, currentY + 5);
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

  doc.save('auratask-rapport-productivite.pdf');
};

// Generates direct Google Calendar web event URL
export const createGoogleCalendarUrl = (task: Task): string => {
  const title = encodeURIComponent(task.title);
  const details = encodeURIComponent(
    `${task.description || ''}\n\nPriorité: ${task.priority}\nCatégorie: ${task.category}\nScore IA: ${task.aiUrgencyScore || 'N/A'}\nLien AuraTask: https://auratask.app`
  );

  const start = task.dueDate ? new Date(task.dueDate) : new Date();
  const end = new Date(start.getTime() + (task.estimatedMinutes || 45) * 60000);

  const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const dates = `${formatGoogleDate(start)}/${formatGoogleDate(end)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
};

// Download iCalendar .ics file directly in browser
export const downloadIcsFile = (tasks: Task[], filename = 'auratask-agenda.ics') => {
  let lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AuraTask AI//Calendar Sync//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:AuraTask Agenda',
    'X-WR-TIMEZONE:UTC',
  ];

  tasks.forEach(t => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    const startStr = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endStr = new Date(d.getTime() + (t.estimatedMinutes || 60) * 60000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:auratask-${t.id}@auratask.app`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    lines.push(`DTSTART:${startStr}`);
    lines.push(`DTEND:${endStr}`);
    lines.push(`SUMMARY:${t.title.replace(/[\r\n]/g, ' ')}`);
    lines.push(`DESCRIPTION:${(t.description || '').replace(/[\r\n]/g, '\\n')}`);
    lines.push(`STATUS:${t.completed ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push(`PRIORITY:${t.priority === 'urgent' ? '1' : (t.priority === 'high' ? '2' : '5')}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Simple parser for importing .ics files
export const parseIcsFile = (content: string): Partial<Task>[] => {
  const events: Partial<Task>[] = [];
  const lines = content.split(/\r\n|\n|\r/);
  let currentEvent: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.summary) {
        events.push({
          id: 'ics_' + Math.random().toString(36).substring(2, 9),
          title: currentEvent.summary,
          description: currentEvent.description || '',
          dueDate: currentEvent.dtstart || new Date().toISOString(),
          priority: 'medium',
          status: 'todo',
          category: 'Calendrier Importé',
          estimatedMinutes: 45,
          timeSpentMinutes: 0,
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subtasks: [],
          smartReminders: [],
          tags: ['Calendrier'],
        });
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8);
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12).replace(/\\n/g, '\n');
      } else if (line.startsWith('DTSTART')) {
        const val = line.split(':')[1];
        if (val) {
          // Parse YYYYMMDDTHHmmssZ or YYYYMMDD
          if (val.length >= 8) {
            const year = parseInt(val.substring(0, 4));
            const month = parseInt(val.substring(4, 6)) - 1;
            const day = parseInt(val.substring(6, 8));
            const hour = val.length >= 13 ? parseInt(val.substring(9, 11)) : 9;
            const min = val.length >= 15 ? parseInt(val.substring(11, 13)) : 0;
            currentEvent.dtstart = new Date(Date.UTC(year, month, day, hour, min)).toISOString();
          }
        }
      }
    }
  }

  return events;
};
