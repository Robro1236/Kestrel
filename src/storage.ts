import AsyncStorage from '@react-native-async-storage/async-storage';

// Every call swallows storage errors: if storage fails, the app still works for this session.

export async function load<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`could not save ${key}`, e); // e.g. private browsing or full storage; the app keeps working
  }
}

// Last successful result of each source (area, warnings, air, places...), with when it was saved.
export type Saved<T> = { data: T; savedAt: string };
type Results = Record<string, Saved<unknown>>;

export async function loadResult<T>(source: string): Promise<Saved<T> | null> {
  return ((await load<Results>('results'))?.[source] as Saved<T> | undefined) ?? null;
}

let resultsWrite = Promise.resolve();
// Writes are chained so two sources finishing at once don't overwrite each other.
export function saveResult(source: string, data: unknown, now = new Date()): Promise<void> {
  resultsWrite = resultsWrite.then(async () => {
    const all = (await load<Results>('results')) ?? {};
    await save('results', { ...all, [source]: { data, savedAt: now.toISOString() } });
  });
  return resultsWrite;
}

let recording: Promise<void> | null = null;
// Runs `record` once per device, ever. The flag is set first so a remount can't double-count;
// it's cleared again if `record` fails so the next visit retries.
export function recordPlanOnce(record: () => Promise<void>): Promise<void> {
  recording ??= (async () => {
    if (await load('planRecorded')) return;
    await save('planRecorded', true);
    try {
      await record();
    } catch {
      await save('planRecorded', false);
      recording = null;
    }
  })();
  return recording;
}
