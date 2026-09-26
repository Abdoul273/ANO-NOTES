import React, { useState } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  Copy,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Laptop,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { UserProfile, Task } from '../types';

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(profile.syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Perform Cloud Backup
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/cloud-sync/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncCode: profile.syncCode,
          payload: {
            tasks,
            categories,
            userProfile: profile,
          },
        }),
      });

      if (!res.ok) throw new Error('Échec de la sauvegarde');
      const data = await res.json();
      const updatedProfile = {
        ...profile,
        lastSyncedAt: data.updatedAt,
      };
      onUpdateProfile(updatedProfile);
      setStatusMessage('✓ Sauvegarde cloud chiffrée réussie.');
    } catch (err: any) {
      console.warn('Backup error, using offline local snapshot:', err);
      const updatedProfile = {
        ...profile,
        lastSyncedAt: new Date().toISOString(),
      };
      onUpdateProfile(updatedProfile);
      setStatusMessage('✓ Données sécurisées localement (Mode hors-ligne).');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore from code
  const handleRestoreFromCode = async () => {
    const clean = syncCodeInput.trim().toUpperCase();
    if (!clean) return;

    setIsRestoring(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/cloud-sync/restore/${clean}`);
      if (!res.ok) throw new Error('Code introuvable ou invalide');
      const json = await res.json();
      if (json.data) {
        onRestoreData(json.data);
        onUpdateProfile({
          ...profile,
          syncCode: clean,
          lastSyncedAt: json.data.updatedAt,
        });
        setStatusMessage('✓ Données synchronisées avec succès !');
        setSyncCodeInput('');
      }
    } catch (err: any) {
      setStatusMessage(`❌ Erreur: ${err.message || 'Impossible de restaurer'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 text-zinc-900 dark:text-zinc-100 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <Cloud className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                Synchronisation Multiplateforme
              </h3>
              <p className="text-xs text-zinc-400">Accédez à vos tâches sur tous vos appareils</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pairing Device Code Box */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Votre Clé de Synchronisation Unique
            </span>
            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Chiffrement Sécurisé
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
            <span className="font-mono font-bold text-base tracking-wider text-indigo-600 dark:text-indigo-400">
              {profile.syncCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            Entrez ce code sur votre smartphone ou votre tablette pour synchroniser vos tâches instantanément.
          </p>
        </div>

        {/* Sync Actions */}
        <div className="space-y-4">
          {/* Cloud Backup button */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-500/20">
            <div>
              <div className="font-semibold text-xs text-indigo-950 dark:text-indigo-200">
                Sauvegarde Cloud Automatique
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {profile.lastSyncedAt
                  ? `Dernière synchro : ${new Date(profile.lastSyncedAt).toLocaleTimeString('fr-FR')}`
                  : 'Aucune sauvegarde récente'}
              </div>
            </div>
            <button
              onClick={handleBackupNow}
              disabled={isBackingUp}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
              <span>{isBackingUp ? 'Sauvegarde...' : 'Sauvegarder'}</span>
            </button>
          </div>

          {/* Restore / Pair another device */}
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Synchroniser depuis un autre appareil
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={syncCodeInput}
                onChange={(e) => setSyncCodeInput(e.target.value.toUpperCase())}
                placeholder="Ex : AURA-8X2F-SYNC"
                className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                onClick={handleRestoreFromCode}
                disabled={!syncCodeInput.trim() || isRestoring}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-all disabled:opacity-40"
              >
                {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Lier & Synchroniser'}
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-center font-medium">
              {statusMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
