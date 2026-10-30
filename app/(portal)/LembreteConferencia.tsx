"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Lembrete no portal: prova com conferência diária ativa sem a conferência de hoje. */
export default function LembreteConferencia() {
  const [provas, setProvas] = useState<{ id: number; numero: string; nome: string }[]>([]);

  useEffect(() => {
    fetch("/api/staff/conferencia/pendentes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProvas)
      .catch(() => {});
  }, []);

  if (provas.length === 0) return null;
  return (
    <Link
      href="/portal/staff"
      className="block rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100 hover:bg-amber-500/20"
    >
      📋 <strong>Conferência do dia pendente</strong> — {provas.map((p) => `#${p.numero} ${p.nome}`).join(", ")}. No fim do
      dia, confira cada celular que está com você → <span className="underline">fazer agora</span>
    </Link>
  );
}
