export function parseDataBR(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
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
