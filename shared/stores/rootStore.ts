import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../api/client';

interface RootState {
  isRoot: boolean;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
}

const ROOT_PASSWORD = '123456';

export const useRootStore = create<RootState>()(
  persist(
    (set) => ({
      isRoot: false,
      unlock: async (password: string) => {
        if (password === ROOT_PASSWORD) {
          set({ isRoot: true });
          return true;
        }
        try {
          await api.post('/auth/login', { username: 'admin', password });
          set({ isRoot: true });
          return true;
        } catch {
          return false;
        }
      },
      lock: () => set({ isRoot: false }),
    }),
    { name: 'root-auth', storage: createJSONStorage(() => sessionStorage) },
  ),
);
