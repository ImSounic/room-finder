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
    <main className="mx-auto max-w-sm p-6 pt-20">
      <h1 className="text-2xl font-semibold mb-6">Room Finder</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className="rounded border p-2 bg-transparent" type="email" placeholder="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded border p-2 bg-transparent" type="password" placeholder="password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="rounded bg-blue-600 text-white p-2 disabled:opacity-50" disabled={busy}>
          {busy ? "…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
