"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itens = [
  { href: "/portal", label: "Minhas entregas" },
  { href: "/portal/staff", label: "Controle de Staff" },
];

export default function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 bg-slate-950 border-b border-slate-800 px-2 overflow-x-auto">
      {itens.map((i) => {
        const ativo = i.href === "/portal" ? pathname === "/portal" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`px-4 py-3 text-sm whitespace-nowrap ${
              ativo ? "text-white border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
