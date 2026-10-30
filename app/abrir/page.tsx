import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** Entrada do app instalado (start_url): manda cada um para o seu lugar. */
export default async function Abrir() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");
  redirect(session.role === "tecnico" ? "/portal" : "/");
}
