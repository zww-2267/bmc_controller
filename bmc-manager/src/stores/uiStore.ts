import { create } from 'zustand';

interface UIState {
  siderCollapsed: boolean;
  toggleSider: () => void;
  selectedRouterId: string | null;
  setSelectedRouterId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  siderCollapsed: false,
  toggleSider: () => set(s => ({ siderCollapsed: !s.siderCollapsed })),
  selectedRouterId: null,
  setSelectedRouterId: (id) => set({ selectedRouterId: id }),
}));
