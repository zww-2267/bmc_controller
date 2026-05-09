import { create } from 'zustand';

interface RootState {
  isRoot: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
}

const ROOT_PASSWORD = '123456';

export const useRootStore = create<RootState>((set) => ({
  isRoot: false,
  unlock: (password: string) => {
    if (password === ROOT_PASSWORD) {
      set({ isRoot: true });
      return true;
    }
    return false;
  },
  lock: () => set({ isRoot: false }),
}));
