// localStorage wrapper that never throws (private mode, blocked storage, …).
export function createStorage(prefix) {
  return {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(`${prefix}:${key}`);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value));
      } catch {
        /* storage unavailable — progress just isn't persisted */
      }
    },
  };
}
