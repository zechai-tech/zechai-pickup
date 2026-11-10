import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppUser, Outlet, UserRole } from '@/types/supabase';

export interface UserScope {
  role: UserRole;
  outlet_id: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
}

export function getUserScope(user: AppUser | null): UserScope {
  const role: UserRole = user?.role || 'staff';
  const outlet_id = user?.outlet_id || null;
  const isSuperAdmin = role === 'super_admin' || role === 'admin';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isManager = role === 'manager';
  const isStaff = role === 'staff' || role === 'ordering_staff';

  return {
    role,
    outlet_id,
    isAdmin,
    isSuperAdmin,
    isManager,
    isStaff,
  };
}

interface AdminState {
  currentUser: AppUser | null;
  user: AppUser | null; // Compatibility alias
  sessionToken: string | null;
  selectedOutletId: string | null;
  selectedOutlet: Outlet | null;
  soundEnabled: boolean;
  syncTrigger: number;
  isSyncing: boolean;
  isAuthInitialized: boolean;

  // Actions
  setUser: (user: AppUser | null, token?: string | null) => void;
  setSelectedOutletId: (outletId: string | null) => void;
  setSelectedOutlet: (outlet: Outlet | null) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  triggerSync: () => void;
  setAuthInitialized: (initialized: boolean) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      user: null,
      sessionToken: null,
      selectedOutletId: null,
      selectedOutlet: null,
      soundEnabled: true,
      syncTrigger: 0,
      isSyncing: false,
      isAuthInitialized: false,

      setUser: (user, token = null) => {
        set({
          currentUser: user,
          user: user,
          sessionToken: token,
          // If manager or staff, strictly lock selectedOutletId to their outlet_id
          selectedOutletId: (user?.role === 'admin' || user?.role === 'super_admin') ? null : user?.outlet_id || null,
        });
      },

      setSelectedOutletId: (outletId) => set({ selectedOutletId: outletId }),
      setSelectedOutlet: (outlet) => set({ selectedOutlet: outlet }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setSyncing: (syncing) => set({ isSyncing: syncing }),
      triggerSync: () => set((state) => ({ syncTrigger: state.syncTrigger + 1 })),
      setAuthInitialized: (initialized) => set({ isAuthInitialized: initialized }),

      logout: () => {
        set({
          currentUser: null,
          user: null,
          sessionToken: null,
          selectedOutletId: null,
          selectedOutlet: null,
          isAuthInitialized: true,
        });
      },
    }),
    {
      name: 'zecha_admin_store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
