import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

let nextId = 1;
let listener: ((items: ToastItem[]) => void) | null = null;
let items: ToastItem[] = [];

const emit = () => listener?.([...items]);

export const dismissToast = (id: number) => {
  items = items.filter(t => t.id !== id);
  emit();
};

/** Message éphémère non bloquant (remplace alert()). */
export const toast = (
  message: string,
  options: { tone?: Tone; action?: ToastItem['action']; duration?: number } = {}
) => {
  const id = nextId++;
  items = [...items.slice(-3), { id, message, tone: options.tone ?? 'success', action: options.action }];
  emit();
  setTimeout(() => dismissToast(id), options.duration ?? (options.action ? 6000 : 3500));
  return id;
};

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const COLORS = { success: 'text-emerald-500', error: 'text-rose-500', info: 'text-indigo-500' };

export const Toaster: React.FC = () => {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    listener = setList;
    return () => { listener = null; };
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none" aria-live="polite">
      {list.map(t => {
        const Icon = ICONS[t.tone];
        return (
          <div key={t.id} className="toast-in pointer-events-auto w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl text-xs text-zinc-800 dark:text-zinc-100">
            <Icon className={`w-4 h-4 shrink-0 ${COLORS[t.tone]}`} />
            <span className="flex-1 min-w-0">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismissToast(t.id); }}
                className="px-2.5 py-1 rounded-lg font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismissToast(t.id)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" title="Fermer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
