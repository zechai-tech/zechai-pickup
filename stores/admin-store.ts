import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppUser, Outlet } from '@/types/supabase';

interface AdminState {
  currentUser: AppUser | null;
  sessionToken: string | null;
  selectedOutletId: string | null;
  selectedOutlet: Outlet | null;
  soundEnabled: boolean;

  // Actions
  setUser: (user: AppUser | null, token?: string | null) => void;
  setSelectedOutletId: (outletId: string | null) => void;
  setSelectedOutlet: (outlet: Outlet | null) => void;
  setSoundEnabled: (enabled: boolean) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      currentUser: null,
      sessionToken: null,
      selectedOutletId: null,
      selectedOutlet: null,
      soundEnabled: true,

      setUser: (user, token = null) => {
        set({
          currentUser: user,
          sessionToken: token,
          // If manager or staff, lock selectedOutletId to their outlet_id
          selectedOutletId: user?.role === 'admin' ? null : user?.outlet_id || null,
        });
      },

      setSelectedOutletId: (outletId) => set({ selectedOutletId: outletId }),
      setSelectedOutlet: (outlet) => set({ selectedOutlet: outlet }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

      logout: () => {
        set({
          currentUser: null,
          sessionToken: null,
          selectedOutletId: null,
          selectedOutlet: null,
        });
      },
    }),
    {
      name: 'zecha_admin_store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
