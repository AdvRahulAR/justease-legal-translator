import { SessionData, DocumentMode } from '../types';

const DB_NAME = 'JustEaseDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const CACHE_STORE_NAME = 'semantic_cache';
const SESSION_KEY = 'current_active_session';

export const DEFAULT_SESSION: SessionData = {
  mode: DocumentMode.TRANSLATE,
  isScannedMode: false,
  sourceText: '',
  sourceImages: [],
  translatedText: '',
  councilVerdict: null,
  analysisResult: null,
  timestamp: Date.now(),
  targetLanguage: 'Hindi',
  sourceLanguage: 'auto'
};

// --- IndexedDB Helpers ---

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB Error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME);
      }
    };
  });
};

export const saveSession = async (data: SessionData): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // We overwrite the single active session key
    store.put(data, SESSION_KEY);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Failed to save session to IndexedDB. Is disk full?', error);
  }
};

export const loadSession = async (): Promise<SessionData> => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const request = store.get(SESSION_KEY);

    const result = await new Promise<SessionData | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!result) return DEFAULT_SESSION;

    // Merge with default to ensure new fields are present if schema changes
    return { ...DEFAULT_SESSION, ...result };
  } catch (error) {
    console.error('Failed to load session from IndexedDB', error);
    return DEFAULT_SESSION;
  }
};

export const clearSession = async (): Promise<SessionData> => {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.delete(SESSION_KEY);

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to clear session from IndexedDB', error);
  }
  return DEFAULT_SESSION;
};

// --- Semantic Cache Helpers ---

export const getCachedResult = async (key: string): Promise<any | null> => {
  try {
    const db = await getDB();
    const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
    const store = tx.objectStore(CACHE_STORE_NAME);
    const request = store.get(key);

    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Cache lookup failed', error);
    return null;
  }
};

export const saveCachedResult = async (key: string, value: any): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CACHE_STORE_NAME);
    store.put(value, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Failed to save to cache', error);
  }
};