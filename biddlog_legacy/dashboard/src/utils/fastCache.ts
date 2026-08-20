// ==============================================================================
// Biddlog Super-Fast In-Memory & LocalStorage Stale-While-Revalidate Engine
// Provides 0ms instant render without loading delays across all modules
// ==============================================================================

const memoryCache = new Map<string, { data: any; timestamp: number }>();

export const getFastCache = <T>(key: string): T | null => {
  // 1. Check RAM memory cache first (0.000ms)
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!.data as T;
  }

  // 2. Check localStorage cache
  try {
    const raw = localStorage.getItem(`biddlog_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache.set(key, { data: parsed, timestamp: Date.now() });
      return parsed as T;
    }
  } catch (e) {
    // Ignore localStorage parse errors
  }

  return null;
};

export const setFastCache = (key: string, data: any): void => {
  memoryCache.set(key, { data, timestamp: Date.now() });
  try {
    localStorage.setItem(`biddlog_cache_${key}`, JSON.stringify(data));
  } catch (e) {
    // Quota exceeded safe fallback
  }
};

export const clearFastCache = (key?: string): void => {
  if (key) {
    memoryCache.delete(key);
    try {
      localStorage.removeItem(`biddlog_cache_${key}`);
    } catch (e) {}
  } else {
    memoryCache.clear();
  }
};

// Preload critical application data in background without blocking UI
export const preloadAllAppData = async (): Promise<void> => {
  try {
    const endpoints = [
      { key: 'salary_data', url: '/api/salary.php' },
      { key: 'obtained_data', url: '/api/obtained.php' },
      { key: 'obtained_dates', url: '/api/obtained.php?action=get_dates' },
      { key: 'members_data', url: '/api/members.php' },
      { key: 'aliases_data', url: '/api/aliases.php' }
    ];

    await Promise.allSettled(
      endpoints.map(async ({ key, url }) => {
        try {
          const res = await fetch(url);
          const json = await res.json();
          if (json && json.status === 'success') {
            setFastCache(key, json);
          }
        } catch (e) {}
      })
    );
  } catch (e) {}
};
