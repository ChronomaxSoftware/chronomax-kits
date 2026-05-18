"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const abas = [
  { href: "/tecnicos", label: "Cadastro" },
  { href: "/tecnicos/entregas", label: "Entregas/Mês" },
];

export default function TecnicosTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-slate-700 mb-6">
      {abas.map((a) => {
        const ativo = pathname === a.href;
        return (
          <Link
            key={a.href}
            href={a.href}
            className={`px-4 py-2 text-sm rounded-t-lg ${
              ativo
                ? "bg-slate-800 text-white border-b-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
