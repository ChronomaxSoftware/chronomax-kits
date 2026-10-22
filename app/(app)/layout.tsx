import { getSession } from "@/lib/session";
import Link from "next/link";
import Sidebar from "./Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar name={session.name ?? ""} username={session.username ?? ""} />
      <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-x-hidden">
        {session.senhaPadrao && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 print:hidden">
            Você entrou com a <strong>senha inicial</strong> do sistema.{" "}
            <Link href="/config#minha-senha" className="underline hover:text-white">
              Troque agora em Configurações
            </Link>
            .
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
