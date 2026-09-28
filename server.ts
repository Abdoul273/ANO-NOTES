import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// `npm run dev -- --port 5173 --host 127.0.0.1` (lancé par `tauri dev`) doit être respecté.
const argValue = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const PORT = Number(argValue('port') || process.env.PORT || 3000);
const HOST = argValue('host') || process.env.HOST || '0.0.0.0';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '15mb' }));

// The browser and the Caelestia panel share this locked, local task store.
const taskStoreScript = path.resolve(__dirname, 'scripts/tasks_store.py');

function taskStore(command: 'read' | 'import' | 'apply', payload?: unknown): Promise<{ revision: number; tasks: any[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [taskStoreScript, command, '-']);
    let output = '';
    let error = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { output += chunk; });
    child.stderr.on('data', (chunk: string) => { error += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(error || `Task store exited with ${code}`));
      try { resolve(JSON.parse(output)); } catch (cause) { reject(cause); }
    });
    child.stdin.end(payload === undefined ? '' : JSON.stringify(payload));
  });
}

app.get('/api/local-tasks', async (_req, res) => {
  try { res.json(await taskStore('read')); }
  catch (error) { console.error('Task read failed:', error); res.status(500).json({ error: 'task_store_unavailable' }); }
});

app.post('/api/local-tasks/import', async (req, res) => {
  if (!Array.isArray(req.body?.tasks)) return res.status(400).json({ error: 'invalid_tasks' });
  try { res.json(await taskStore('import', req.body.tasks)); }
  catch (error) { console.error('Task import failed:', error); res.status(500).json({ error: 'task_store_unavailable' }); }
});

app.post('/api/local-tasks/apply', async (req, res) => {
  if (!Array.isArray(req.body?.operations)) return res.status(400).json({ error: 'invalid_operations' });
  try { res.json(await taskStore('apply', req.body.operations)); }
  catch (error) { console.error('Task update failed:', error); res.status(500).json({ error: 'task_store_unavailable' }); }
});

// Server-side Gemini API client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-memory multi-device cloud sync store (keyed by sync code or user session)
interface CloudBackup {
  tasks: any[];
  userProfile: any;
  categories: any[];
  updatedAt: string;
  checksum: string;
}

const cloudBackups = new Map<string, CloudBackup>();

// Sans clé Gemini, le client bascule sur ses calculs locaux (dates, priorités, briefing).
app.use('/api/ai', (_req, res, next) => {
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'ai_unavailable' });
  next();
});

// 1. AI Prioritization Endpoint
app.post('/api/ai/prioritize', async (req, res) => {
  try {
    const { tasks, userHabits, currentTime } = req.body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.json({ prioritizedTasks: [], analysis: 'Aucune tâche à prioriser.' });
    }

    const prompt = `Tu es un expert mondial en productivité personnelle et neuro-ergonomie de travail (méthodes Eisenhower, Getting Things Done, Time-Blocking).
Voici les habitudes de travail de l'utilisateur:
- Horaires actifs: ${userHabits?.workHoursStart || '09:00'} à ${userHabits?.workHoursEnd || '18:00'}
- Chronotype / Pic d'énergie: ${userHabits?.energyPeak || 'matin'} (Alouette du matin / Hibou du soir)
- Durée de focus préférée: ${userHabits?.focusDuration || 25} minutes
- Heure actuelle: ${currentTime || new Date().toISOString()}

Voici la liste des tâches actuelles:
${JSON.stringify(tasks.map(t => ({
  id: t.id,
  title: t.title,
  description: t.description,
  priority: t.priority,
  category: t.category,
  dueDate: t.dueDate,
  estimatedMinutes: t.estimatedMinutes,
  completed: t.completed,
  status: t.status,
})))}

Analysez intelligemment ces tâches, ré-évaluez leur urgence et leur importance réelle selon les habitudes et la charge mentale.
Retourne une réponse structurée en JSON contenant:
- prioritizations: tableau d'objets pour chaque tâche avec:
  - taskId: identifiant de la tâche
  - newPriorityScore: nombre de 1 à 100 (100 = urgence critique absolue à traiter immédiatement)
  - quadrant: une des valeurs: "q1_urgent_important", "q2_not_urgent_important", "q3_urgent_not_important", "q4_not_urgent_not_important"
  - suggestedPriority: "urgent", "high", "medium", ou "low"
  - suggestedSlot: conseil de créneau horaire ou moment optimal (ex: "Demain 09:30 lors de votre pic de concentration")
  - reasoning: courte explication percutante en français (1 phrase)
  - smartReminderTime: heure ISO recommandée pour un rappel personnalisé
- overallAnalysis: résumé stratégique en français (2-3 phrases) guidant l'utilisateur sur l'ordre optimal de sa journée.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prioritizations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  newPriorityScore: { type: Type.NUMBER },
                  quadrant: { type: Type.STRING },
                  suggestedPriority: { type: Type.STRING },
                  suggestedSlot: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  smartReminderTime: { type: Type.STRING },
                },
                required: ['taskId', 'newPriorityScore', 'quadrant', 'suggestedPriority', 'reasoning'],
              },
            },
            overallAnalysis: { type: Type.STRING },
          },
          required: ['prioritizations', 'overallAnalysis'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/prioritize:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de la priorisation IA' });
  }
});

// 2. AI Smart Reminders Endpoint
app.post('/api/ai/smart-reminders', async (req, res) => {
  try {
    const { task, userHabits } = req.body;
    if (!task) return res.status(400).json({ error: 'Tâche manquante' });

    const prompt = `Tu es un assistant de gestion du temps personnalisé.
Pour la tâche suivante:
Titre: "${task.title}"
Description: "${task.description || ''}"
Date d'échéance: "${task.dueDate || 'Non spécifiée'}"
Priorité: "${task.priority}"
Durée estimée: ${task.estimatedMinutes || 30} minutes

Habitudes de travail:
- Horaires: ${userHabits?.workHoursStart || '09:00'} - ${userHabits?.workHoursEnd || '18:00'}
- Pic de productivité: ${userHabits?.energyPeak || 'matin'}

Calcule 2 à 3 rappels intelligents hyper personnalisés tenant compte de la charge cognitive, du délai de préparation et des habitudes de travail.
Renvoie un JSON avec:
- reminders: tableau avec:
  - time: string ISO ou description relative de l'horaire
  - label: titre du rappel (ex: "Préparation préalable")
  - reason: justification brève
- coachingNote: conseil d'efficacité en 1 phrase`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reminders: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  label: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['time', 'label', 'reason'],
              },
            },
            coachingNote: { type: Type.STRING },
          },
          required: ['reminders', 'coachingNote'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/smart-reminders:', error);
    res.status(500).json({ error: error.message || 'Erreur rappel IA' });
  }
});

// 3. AI Task Breakdown (Décomposition intelligente)
app.post('/api/ai/breakdown', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Titre requis' });

    const prompt = `Décompose cette tâche complexe en 3 à 5 sous-tâches concrètes, actionnables et sans friction:
Titre: "${title}"
Description: "${description || ''}"

Renvoie un JSON contenant:
- subtasks: tableau avec 'title' (verbe d'action clair), 'estimatedMinutes' (nombre entier de minutes), 'difficulty' ('facile' | 'moyen' | 'intense')
- totalEstimatedMinutes: somme des durées
- tip: conseil pour démarrer sans procrastination`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subtasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  estimatedMinutes: { type: Type.NUMBER },
                  difficulty: { type: Type.STRING },
                },
                required: ['title', 'estimatedMinutes'],
              },
            },
            totalEstimatedMinutes: { type: Type.NUMBER },
            tip: { type: Type.STRING },
          },
          required: ['subtasks', 'totalEstimatedMinutes'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/breakdown:', error);
    res.status(500).json({ error: error.message || 'Erreur décomposition' });
  }
});

// 4. AI Natural Language Task Parser
app.post('/api/ai/parse-natural', async (req, res) => {
  try {
    const { text, currentTime } = req.body;
    if (!text) return res.status(400).json({ error: 'Texte requis' });

    const prompt = `Analyse cette saisie libre en langage naturel pour créer une tâche structurée:
Texte: "${text}"
Date et heure actuelles: ${currentTime || new Date().toISOString()}

Extrais les informations de manière intelligente:
- title: titre concis et clair
- description: détails ou contexte extrait (ou chaîne vide si aucun)
- priority: "urgent" | "high" | "medium" | "low"
- category: une catégorie appropriée (ex: "Travail", "Personnel", "Finance", "Santé", "Projet", "Urgent", "Appel", etc.)
- dueDate: date ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ) si mentionnée ou déduite (ex: "demain à 14h"), sinon null
- estimatedMinutes: estimation du temps en minutes (ex: 30)
- tags: tableau de mots-clés pertinents (1 à 3 tags sans le dièse)`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            priority: { type: Type.STRING },
            category: { type: Type.STRING },
            dueDate: { type: Type.STRING },
            estimatedMinutes: { type: Type.NUMBER },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'priority', 'category', 'estimatedMinutes'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/parse-natural:', error);
    res.status(500).json({ error: error.message || 'Erreur parsing langage naturel' });
  }
});

// 5. AI Daily Productivity Briefing (Coach Productif)
app.post('/api/ai/daily-briefing', async (req, res) => {
  try {
    const { tasks, userHabits, completedTodayCount } = req.body;

    const prompt = `Tu es un coach d'élite en productivité et bien-être mental.
L'utilisateur a:
- ${tasks?.length || 0} tâches en attente
- ${completedTodayCount || 0} tâches déjà accomplies aujourd'hui
- Habitude d'énergie: ${userHabits?.energyPeak || 'matin'}
- Horaires: ${userHabits?.workHoursStart || '09:00'} - ${userHabits?.workHoursEnd || '18:00'}

Liste des tâches urgentes/importantes:
${JSON.stringify((tasks || []).slice(0, 5).map((t: any) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate })))}

Rédige un briefing quotidien percutant, chaleureux, stimulant et ultra-précis:
- greeting: Salutation énergisante adaptée à l'heure
- highlightFrog: La tâche numéro 1 indispensable à "avaler" en premier (Eat That Frog) et pourquoi
- energyAdvice: Conseil d'allocation de concentration selon ses habitudes
- motivationalQuote: Citation percutante ou conseil court`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            greeting: { type: Type.STRING },
            highlightFrog: { type: Type.STRING },
            energyAdvice: { type: Type.STRING },
            motivationalQuote: { type: Type.STRING },
          },
          required: ['greeting', 'highlightFrog', 'energyAdvice', 'motivationalQuote'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/daily-briefing:', error);
    res.status(500).json({ error: error.message || 'Erreur briefing quotidien' });
  }
});

// 6. Multiplatform Cloud Sync & Secure Backup
app.post('/api/cloud-sync/backup', (req, res) => {
  try {
    const { syncCode, payload } = req.body;
    if (!syncCode || !payload) {
      return res.status(400).json({ error: 'Code de synchronisation ou données manquantes' });
    }

    const cleanCode = String(syncCode).trim().toUpperCase();
    const backupData: CloudBackup = {
      tasks: payload.tasks || [],
      userProfile: payload.userProfile || {},
      categories: payload.categories || [],
      updatedAt: new Date().toISOString(),
      checksum: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    cloudBackups.set(cleanCode, backupData);

    return res.json({
      success: true,
      syncCode: cleanCode,
      updatedAt: backupData.updatedAt,
      itemCount: backupData.tasks.length,
      message: 'Sauvegarde cloud sécurisée effectuée avec succès.',
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde cloud' });
  }
});

app.get('/api/cloud-sync/restore/:syncCode', (req, res) => {
  try {
    const syncCode = req.params.syncCode?.trim().toUpperCase();
    if (!syncCode || !cloudBackups.has(syncCode)) {
      return res.status(404).json({ error: 'Code de synchronisation introuvable ou expiré.' });
    }

    const data = cloudBackups.get(syncCode)!;
    return res.json({
      success: true,
      syncCode,
      data,
      message: 'Données synchronisées avec succès depuis le cloud.',
    });
  } catch (error: any) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération cloud' });
  }
});

// 7. Dynamic RFC 5545 iCalendar feed & sync
app.get('/api/calendar/feed.ics', (req, res) => {
  const syncCode = (req.query.code as string || '').trim().toUpperCase();
  const backup = syncCode ? cloudBackups.get(syncCode) : null;
  const tasks = backup ? backup.tasks : [];

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AuraTask AI//Productivity Engine//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:AuraTask AI Tasks',
    'X-WR-TIMEZONE:UTC',
  ];

  tasks.forEach((t: any) => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    const startStr = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endStr = new Date(d.getTime() + (t.estimatedMinutes || 60) * 60000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:auratask-${t.id}@auratask.app`);
    ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    ics.push(`DTSTART:${startStr}`);
    ics.push(`DTEND:${endStr}`);
    ics.push(`SUMMARY:${(t.title || 'Tâche').replace(/[\r\n]/g, ' ')}`);
    ics.push(`DESCRIPTION:${(t.description || '').replace(/[\r\n]/g, '\\n')}`);
    ics.push(`STATUS:${t.completed ? 'COMPLETED' : 'CONFIRMED'}`);
    ics.push(`PRIORITY:${t.priority === 'urgent' ? '1' : (t.priority === 'high' ? '2' : '5')}`);
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="auratask-calendar.ics"');
  res.send(ics.join('\r\n'));
});

// Dev vs Prod Vite Integration
if (!isProd) {
  // Dynamic import of Vite for development server
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`🚀 AuraTask AI server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
