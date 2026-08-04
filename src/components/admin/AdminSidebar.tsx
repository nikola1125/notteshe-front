import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { clearAdminCache } from "@/routes/admin";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Truck,
  Tag,
  Mail,
  ScrollText,
  Warehouse,
  Shirt,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { logoutAdminFn } from "@/lib/admin/auth";

interface AdminSidebarProps {
  adminName: string;
  adminRole: string;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Inventory", href: "/admin/inventory", icon: Warehouse },
  { label: "Permanent Wardrobe", href: "/admin/permanent-wardrobe", icon: Shirt },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Shipping", href: "/admin/shipping", icon: Truck },
  { label: "Discounts", href: "/admin/discounts", icon: Tag },
  { label: "Newsletter", href: "/admin/newsletter", icon: Mail },
  { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
] as const;

export function AdminSidebar({ adminName, adminRole }: AdminSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const router = useRouter();

  function isActive(href: string, exact?: boolean) {
    if (exact) return location.pathname === href;
    return location.pathname.startsWith(href);
  }

  async function handleLogout() {
    try {
      clearAdminCache();
      await logoutAdminFn();
      await router.navigate({ to: "/admin-login" });
    } catch {
      toast.error("Logout failed");
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="border-b border-[var(--color-border)] px-6 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-muted-foreground)]">
          Admin
        </p>
        <p className="font-serif text-lg italic text-[var(--color-foreground)]">
          Notteshe
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              to={href}
              onClick={() => setMobileOpen(false)}
              className={[
                "flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-[var(--color-clay)]/15 text-[var(--color-clay)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              ].join(" ")}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span className="font-mono text-xs tracking-wide">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] px-6 py-4">
        <p className="text-xs font-medium text-[var(--color-foreground)]">
          {adminName}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {adminRole}
        </p>
        <button
          onClick={handleLogout}
          className="mt-3 flex items-center gap-2 text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-clay)]"
        >
          <LogOut size={13} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-paper)] lg:flex lg:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile topbar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-3 lg:hidden">
        <p className="font-serif text-base italic text-[var(--color-foreground)]">
          Notteshe Admin
        </p>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-1 text-[var(--color-muted-foreground)]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-56 bg-[var(--color-paper)]">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
