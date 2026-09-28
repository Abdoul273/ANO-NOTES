import type { Task } from '../types';
import { invoke, isTauri } from '@tauri-apps/api/core';

type Operation = { type: 'upsert'; task: Task } | { type: 'delete'; id: string } | { type: 'order'; ids: string[] };
type Snapshot = { revision: number; tasks: Task[] };
const MIGRATED_KEY = 'auratask_shared_tasks_migrated_v1';
const BASE_KEY = 'auratask_shared_tasks_base_v1';
const PENDING_KEY = 'auratask_shared_tasks_pending_v1';

async function request(url: string, body?: object): Promise<Snapshot> {
  if (isTauri()) {
    const command = url.endsWith('/import') ? 'import' : url.endsWith('/apply') ? 'apply' : 'read';
    const payload = command === 'import' ? (body as { tasks: Task[] }).tasks
      : command === 'apply' ? (body as { operations: Operation[] }).operations : null;
    return invoke<Snapshot>('tasks_store', { command, payload });
  }
  const response = await fetch(url, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined);
  if (!response.ok) throw new Error(`Task sync failed: ${response.status}`);
  return response.json();
}

function changes(before: Task[], after: Task[]): Operation[] {
  const previous = new Map(before.map(task => [task.id, task]));
  const current = new Map(after.map(task => [task.id, task]));
  const operations: Operation[] = [];
  for (const task of before) if (!current.has(task.id)) operations.push({ type: 'delete', id: task.id });
  for (const task of after) {
    if (JSON.stringify(previous.get(task.id)) !== JSON.stringify(task)) operations.push({ type: 'upsert', task });
  }
  const commonBefore = before.filter(task => current.has(task.id)).map(task => task.id);
  const commonAfter = after.filter(task => previous.has(task.id)).map(task => task.id);
  if (JSON.stringify(commonBefore) !== JSON.stringify(commonAfter)) {
    operations.push({ type: 'order', ids: after.map(task => task.id) });
  }
  return operations;
}

function merge(base: Task[], operations: Operation[]): Task[] {
  let tasks = [...base];
  for (const operation of operations) {
    if (operation.type === 'delete') tasks = tasks.filter(task => task.id !== operation.id);
    else if (operation.type === 'upsert') {
      const index = tasks.findIndex(task => task.id === operation.task.id);
      if (index < 0) tasks.unshift(operation.task);
      else tasks[index] = operation.task;
    } else {
      const rank = new Map(operation.ids.map((id, index) => [id, index]));
      tasks.sort((a, b) => (rank.get(a.id) ?? rank.size) - (rank.get(b.id) ?? rank.size));
    }
  }
  return tasks;
}

export class LocalTaskSync {
  private baseline: Task[] = [];
  private desired: Task[] = [];
  private ready = false;
  private busy = false;
  private stopped = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly onRemote: (tasks: Task[]) => void) {}

  async start(initial: Task[]): Promise<void> {
    this.desired = initial;
    try {
      const migrated = localStorage.getItem(MIGRATED_KEY) === 'true';
      const snapshot = migrated
        ? await request('/api/local-tasks')
        : await request('/api/local-tasks/import', { tasks: initial });
      if (this.stopped) return;
      if (!migrated) localStorage.setItem(MIGRATED_KEY, 'true');
      this.baseline = snapshot.tasks;
      this.ready = true;
      const pending = localStorage.getItem(PENDING_KEY);
      if (pending && migrated) {
        const { base, desired } = JSON.parse(pending) as { base: Task[]; desired: Task[] };
        this.desired = merge(snapshot.tasks, changes(base, desired));
      } else if (this.desired === initial) this.desired = snapshot.tasks;
      else this.desired = merge(snapshot.tasks, changes(initial, this.desired));
      this.persist();
      this.onRemote(this.desired);
      void this.flush();
    } catch (error) {
      console.warn('Shared task store is unavailable; keeping browser tasks locally.', error);
    }
    if (!this.timer) {
      this.timer = setInterval(() => { void this.poll(); }, 1500);
      window.addEventListener('focus', this.refresh);
      document.addEventListener('visibilitychange', this.refresh);
    }
  }

  queue(tasks: Task[]): void {
    this.desired = tasks;
    if (this.ready) {
      this.persist();
      void this.flush();
    } else {
      const base = localStorage.getItem(BASE_KEY);
      if (base && changes(JSON.parse(base), tasks).length)
        localStorage.setItem(PENDING_KEY, JSON.stringify({ base: JSON.parse(base), desired: tasks }));
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener('focus', this.refresh);
    document.removeEventListener('visibilitychange', this.refresh);
  }

  /** Relit tout de suite le magasin (ex. retour sur la fenêtre après le panneau Super+Shift+T). */
  readonly refresh = (): void => {
    if (document.visibilityState !== 'hidden') void this.poll();
  };

  private persist(): void {
    localStorage.setItem(BASE_KEY, JSON.stringify(this.baseline));
    if (changes(this.baseline, this.desired).length)
      localStorage.setItem(PENDING_KEY, JSON.stringify({ base: this.baseline, desired: this.desired }));
    else localStorage.removeItem(PENDING_KEY);
  }

  private async poll(): Promise<void> {
    if (this.stopped) return;
    if (!this.ready) {
      // Retry initialization when the local server comes back.
      await this.start(this.desired);
      return;
    }
    if (this.busy || changes(this.baseline, this.desired).length) return;
    try {
      const snapshot = await request('/api/local-tasks');
      if (this.stopped || this.busy || changes(this.baseline, this.desired).length) return;
      if (JSON.stringify(snapshot.tasks) !== JSON.stringify(this.baseline)) {
        this.baseline = snapshot.tasks;
        this.desired = snapshot.tasks;
        this.persist();
        this.onRemote(snapshot.tasks);
      }
    } catch { /* Keep the last local state and retry. */ }
  }

  private async flush(): Promise<void> {
    if (!this.ready || this.busy || this.stopped) return;
    const operations = changes(this.baseline, this.desired);
    if (!operations.length) return;
    this.busy = true;
    const submitted = this.desired;
    try {
      const snapshot = await request('/api/local-tasks/apply', { operations });
      if (this.stopped) return;
      this.baseline = snapshot.tasks;
      this.desired = this.desired === submitted
        ? snapshot.tasks
        : merge(snapshot.tasks, changes(submitted, this.desired));
      this.persist();
      this.onRemote(this.desired);
    } catch (error) {
      console.warn('Task changes will be retried.', error);
    } finally {
      this.busy = false;
      if (changes(this.baseline, this.desired).length && !this.stopped) {
        setTimeout(() => { void this.flush(); }, 1500);
      }
    }
  }
}
