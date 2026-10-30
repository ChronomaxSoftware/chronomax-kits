/**
 * Textos do link de acesso do técnico (usado na tela — sem dependências de servidor).
 * A geração/validação do código fica em lib/convite.ts.
 */

import { loginDeTelefone } from "./login-tecnico";

/** Mensagem pronta para o WhatsApp do técnico. */
export function mensagemConvite(nome: string, link: string): string {
  const primeiro = String(nome || "").trim().split(/\s+/)[0] || "";
  return (
    `Olá${primeiro ? ` ${primeiro}` : ""}! Este é o seu acesso ao portal de entregas da Chronomax.\n\n` +
    `Na primeira vez, abra o link e crie a sua senha:\n${link}\n\n` +
    `Guarde este link: ele é o seu acesso. Nas próximas vezes ele abre o login com o seu telefone, é só digitar a senha.\n\n` +
    `Dica: depois de entrar, siga o card "Instale o app no celular" para ter o ícone Chronomax na tela inicial.`
  );
}

/** Link wa.me com DDI 55; null se o telefone não for válido. */
export function linkWhatsApp(telefone: unknown, texto: string): string | null {
  const d = loginDeTelefone(telefone);
  return d ? `https://wa.me/55${d}?text=${encodeURIComponent(texto)}` : null;
}
