// Ponts vers le système : dans l'app native (Tauri/WebKitGTK), les liens
// target=_blank, les téléchargements de blobs et l'API Notification du web ne
// fonctionnent pas ; on passe alors par les plugins natifs.
import { invoke, isTauri } from '@tauri-apps/api/core';

export const inTauri = (): boolean => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

/** Les routes /api du serveur Express n'existent qu'en mode web ou `tauri dev`. */
export const hasApiServer = (): boolean => !inTauri() || import.meta.env.DEV;

export const openExternal = async (url: string): Promise<void> => {
  if (inTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/** Enregistre un fichier. Renvoie false si l'utilisateur a annulé. */
export const saveFile = async (
  name: string,
  data: string | Uint8Array | ArrayBuffer,
  mime = 'application/octet-stream'
): Promise<boolean> => {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data instanceof Uint8Array ? data : new Uint8Array(data);
  if (inTauri()) {
    const saved = await invoke<string | null>('save_file', { name, data: Array.from(bytes) });
    return saved !== null;
  }
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};

let permission: Promise<boolean> | null = null;

export const ensureNotificationPermission = (): Promise<boolean> => {
  permission ??= (async () => {
    try {
      if (inTauri()) {
        const api = await import('@tauri-apps/plugin-notification');
        if (await api.isPermissionGranted()) return true;
        return (await api.requestPermission()) === 'granted';
      }
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission === 'default') return (await Notification.requestPermission()) === 'granted';
      return Notification.permission === 'granted';
    } catch {
      return false;
    }
  })();
  return permission;
};

export const notify = async (title: string, body: string): Promise<void> => {
  if (!(await ensureNotificationPermission())) return;
  try {
    if (inTauri()) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title, body });
    } else {
      new Notification(title, { body });
    }
  } catch (error) {
    console.warn('Notification impossible :', error);
  }
};
