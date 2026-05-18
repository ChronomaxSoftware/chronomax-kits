import Link from "next/link";
import { getSession } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-slate-950 border-r border-slate-800 p-4 flex flex-col print:hidden">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">ChronoMax</h1>
          <p className="text-xs text-slate-400">Kits</p>
        </div>

        <nav className="flex-1 space-y-1">
          <Link href="/" className="block px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200">
            Convocações
          </Link>
          <Link href="/importar" className="block px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200">
            Importar evento
          </Link>
          <Link href="/tecnicos" className="block px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200">
            Técnicos
          </Link>
          <Link href="/produtos" className="block px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200">
            Produtos & Estoque
          </Link>
          <Link href="/bases" className="block px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200">
            Estoque por base
          </Link>
          <Link href="/celulares-chip" className="block px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200">
            Celulares com chip
          </Link>
          <Link href="/alugados" className="block px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200">
            Alugados
          </Link>
          <Link href="/config" className="block px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200">
            Configurações
          </Link>
        </nav>

        <div className="border-t border-slate-800 pt-3 mt-3">
          <p className="text-sm text-slate-300">{session.name}</p>
          <p className="text-xs text-slate-500 mb-2">@{session.username}</p>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
