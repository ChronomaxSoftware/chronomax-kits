"use client";

import { useRouter } from "next/navigation";

export default function PortalHeader({ name }: { name: string }) {
  const router = useRouter();
  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
      <div className="leading-tight">
        <p className="text-base font-bold text-white">ChronoMax · Técnico</p>
        <p className="text-xs text-slate-400 truncate max-w-[60vw]">{name}</p>
      </div>
      <button onClick={sair} className="text-sm text-red-400 hover:text-red-300 shrink-0">
        Sair
      </button>
    </header>
  );
}
