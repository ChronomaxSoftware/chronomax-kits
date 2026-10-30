/**
 * Aviso "o app mudou" (nome Kits Gestão + ícone novo, 30/10/2026): aparece no portal
 * para quem já tinha acessado — pode ter o ícone antigo instalado — até tocar em "Já atualizei".
 * O escritório pode reenviar (Configurações): grava a data em settings e o aviso volta para
 * todos que acessaram até ali, inclusive quem já tinha confirmado.
 */

/** Momento em que o nome/ícone novos entraram no ar. */
export const AVISO_APP_DESDE = "2026-10-30T15:05:00.000Z";

/** Confirmações de teste feitas no dia do lançamento não valem (reenvio inicial). */
export const AVISO_APP_REENVIO_INICIAL = "2026-10-30T15:30:00.000Z";

/** Chave em settings com a data do último reenvio pelo escritório. */
export const CHAVE_REENVIO = "aviso_app_reenviado_em";

export function precisaAvisoApp(
  t: {
    tutorial_visto_em: string | null;
    convite_usado_em: string | null;
    aviso_app_visto_em: string | null;
  },
  reenviadoEm: string | null = null
): boolean {
  // Sem reenvio manual: público = quem acessou antes da troca; vale a confirmação feita após o reenvio inicial
  const limiteAcesso = reenviadoEm ?? AVISO_APP_DESDE;
  const confirmouApos = reenviadoEm ?? AVISO_APP_REENVIO_INICIAL;
  if (t.aviso_app_visto_em && t.aviso_app_visto_em >= confirmouApos) return false;
  const antes = (iso: string | null) => !!iso && iso < limiteAcesso;
  return antes(t.tutorial_visto_em) || antes(t.convite_usado_em);
}
