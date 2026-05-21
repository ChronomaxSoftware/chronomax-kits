import { getSession } from "@/lib/session";
import PortalHeader from "./PortalHeader";
import PortalNav from "./PortalNav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-900">
      <PortalHeader name={session.name ?? "Técnico"} />
      <PortalNav />
      <main className="max-w-4xl mx-auto p-4">{children}</main>
    </div>
  );
}
