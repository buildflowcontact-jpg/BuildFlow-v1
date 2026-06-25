import { create } from 'zustand';

export type GanttZoom = 'day' | 'week' | 'month';

interface UiState {
  sidebarCollapsed: boolean;
  ganttZoom: GanttZoom;
  notificationsOpen: boolean;
  toggleSidebar: () => void;
  setGanttZoom: (zoom: GanttZoom) => void;
  setNotificationsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  ganttZoom: 'week',
  notificationsOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setGanttZoom: (zoom) => set({ ganttZoom: zoom }),
  setNotificationsOpen: (open) => set({ notificationsOpen: open }),
}));
