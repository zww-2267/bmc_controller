import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  isLoggedIn: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

function safeStorage() {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      login: (username: string, password: string) => {
        if (username === 'admin' && password === 'abc123..') {
          set({ isLoggedIn: true });
          return true;
        }
        return false;
      },
      logout: () => set({ isLoggedIn: false }),
    }),
    {
      name: 'auth-session',
      storage: createJSONStorage(() => safeStorage() ?? localStorage),
    },
  ),
);
