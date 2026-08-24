import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Fingerprint, Trash2, Plus } from "lucide-react";
import { BackButton } from "@/components/admin/BackButton";
import {
  listPasskeysFn,
  startRegistrationFn,
  finishRegistrationFn,
  deletePasskeyFn,
} from "@/lib/admin/passkey";
import type { AdminPasskey } from "@/db/schema";

export const Route = createFileRoute("/admin/passkeys")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  loader: () => listPasskeysFn(),
  component: PasskeysPage,
});

function PasskeysPage() {
  const router = useRouter();
  const passkeys = Route.useLoaderData() as Pick<
    AdminPasskey,
    "id" | "credentialId" | "deviceName" | "createdAt"
  >[];

  const [registering, setRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleRegister() {
    if (!deviceName.trim()) {
      toast.error("Enter a name for this device");
      return;
    }
    setRegistering(true);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const options = await startRegistrationFn();
      const regResponse = await startRegistration({ optionsJSON: options });
      await finishRegistrationFn({
        data: { response: regResponse, deviceName: deviceName.trim() },
      });
      toast.success("Passkey registered");
      setDeviceName("");
      setShowNameInput(false);
      router.invalidate();
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast.error("Registration cancelled");
      } else {
        toast.error(err?.message ?? "Registration failed");
      }
    } finally {
      setRegistering(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deletePasskeyFn({ data: { id } });
      toast.success("Passkey removed");
      router.invalidate();
    } catch {
      toast.error("Failed to remove passkey");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />

      <div className="mb-8 flex items-center gap-3">
        <Fingerprint size={22} className="text-[var(--color-clay)]" />
        <div>
          <h1 className="font-serif text-2xl text-[var(--color-foreground)]">Passkeys</h1>
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
            Use Touch ID or Face ID to sign in without a password.
          </p>
        </div>
      </div>

      {/* Registered passkeys */}
      <div className="mb-6 space-y-2">
        {passkeys.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No passkeys registered yet.
          </p>
        )}
        {passkeys.map((pk) => (
          <div
            key={pk.id}
            className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Fingerprint size={16} className="shrink-0 text-[var(--color-muted-foreground)]" />
              <div>
                <p className="text-sm font-medium text-[var(--color-foreground)]">
                  {pk.deviceName || "Unnamed device"}
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Added {new Date(pk.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(pk.id)}
              disabled={deletingId === pk.id}
              className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:text-red-500 disabled:opacity-40"
              aria-label="Remove passkey"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add passkey */}
      {showNameInput ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Device name (e.g. iPhone 15 Pro)"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            autoFocus
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]"
          />
          <button
            onClick={handleRegister}
            disabled={registering}
            className="rounded bg-[var(--color-clay)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {registering ? "Setting up…" : "Register"}
          </button>
          <button
            onClick={() => { setShowNameInput(false); setDeviceName(""); }}
            className="rounded border border-[var(--color-border)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] transition-opacity hover:opacity-70"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNameInput(true)}
          className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-[var(--color-foreground)] transition-opacity hover:opacity-70"
        >
          <Plus size={13} />
          Add passkey
        </button>
      )}
    </div>
  );
}
