import { create } from 'zustand';

interface User {
  id: number;
  telegramId: number;
  username: string;
  coins: number;
  referralCount: number;
  isBanned: boolean;
  createdAt: string;
}

interface UserStore {
  user: User | null;
  token: string | null;
  
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setCoins: (coins: number) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('authToken'),
  
  setUser: (user: User) => {
    set({ user });
    localStorage.setItem('user', JSON.stringify(user));
  },
  
  setToken: (token: string) => {
    set({ token });
    localStorage.setItem('authToken', token);
  },
  
  setCoins: (coins: number) => {
    set((state) => ({
      user: state.user ? { ...state.user, coins } : null,
    }));
  },
  
  logout: () => {
    set({ user: null, token: null });
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },
}));