import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;           // productId-size-colour
  productId: string;
  name: string;
  price: number;
  originalPrice: number | null;
  image: string;
  size: string;
  colour: string;
  quantity: number;
  stock: number;        // max allowed quantity
}

export interface PendingFly {
  src: string;
  fromX: number;
  fromY: number;
  fromSize: number;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  pendingFly: PendingFly | null;
  flyNow: boolean;
  addItem: (payload: Omit<CartItem, "id" | "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  setPendingFly: (fly: PendingFly | null) => void;
  triggerFlyNow: () => void;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      pendingFly: null,
      flyNow: false,

      addItem: (payload) => {
        const id = `${payload.productId}-${payload.size}-${payload.colour}`;
        const existing = get().items.find((i) => i.id === id);
        if (existing) {
          set((s) => ({
            items: s.items.map((i) =>
              i.id === id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          }));
        } else {
          set((s) => ({
            items: [...s.items, { ...payload, id, quantity: 1 }],
          }));
        }
      },

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, delta) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
            .filter((i) => i.quantity > 0),
        })),

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      setPendingFly: (fly) => set({ pendingFly: fly }),
      triggerFlyNow: () => set({ flyNow: true }),
    }),
    {
      name: "notteshe-cart",
      partialize: (s) => ({ items: s.items }),
    }
  )
);
