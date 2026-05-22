import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";

export type StaffRole = "admin" | "tecnico";

export type StaffSession = {
  role: StaffRole;
  usuario: string; // nome exibível do operador (admin ou técnico)
  tecnicoId?: number;
  userId?: number;
};

/**
 * Sessão do módulo Staff. Aceita admin e técnico.
 * Sessões antigas (logadas antes do campo `role` existir) são tratadas como admin.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const session = await getSession();
  if (!session.isLoggedIn) return null;
  const role: StaffRole = session.role === "tecnico" ? "tecnico" : "admin";
  return {
    role,
    usuario: session.name || session.username || "?",
    tecnicoId: session.tecnicoId,
    userId: session.userId,
  };
}

export function getClientInfo(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "?";
  const navegador = req.headers.get("user-agent") || "?";
  return { ip, navegador };
}
