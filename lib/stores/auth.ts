// lib/stores/auth.ts
import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  planQuotaBytes: number;
  usedBytes: number;
  pendingBytes: number;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  updateQuota: (usedBytes: number, pendingBytes: number) => void;
  setPlanQuota: (planQuotaBytes: number) => void;
  refreshUserQuota: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  planQuotaBytes: 0,
  usedBytes: 0,
  pendingBytes: 0,
  setUser: (user) => set((state) => {
    // Only update if the user is actually different
    if (JSON.stringify(state.user) !== JSON.stringify(user)) {
      return { user };
    }
    return state;
  }),
  setLoading: (loading) => set({ loading }),
  updateQuota: (usedBytes, pendingBytes) =>
    set((state) => ({
      usedBytes,
      pendingBytes,
      user: state.user
        ? { ...state.user, usedBytes, pendingBytes }
        : null,
    })),
  setPlanQuota: (planQuotaBytes) => set({ planQuotaBytes }),
  refreshUserQuota: async () => {
    console.log('Refreshing user quota...');
  },
}));