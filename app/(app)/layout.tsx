import { getSession } from "@/lib/session";
import Sidebar from "./Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar name={session.name ?? ""} username={session.username ?? ""} />
      <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-x-hidden">{children}</main>
    </div>
  );
}
