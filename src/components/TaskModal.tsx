import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  Tag,
  Plus,
  Trash2,
  Bell,
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle,
  FolderOpen,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Task, Priority, TaskStatus, SubTask, SmartReminder, UserHabits } from '../types';
import { callAiBreakdown, callAiSmartReminders } from '../utils/ai';
import { createGoogleCalendarUrl } from '../utils/export';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  taskToEdit?: Task | null;
  categories: { id: string; name: string; color: string }[];
  userHabits: UserHabits;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  taskToEdit,
  categories,
  userHabits,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [category, setCategory] = useState(categories[0]?.name || 'Travail');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('17:00');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [smartReminders, setSmartReminders] = useState<SmartReminder[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [isGeneratingReminders, setIsGeneratingReminders] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  // Check speech synthesis support and handle cleanup
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechSupported(false);
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setCategory(taskToEdit.category || categories[0]?.name || 'Travail');
      if (taskToEdit.dueDate) {
        const d = new Date(taskToEdit.dueDate);
        setDueDate(d.toISOString().substring(0, 10));
        setDueTime(d.toTimeString().substring(0, 5));
      } else {
        setDueDate('');
        setDueTime('17:00');
      }
      setEstimatedMinutes(taskToEdit.estimatedMinutes || 30);
      setSubtasks(taskToEdit.subtasks || []);
      setSmartReminders(taskToEdit.smartReminders || []);
      setTags(taskToEdit.tags || []);
    } else {
      // Default clean task
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
      setCategory(categories[0]?.name || 'Travail');
      const tomorrow = new Date(Date.now() + 86400000);
      setDueDate(tomorrow.toISOString().substring(0, 10));
      setDueTime('17:00');
      setEstimatedMinutes(30);
      setSubtasks([]);
      setSmartReminders([]);
      setTags([]);
    }
  }, [taskToEdit, isOpen]);

  if (!isOpen) return null;

  // Text-to-Speech (TTS) reading function
  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    const priorityLabels: Record<string, string> = {
      urgent: 'urgente',
      high: 'haute',
      medium: 'moyenne',
      low: 'basse',
    };

    const statusLabels: Record<string, string> = {
      todo: 'À faire',
      in_progress: 'En cours',
      waiting: 'En attente',
      done: 'Terminé',
    };

    let speechText = `Tâche : ${title || 'Sans titre'}. `;
    speechText += `Priorité : ${priorityLabels[priority] || priority}. `;
    speechText += `Statut : ${statusLabels[status] || status}. `;
    speechText += `Catégorie : ${category}. `;

    if (dueDate) {
      const formattedDate = new Date(`${dueDate}T${dueTime || '12:00'}:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      speechText += `Échéance fixée au ${formattedDate} à ${dueTime}. `;
    }

    if (estimatedMinutes) {
      speechText += `Durée estimée : ${estimatedMinutes} minutes. `;
    }

    if (description && description.trim()) {
      speechText += `Détails : ${description.trim()}. `;
    }

    if (subtasks && subtasks.length > 0) {
      const doneCount = subtasks.filter((s) => s.completed).length;
      speechText += `Elle comprend ${subtasks.length} sous-tâches, dont ${doneCount} déjà terminées. `;
      const pendingSubtasks = subtasks.filter((s) => !s.completed);
      if (pendingSubtasks.length > 0) {
        speechText += `Prochaines étapes : ${pendingSubtasks.map((s) => s.title).join(', ')}. `;
      }
    }

    if (smartReminders && smartReminders.length > 0) {
      speechText += `${smartReminders.length} rappel personnalisé configuré. `;
    }

    if (taskToEdit?.aiReasoning) {
      speechText += `Conseil de productivité : ${taskToEdit.aiReasoning}. `;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Use French voice if available
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find((v) => v.lang.startsWith('fr') || v.lang === 'fr_FR');
    if (frVoice) {
      utterance.voice = frVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleCloseModal = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    onClose();
  };

  // AI Breakdown trigger
  const handleAiBreakdown = async () => {
    if (!title.trim()) return;
    setIsBreakingDown(true);
    try {
      const res = await callAiBreakdown(title, description);
      if (res.subtasks && res.subtasks.length > 0) {
        const createdSubtasks: SubTask[] = res.subtasks.map((st: any) => ({
          id: 'st_' + Math.random().toString(36).substring(2, 8),
          title: st.title,
          completed: false,
          estimatedMinutes: st.estimatedMinutes || 15,
        }));
        setSubtasks((prev) => [...prev, ...createdSubtasks]);
        if (res.totalEstimatedMinutes) {
          setEstimatedMinutes(res.totalEstimatedMinutes);
        }
      }
    } catch (err) {
      console.error('Breakdown error:', err);
    } finally {
      setIsBreakingDown(false);
    }
  };

  // AI Smart Reminders trigger
  const handleAiReminders = async () => {
    if (!title.trim()) return;
    setIsGeneratingReminders(true);
    try {
      const constructedDue = dueDate ? new Date(`${dueDate}T${dueTime || '12:00'}:00`).toISOString() : null;
      const res = await callAiSmartReminders(
        { title, description, priority, dueDate: constructedDue, estimatedMinutes },
        userHabits
      );
      if (res.reminders && res.reminders.length > 0) {
        const created: SmartReminder[] = res.reminders.map((r: any) => ({
          id: 'rem_' + Math.random().toString(36).substring(2, 8),
          time: r.time,
          label: r.label,
          reason: r.reason,
          triggered: false,
        }));
        setSmartReminders(created);
      }
    } catch (err) {
      console.error('Smart reminders error:', err);
    } finally {
      setIsGeneratingReminders(false);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: 'st_' + Math.random().toString(36).substring(2, 8),
        title: newSubtaskTitle.trim(),
        completed: false,
      },
    ]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleDeleteSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const clean = newTag.trim().replace(/^#/, '');
    if (!tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setNewTag('');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToDelete));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const constructedDue = dueDate ? new Date(`${dueDate}T${dueTime || '12:00'}:00`).toISOString() : null;
    const catColor = categories.find((c) => c.name === category)?.color || '#6366f1';

    const savedTask: Task = {
      id: taskToEdit ? taskToEdit.id : 'task_' + Date.now(),
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      category,
      dueDate: constructedDue,
      estimatedMinutes: Number(estimatedMinutes) || 30,
      timeSpentMinutes: taskToEdit?.timeSpentMinutes || 0,
      completed: status === 'done',
      completedAt: status === 'done' ? (taskToEdit?.completedAt || new Date().toISOString()) : null,
      createdAt: taskToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags,
      subtasks,
      smartReminders,
      aiUrgencyScore: taskToEdit?.aiUrgencyScore || (priority === 'urgent' ? 90 : priority === 'high' ? 75 : 50),
      aiQuadrant: taskToEdit?.aiQuadrant || (priority === 'urgent' ? 'q1_urgent_important' : 'q2_not_urgent_important'),
      aiSlotRecommendation: taskToEdit?.aiSlotRecommendation,
      aiReasoning: taskToEdit?.aiReasoning,
      color: catColor,
    };

    onSave(savedTask);
    handleCloseModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 text-zinc-900 dark:text-zinc-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <h3 className="font-bold text-base sm:text-lg">
              {taskToEdit ? 'Modifier la tâche' : 'Créer une tâche intelligente'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Text-to-Speech (TTS) Button */}
            {speechSupported && (
              <button
                type="button"
                onClick={handleToggleSpeech}
                title={isSpeaking ? 'Arrêter la lecture vocale' : 'Écouter la tâche à haute voix (Synthèse vocale)'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isSpeaking
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 shadow-sm shadow-rose-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Arrêter</span>
                    <span className="flex items-end gap-0.5 h-3 ml-0.5">
                      <span className="w-0.5 h-3 bg-rose-500 animate-pulse rounded-full" />
                      <span className="w-0.5 h-2 bg-rose-500 animate-pulse delay-75 rounded-full" />
                      <span className="w-0.5 h-3.5 bg-rose-500 animate-pulse delay-150 rounded-full" />
                    </span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="hidden sm:inline">Lire à voix haute</span>
                    <span className="sm:hidden">Écouter</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleCloseModal}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Titre de la tâche *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Rédiger le rapport d'audit et préparer la présentation"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Détails & Objectif
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajoutez des notes, le contexte ou les livrables attendus..."
              rows={3}
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
            />
          </div>

          {/* Priority & Status & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Priorité
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 Haute</option>
                <option value="medium">🔵 Moyenne</option>
                <option value="low">⚪ Basse</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="todo">À faire</option>
                <option value="in_progress">En cours</option>
                <option value="waiting">En attente</option>
                <option value="done">Terminé</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date, Time & Estimated Minutes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Date d'échéance
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
              </input>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Heure limite
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Durée estimée (min)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* Subtasks Section with AI Breakdown */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <span>Sous-tâches & Étapes</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  {subtasks.filter((s) => s.completed).length}/{subtasks.length}
                </span>
              </label>

              {/* AI Breakdown Button */}
              <button
                type="button"
                onClick={handleAiBreakdown}
                disabled={isBreakingDown || !title.trim()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 transition-all disabled:opacity-40"
              >
                {isBreakingDown ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>Décomposer avec l'IA</span>
              </button>
            </div>

            {/* Subtask items */}
            <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs"
                >
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={st.completed}
                      onChange={() => handleToggleSubtask(st.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={`truncate ${st.completed ? 'line-through text-zinc-400' : ''}`}>
                      {st.title}
                    </span>
                  </label>
                  {st.estimatedMinutes && (
                    <span className="text-[10px] text-zinc-400 mr-2 shrink-0">{st.estimatedMinutes}m</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(st.id)}
                    className="text-zinc-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Fast add subtask input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Ajouter une sous-étape..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-medium"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Smart Reminders Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-indigo-500" />
                <span>Rappels Personnalisés</span>
              </label>

              <button
                type="button"
                onClick={handleAiReminders}
                disabled={isGeneratingReminders || !title.trim()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-all disabled:opacity-40"
              >
                {isGeneratingReminders ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>Suggérer des rappels IA</span>
              </button>
            </div>

            {smartReminders.length > 0 ? (
              <div className="space-y-1.5">
                {smartReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200"
                  >
                    <div>
                      <span className="font-semibold">{rem.label}</span>
                      {rem.reason && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{rem.reason}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500">
                      {new Date(rem.time).toLocaleTimeString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400 italic">
                Aucun rappel configuré. Cliquez sur « Suggérer des rappels IA » pour adapter selon vos heures de travail.
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Étiquettes (Tags)
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag)}
                    className="text-zinc-400 hover:text-rose-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Ajouter un tag (ex: Finance, Client)..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-medium"
              >
                Ajouter
              </button>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {taskToEdit && taskToEdit.dueDate && (
              <a
                href={createGoogleCalendarUrl(taskToEdit)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-500 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Synchroniser Google Calendar</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all"
            >
              {taskToEdit ? 'Mettre à jour' : 'Créer la tâche'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
