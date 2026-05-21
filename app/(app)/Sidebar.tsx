"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

const LINKS = [
  { href: "/", label: "Convocações" },
  { href: "/importar", label: "Importar evento" },
  { href: "/tecnicos", label: "Técnicos" },
  { href: "/produtos", label: "Produtos & Estoque" },
  { href: "/bases", label: "Estoque por base" },
  { href: "/celulares-chip", label: "Celulares com chip" },
  { href: "/alugados", label: "Alugados" },
  { href: "/staff", label: "Controle de Staff" },
  { href: "/config", label: "Configurações" },
];

export default function Sidebar({ name, username }: { name: string; username: string }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  function ativo(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setAberto(false)}
          className={`block px-3 py-2 rounded-lg ${
            ativo(l.href) ? "bg-slate-800 text-white" : "text-slate-200 hover:bg-slate-800"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );

  const rodape = (
    <div className="border-t border-slate-800 pt-3 mt-3">
      <p className="text-sm text-slate-300">{name}</p>
      <p className="text-xs text-slate-500 mb-2">@{username}</p>
      <LogoutButton />
    </div>
  );

  return (
    <>
      {/* Barra de topo — só no mobile */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-slate-950 border-b border-slate-800 px-4 py-3 print:hidden">
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="text-slate-200 hover:text-white p-1 -ml-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="leading-tight">
          <span className="text-base font-bold text-white">ChronoMax</span>
          <span className="text-xs text-slate-400 ml-1">Kits</span>
        </div>
      </header>

      {/* Barra lateral fixa — só no desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-slate-950 border-r border-slate-800 p-4 flex-col print:hidden">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">ChronoMax</h1>
          <p className="text-xs text-slate-400">Kits</p>
        </div>
        {nav}
        {rodape}
      </aside>

      {/* Drawer sobreposto — só no mobile, quando aberto */}
      {aberto && (
        <div className="lg:hidden fixed inset-0 z-50 print:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAberto(false)} />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[82%] bg-slate-950 border-r border-slate-800 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-white">ChronoMax</h1>
                <p className="text-xs text-slate-400">Kits</p>
              </div>
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="text-slate-400 hover:text-white p-1"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            {nav}
            {rodape}
          </div>
        </div>
      )}
    </>
  );
}
