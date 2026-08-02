import { create } from "zustand";

interface AuthStore {
  authModalOpen: boolean;
  authModalMode: "login" | "signup";
  authModalCallback: (() => void) | null;
  openAuthModal: (mode?: "login" | "signup", callback?: () => void) => void;
  closeAuthModal: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  authModalOpen: false,
  authModalMode: "login",
  authModalCallback: null,

  openAuthModal: (mode = "login", callback) =>
    set({ authModalOpen: true, authModalMode: mode, authModalCallback: callback ?? null }),

  closeAuthModal: () =>
    set({ authModalOpen: false, authModalCallback: null }),
}));
