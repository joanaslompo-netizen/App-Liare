type Access = 'read' | 'write';
type Pause = { until: number; scope: Access | 'all' };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function nextQuotaResetAt(now: number): number {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = date.format(now);
  let low = now, high = now + 27 * 60 * 60 * 1000;
  // Find the next Pacific calendar day, including either DST transition.
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (date.format(middle) === today) low = middle; else high = middle;
  }
  return Math.ceil(high / 1000) * 1000 + 60_000;
}

export class CloudQuotaPausedError extends Error {
  code = 'resource-exhausted';
  constructor(public retryAt: number) {
    super('A nuvem limitou as operações. As tentativas estão pausadas até a liberação; as alterações locais continuam pendentes.');
    this.name = 'CloudQuotaPausedError';
  }
}

export class CloudQuotaGuard {
  private memory = new Map<string, Pause>();
  private listeners = new Map<string, Set<() => void>>();
  constructor(private storage?: Storage, private clock = () => Date.now()) {}
  private key(uid: string) { return `liare:liare_connected_v1:firestore-quota:${uid}`; }
  private pause(uid: string): Pause | null {
    let pause = this.memory.get(uid);
    try {
      const raw = this.storage?.getItem(this.key(uid));
      if (raw) {
        const stored = JSON.parse(raw);
        if (Number.isFinite(stored.until) && ['read', 'write', 'all'].includes(stored.scope) && (!pause || stored.until >= pause.until)) pause = stored;
      }
    } catch { /* The in-memory pause still protects a full/private browser. */ }
    if (!pause) return null;
    if (pause.until <= this.clock()) {
      this.memory.delete(uid);
      try { this.storage?.removeItem(this.key(uid)); } catch { /* optional cache */ }
      return null;
    }
    this.memory.set(uid, pause);
    return pause;
  }
  assertAllowed(uid: string, access: Access) {
    const pause = this.pause(uid);
    if (pause && (pause.scope === 'all' || pause.scope === access)) throw new CloudQuotaPausedError(pause.until);
  }
  retryAt(uid: string): number | null { return this.pause(uid)?.until ?? null; }
  subscribe(uid: string, listener: () => void) {
    const listeners = this.listeners.get(uid) || new Set<() => void>();
    listeners.add(listener); this.listeners.set(uid, listeners);
    const storageChanged = (event: StorageEvent) => { if (event.key === this.key(uid)) listener(); };
    globalThis.addEventListener?.('storage', storageChanged);
    return () => { listeners.delete(listener); globalThis.removeEventListener?.('storage', storageChanged); };
  }
  record(uid: string, error: unknown, access: Access) {
    if (error instanceof CloudQuotaPausedError) return;
    const value = error as { code?: string; message?: string };
    const text = `${value?.code || ''} ${value?.message || error}`;
    if (!/resource[-_ .]?exhausted|quota|cota/i.test(text)) return;
    const scope = /read units|read quota|leituras/i.test(text) ? 'read' : /write units|write quota|gravações/i.test(text) ? 'write' : access;
    const previous = this.pause(uid);
    const daily = /daily|per day|diári|free tier/i.test(text);
    const until = daily ? nextQuotaResetAt(this.clock()) : this.clock() + 60_000;
    const pause: Pause = { until: Math.max(previous?.until || 0, until), scope: previous && previous.scope !== scope ? 'all' : scope };
    this.memory.set(uid, pause);
    try { this.storage?.setItem(this.key(uid), JSON.stringify(pause)); } catch { /* keep session guard */ }
    this.listeners.get(uid)?.forEach(listener => listener());
  }
}

const browserStorage: Storage = {
  getItem: key => globalThis.localStorage?.getItem(key) ?? null,
  setItem: (key, value) => globalThis.localStorage?.setItem(key, value),
  removeItem: key => globalThis.localStorage?.removeItem(key),
};
export const cloudQuotaGuard = new CloudQuotaGuard(browserStorage);
