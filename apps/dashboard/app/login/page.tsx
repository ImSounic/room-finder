"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.push("/listings");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface p-6">
      <div className="w-full max-w-sm rounded-(--radius-card) border border-line bg-bg p-8 shadow-(--shadow-lift)">
        <div className="mb-6 flex items-center gap-3">
          <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-xl text-primary-ink">⌂</span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Room Finder</h1>
            <p className="text-sm text-muted">Let’s find you a home in Enschede.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <input
              className="min-h-11 rounded-(--radius-control) border border-line bg-bg px-3 text-base placeholder:text-muted"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Password
            <input
              className="min-h-11 rounded-(--radius-control) border border-line bg-bg px-3 text-base"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <button
            className="mt-1 min-h-11 rounded-(--radius-control) bg-primary text-sm font-semibold text-primary-ink transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
