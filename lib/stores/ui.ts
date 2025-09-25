import { create } from 'zustand';
import { ToastMessage, UploadProgress } from '@/types';
import { useDriveStore } from './drive';

interface UIState {
  toasts: ToastMessage[];
  uploadProgress: UploadProgress[];
  detailsPanelOpen: boolean;
  sidebarOpen: boolean;
  isTrashView: boolean;
  viewMode: 'list' | 'grid';
  iconSize: 'small' | 'medium' | 'large' | 'extra-large';
  autoplayVideoThumbnails: boolean;
  videoPreviewOnHover: boolean;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  addUpload: (upload: UploadProgress) => void;
  updateUpload: (sessionId: string, progress: Partial<UploadProgress>) => void;
  removeUpload: (sessionId: string) => void;
  toggleDetailsPanel: () => void;
  setDetailsPanelOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTrashView: () => void;
  setTrashView: (isTrashView: boolean) => void;
  closeTrashView: () => void;
  setViewMode: (mode: 'list' | 'grid') => void;
  setIconSize: (size: 'small' | 'medium' | 'large' | 'extra-large') => void;
  setAutoplayVideoThumbnails: (value: boolean) => void;
  setVideoPreviewOnHover: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  uploadProgress: [],
  detailsPanelOpen: false,
  sidebarOpen: false,
  isTrashView: false,
  viewMode: 'grid',
  iconSize: 'medium',
  autoplayVideoThumbnails: true,
  videoPreviewOnHover: false,
  
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }]
  })),
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((toast) => toast.id !== id)
  })),
  
  addUpload: (upload) => set((state) => ({
    uploadProgress: [...state.uploadProgress, upload]
  })),
  
  updateUpload: (sessionId, progress) => set((state) => ({
    uploadProgress: state.uploadProgress.map((item) =>
      item.sessionId === sessionId ? { ...item, ...progress } : item
    )
  })),
  
  removeUpload: (sessionId) => set((state) => ({
    uploadProgress: state.uploadProgress.filter((item) => item.sessionId !== sessionId)
  })),
  
  toggleDetailsPanel: () => set((state) => ({
    detailsPanelOpen: !state.detailsPanelOpen
  })),
  
  setDetailsPanelOpen: (open) => set({ detailsPanelOpen: open }),
  
  toggleSidebar: () => set((state) => ({
    sidebarOpen: !state.sidebarOpen
  })),
  
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  toggleTrashView: () => set((state) => ({
    isTrashView: !state.isTrashView
  })),
  
  setTrashView: (isTrashView) => set({ isTrashView }),
  
  closeTrashView: () => {
    // Limpiar selección al cerrar la papelera
    const { clearSelection } = useDriveStore.getState();
    clearSelection();
    set({ isTrashView: false });
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  
  setIconSize: (size) => set({ iconSize: size }),
  setAutoplayVideoThumbnails: (value) => set({ autoplayVideoThumbnails: value }),
  setVideoPreviewOnHover: (value) => set({ videoPreviewOnHover: value }),
}));
