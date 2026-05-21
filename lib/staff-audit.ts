import { NextRequest } from "next/server";
import { dbRun } from "@/lib/db";
import { getClientInfo } from "@/lib/staff-auth";

/**
 * Registra uma ação no log de auditoria do módulo Staff.
 * Nunca lança — auditoria não pode derrubar a operação principal.
 */
export async function registrarAuditoria(
  req: NextRequest,
  usuario: string,
  acao: string,
  detalhes?: string
) {
  const { ip, navegador } = getClientInfo(req);
  try {
    await dbRun(
      "INSERT INTO staff_audit_logs (usuario, acao, detalhes, ip, navegador) VALUES (?, ?, ?, ?, ?)",
      usuario,
      acao,
      detalhes ?? null,
      ip,
      navegador
    );
  } catch {
    /* auditoria nunca deve quebrar a operação */
  }
}
