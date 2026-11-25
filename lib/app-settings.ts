import { create } from 'zustand';

export interface AppSettingRecord {
  id?: string;
  key: string;
  value: Record<string, any>;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface AppSettingsState {
  settings: Record<string, AppSettingRecord>;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  fetchSettings: (force?: boolean) => Promise<Record<string, AppSettingRecord>>;
  updateToggleSetting: (
    key: 'combos_enabled' | 'packaging_fee_enabled',
    enabled: boolean,
    token?: string | null
  ) => Promise<{ success: boolean; error?: string }>;
  isCombosEnabled: () => boolean;
  isPackagingFeeEnabled: () => boolean;
}

/**
 * Zustand client-side store for global app settings with in-memory caching.
 */
export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: {
    combos_enabled: {
      key: 'combos_enabled',
      value: { enabled: true },
    },
    packaging_fee_enabled: {
      key: 'packaging_fee_enabled',
      value: { enabled: true },
    },
  },
  isLoading: false,
  isLoaded: false,
  error: null,

  fetchSettings: async (force = false) => {
    if (get().isLoaded && !force) {
      return get().settings;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load app settings');

      const incoming = (data.settings || {}) as Record<string, AppSettingRecord>;
      const merged = {
        ...get().settings,
        ...incoming,
      };

      set({ settings: merged, isLoading: false, isLoaded: true });
      return merged;
    } catch (err: any) {
      console.warn('Failed to fetch app settings, keeping defaults:', err.message);
      set({ isLoading: false, error: err.message });
      return get().settings;
    }
  },

  updateToggleSetting: async (key, enabled, token) => {
    const prevSetting = get().settings[key];
    // Immediate optimistic update
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: {
          ...prevSetting,
          key,
          value: { enabled },
        },
      },
    }));

    try {
      const res = await fetch('/api/admin/settings/toggles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ key, enabled }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Rollback
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: prevSetting,
          },
        }));
        throw new Error(data.error || 'Failed to update setting');
      }

      // Optimistic & server sync
      set((state) => ({
        settings: {
          ...state.settings,
          [key]: data.setting || {
            key,
            value: { enabled },
            updated_at: new Date().toISOString(),
          },
        },
      }));

      return { success: true };
    } catch (err: any) {
      // Rollback
      set((state) => ({
        settings: {
          ...state.settings,
          [key]: prevSetting,
        },
      }));
      return { success: false, error: err.message };
    }
  },

  isCombosEnabled: () => {
    const s = get().settings['combos_enabled'];
    return s?.value?.enabled !== false;
  },

  isPackagingFeeEnabled: () => {
    const s = get().settings['packaging_fee_enabled'];
    return s?.value?.enabled !== false;
  },
}));

/**
 * Synchronous client-side helper to read a setting from cache.
 * Triggers background fetch if cache is empty.
 */
export function getAppSetting(key: string): any {
  const store = useAppSettingsStore.getState();
  const found = store.settings[key];
  if (!store.isLoaded && !store.isLoading && typeof window !== 'undefined') {
    store.fetchSettings().catch(() => {});
  }
  return found?.value ?? { enabled: true };
}
