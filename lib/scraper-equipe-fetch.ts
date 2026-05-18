/**
 * Substituto do scraper-equipe.ts (Playwright) usando API REST do Gestão.
 * Mantém a mesma interface (EquipeScrapeResult, TecnicoEquipe) para compatibilidade
 * com o sync-equipe/route.ts.
 */

import { GestaoAPI } from "./gestao-api";

export type TecnicoEquipe = {
  cpf_prefixo: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
};

export type EquipeScrapeResult = {
  ok: boolean;
  erro?: string;
  totalCards: number;
  tecnicos: TecnicoEquipe[];
  diagnostico: string[];
};

export type EquipeScrapeOptions = {
  baseUrl: string;
  usuario: string;
  senha: string;
  visivel?: boolean;
  debug?: boolean;
  limite?: number;
};

export async function scrapeEquipe(opts: EquipeScrapeOptions): Promise<EquipeScrapeResult> {
  const log: string[] = [];

  try {
    log.push("Iniciando sync de equipe via API REST (sem Playwright)");

    // 1. Login
    const api = new GestaoAPI(opts.baseUrl);
    const loginRes = await api.login(opts.usuario, opts.senha);
    log.push(`Login OK: ${loginRes.user.name}`);

    // 2. Buscar técnicos (suppliers com categoria freelancers)
    log.push("Buscando técnicos via GET /api/financial/suppliers/technicians");
    const res = await api.getTechnicians();
    const suppliers = res.data || [];
    log.push(`Total de técnicos retornados: ${suppliers.length}`);

    // 3. Mapear para TecnicoEquipe
    const tecnicos: TecnicoEquipe[] = [];

    for (const s of suppliers) {
      if (!s.companyName && !s.tradeName) continue;
      if (s.isActive === false) continue;

      // CPF prefixo: ex "12345678900" → "123.456.789"
      let cpf_prefixo: string | null = null;
      if (s.document && s.documentType === "cpf") {
        const digits = s.document.replace(/\D/g, "");
        if (digits.length >= 9) {
          cpf_prefixo = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`;
        }
      }

      const nome = s.companyName || s.tradeName || "";

      tecnicos.push({
        cpf_prefixo,
        nome,
        telefone: s.phone || null,
        email: s.email || null,
        cidade: s.city || null,
      });

      log.push(`✓ ${nome} — ${s.phone || "(sem tel)"} — ${s.city || "(sem cidade)"}`);

      if (opts.limite && tecnicos.length >= opts.limite) {
        log.push(`Limite ${opts.limite} atingido`);
        break;
      }
    }

    log.push(`Total extraídos: ${tecnicos.length}`);

    return {
      ok: true,
      totalCards: suppliers.length,
      tecnicos,
      diagnostico: log,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`❌ ERRO: ${msg}`);
    return {
      ok: false,
      erro: msg,
      totalCards: 0,
      tecnicos: [],
      diagnostico: log,
    };
  }
}
