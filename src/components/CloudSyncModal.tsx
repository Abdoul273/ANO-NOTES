import React, { useState } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  Copy,
  RefreshCw,
  HardDrive,
  Download,
  Upload,
  Loader2,
  Monitor,
} from 'lucide-react';
import { UserProfile, Task } from '../types';
import { hasApiServer, saveFile } from '../utils/platform';
import { localDateKey } from '../utils/dates';
import { toast } from './Toaster';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  tasks: Task[];
  categories: any[];
  onRestoreData: (backupData: any) => void;
  onUpdateProfile: (profile: UserProfile) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  profile,
  tasks,
  categories,
  onRestoreData,
  onUpdateProfile,
}) => {
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [copied, setCopied] = useState(false);
  const server = hasApiServer();

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Copie impossible.', { tone: 'error' });
    }
  };

  // Sauvegarde complète dans un fichier JSON
  const handleFileBackup = async () => {
    const payload = { app: 'AuraTask', version: 1, exportedAt: new Date().toISOString(), tasks, categories };
    try {
      if (await saveFile(`auratask-sauvegarde-${localDateKey(new Date())}.json`, JSON.stringify(payload, null, 2), 'application/json')) {
        onUpdateProfile({ ...profile, lastSyncedAt: new Date().toISOString() });
        toast('Sauvegarde enregistrée.');
      }
    } catch (error) {
      console.error(error);
      toast('Sauvegarde impossible.', { tone: 'error' });
    }
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const backup = Array.isArray(data) ? { tasks: data } : data;
        if (!Array.isArray(backup.tasks)) throw new Error('format');
        onRestoreData(backup);
        onClose();
      } catch {
        toast('Fichier de sauvegarde invalide.', { tone: 'error' });
      }
    };
    reader.readAsText(file);
  };

  // Sauvegarde sur le serveur local (mode web / développement)
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/cloud-sync/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode: profile.syncCode, payload: { tasks, categories, userProfile: profile } }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      onUpdateProfile({ ...profile, lastSyncedAt: data.updatedAt });
      toast('Sauvegarde envoyée au serveur.');
    } catch (err) {
      console.warn('Backup error:', err);
      toast('Serveur injoignable : utilisez la sauvegarde fichier.', { tone: 'error' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFromCode = async () => {
    const clean = syncCodeInput.trim().toUpperCase();
    if (!clean) return;
    setIsRestoring(true);
    try {
      const res = await fetch(`/api/cloud-sync/restore/${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error('Code introuvable ou expiré');
      const json = await res.json();
      if (!json.data) throw new Error('Données vides');
      onRestoreData(json.data);
      onUpdateProfile({ ...profile, syncCode: clean, lastSyncedAt: json.data.updatedAt });
      setSyncCodeInput('');
      onClose();
    } catch (err: any) {
      toast(err.message || 'Restauration impossible', { tone: 'error' });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 text-zinc-900 dark:text-zinc-100 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <Cloud className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">Sauvegarde & synchronisation</h3>
              <p className="text-xs text-zinc-400">
                {profile.lastSyncedAt
                  ? `Dernière sauvegarde : ${new Date(profile.lastSyncedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}`
                  : 'Aucune sauvegarde pour le moment'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local shared store */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Monitor className="w-4 h-4" />
            Synchronisé en direct avec le panneau du bureau (Super+Shift+T)
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Vos {tasks.length} tâche(s) sont enregistrées sur cet ordinateur dans
            <code className="mx-1 px-1 rounded bg-zinc-200/60 dark:bg-zinc-800 font-mono">~/.local/share/auratask/tasks.json</code>
            et toute modification apparaît aussitôt des deux côtés.
          </p>
        </div>

        {/* File backup */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <HardDrive className="w-3.5 h-3.5" />
            Sauvegarde fichier
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleFileBackup}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              Sauvegarder
            </button>
            <label className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Restaurer…
              <input type="file" accept=".json,application/json" onChange={handleFileRestore} className="hidden" />
            </label>
          </div>
          <p className="text-[11px] text-zinc-400">La restauration remplace les tâches actuelles (annulable pendant quelques secondes).</p>
        </div>

        {/* Server sync (web / dev only) */}
        {server && (
          <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Via le serveur AuraTask (tant qu'il tourne)
            </div>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <span className="font-mono font-bold text-sm tracking-wider text-indigo-600 dark:text-indigo-400">{profile.syncCode}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
                <button
                  onClick={handleBackupNow}
                  disabled={isBackingUp}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
                  Envoyer
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={syncCodeInput}
                onChange={(e) => setSyncCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleRestoreFromCode(); }}
                placeholder="Code d'un autre appareil (AURA-XXXX-XXXX)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                onClick={handleRestoreFromCode}
                disabled={!syncCodeInput.trim() || isRestoring}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold disabled:opacity-40"
              >
                {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Récupérer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
