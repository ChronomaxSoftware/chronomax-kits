"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EVENTO_EQUIPAMENTOS_MUDOU } from "@/components/equipamentos/ui";

const abas = [
  { href: "/equipamentos", label: "Inventário" },
  { href: "/equipamentos/pendentes", label: "Pendentes de retorno" },
];

export default function EquipamentosTabs() {
  const pathname = usePathname();
  const [pendentes, setPendentes] = useState<number | null>(null);

  // Recontado a cada troca de aba e depois de cada saída/retorno
  useEffect(() => {
    let ativo = true;
    const contar = () =>
      fetch("/api/equipamentos/pendentes")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => ativo && setPendentes(Array.isArray(d) ? d.length : null))
        .catch(() => {});
    contar();
    window.addEventListener(EVENTO_EQUIPAMENTOS_MUDOU, contar);
    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_EQUIPAMENTOS_MUDOU, contar);
    };
  }, [pathname]);

  return (
    <div className="flex gap-1 border-b border-slate-700 mb-6">
      {abas.map((a) => {
        const ativo = pathname === a.href;
        return (
          <Link
            key={a.href}
            href={a.href}
            className={`px-4 py-2 text-sm rounded-t-lg ${
              ativo ? "bg-slate-800 text-white border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {a.label}
            {a.href.endsWith("pendentes") && pendentes ? (
              <span className="ml-2 rounded-full bg-sky-600 px-2 py-0.5 text-xs text-white">{pendentes}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
