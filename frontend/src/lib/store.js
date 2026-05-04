// Auth Store - Zustand
import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  // Initialize from localStorage on mount
  init: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('tm_token');
    const userStr = localStorage.getItem('tm_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },

  login: (user, token) => {
    localStorage.setItem('tm_token', token);
    localStorage.setItem('tm_user', JSON.stringify(user));
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('tm_token');
    localStorage.removeItem('tm_user');
    set({ user: null, token: null });
  },

  updateUser: (updates) => {
    const user = { ...get().user, ...updates };
    localStorage.setItem('tm_user', JSON.stringify(user));
    set({ user });
  },
}));
