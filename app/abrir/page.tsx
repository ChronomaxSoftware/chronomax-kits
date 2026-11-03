import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { destinoDoRole } from "@/lib/perfil-usuario";

/** Entrada do app instalado (start_url): manda cada um para o seu lugar. */
export default async function Abrir() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");
  redirect(destinoDoRole(session.role));
}
