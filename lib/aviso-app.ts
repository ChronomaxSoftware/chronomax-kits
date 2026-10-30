/**
 * Aviso "o app mudou" (nome Kits Gestão + ícone novo, 30/10/2026): aparece no portal
 * para quem já tinha acessado antes da mudança — pode ter o ícone antigo instalado —
 * até tocar em "Já atualizei".
 */

/** Momento em que o nome/ícone novos entraram no ar. */
export const AVISO_APP_DESDE = "2026-10-30T15:05:00.000Z";

export function precisaAvisoApp(t: {
  tutorial_visto_em: string | null;
  convite_usado_em: string | null;
  aviso_app_visto_em: string | null;
}): boolean {
  if (t.aviso_app_visto_em) return false;
  const antes = (iso: string | null) => !!iso && iso < AVISO_APP_DESDE;
  return antes(t.tutorial_visto_em) || antes(t.convite_usado_em);
}
