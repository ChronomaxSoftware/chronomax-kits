/**
 * Textos do link de acesso do técnico (usado na tela — sem dependências de servidor).
 * A geração/validação do código fica em lib/convite.ts.
 */

import { loginDeTelefone } from "./login-tecnico";

export const VALIDADE_CONVITE_DIAS = 7;

/** Mensagem pronta para o WhatsApp do técnico. */
export function mensagemConvite(nome: string, link: string): string {
  const primeiro = String(nome || "").trim().split(/\s+/)[0] || "";
  return (
    `Olá${primeiro ? ` ${primeiro}` : ""}! Este é o seu acesso ao portal de entregas da Chronomax.\n\n` +
    `Abra o link, crie a sua senha e pronto:\n${link}\n\n` +
    `Depois é só entrar com o seu telefone e essa senha. O link vale ${VALIDADE_CONVITE_DIAS} dias e funciona uma vez.`
  );
}

/** Link wa.me com DDI 55; null se o telefone não for válido. */
export function linkWhatsApp(telefone: unknown, texto: string): string | null {
  const d = loginDeTelefone(telefone);
  return d ? `https://wa.me/55${d}?text=${encodeURIComponent(texto)}` : null;
}
