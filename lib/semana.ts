/**
 * Interpreta uma data em formato variado, sem nunca lançar.
 * Aceita: "dd/mm/yyyy", "d/m/yyyy" e ISO "yyyy-mm-dd" (com hora opcional).
 * Retorna null apenas quando realmente não dá pra interpretar (assim nenhum
 * evento some silenciosamente — quem chama decide o que fazer com null).
 */
export function parseDataBR(s: string | null | undefined): Date | null {
  if (!s) return null;
  const txt = String(s).trim();
  if (!txt) return null;

  // dd/mm/yyyy ou d/m/yyyy
  let m = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO yyyy-mm-dd (interpreta a parte da data como local, evita virada de fuso)
  m = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function inicioSemana(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dia = r.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  r.setDate(r.getDate() + diff);
  return r;
}

export function fimSemana(d: Date): Date {
  const i = inicioSemana(d);
  const f = new Date(i);
  f.setDate(f.getDate() + 6);
  return f;
}

export function formatBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function chaveSemana(d: Date): string {
  return inicioSemana(d).toISOString().slice(0, 10);
}

// ── Janela de busca de eventos futuros ────────────────────────────────

export const JANELA_SEMANAS = 32;
export const JANELA_DIAS = JANELA_SEMANAS * 7; // 224

export function inicioDoDia(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function fimDoDia(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

/**
 * true se `data` está entre o início de hoje (ref) e o fim do dia de (ref + dias),
 * inclusive nas duas pontas. Com dias=224 cobre exatamente as próximas 32 semanas.
 */
export function dataNaJanela(data: Date, ref: Date = new Date(), dias: number = JANELA_DIAS): boolean {
  const ini = inicioDoDia(ref);
  const fim = fimDoDia(new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + dias));
  const t = data.getTime();
  return t >= ini.getTime() && t <= fim.getTime();
}
