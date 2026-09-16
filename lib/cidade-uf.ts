/**
 * Separa cidade e UF do campo "cidade" do Gestão, que vem em formatos variados:
 * "SANTOS/SP", "SANTOS - SP", "SÃO PAULO/SP.", "CAMPO MOURÃO -PARANÁ", "EMBRAPA - CAMPO GRANDE",
 * "PARANÁ", "Campinas"...
 *
 * Sem imports de propósito: scripts/corrigir-uf-eventos.mjs importa este arquivo direto (Node 24).
 */

const UFS_BR = new Set(
  "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ")
);

// Chaves sem acento e em maiúsculas (ver normalizar).
const ESTADOS: Record<string, string> = {
  ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA", CEARA: "CE",
  "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", GOIAS: "GO", MARANHAO: "MA",
  "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS", "MINAS GERAIS": "MG", PARA: "PA",
  PARAIBA: "PB", PARANA: "PR", PERNAMBUCO: "PE", PIAUI: "PI", "RIO GRANDE DO NORTE": "RN",
  "RIO GRANDE DO SUL": "RS", RONDONIA: "RO", RORAIMA: "RR", "SANTA CATARINA": "SC",
  SERGIPE: "SE", TOCANTINS: "TO",
  // "SAO PAULO" e "RIO DE JANEIRO" ficam em CIDADES: sem sigla, tratamos como a capital.
};

// Capitais + cidades que já apareceram sem sigla. Cidade nova sem sigla: acrescentar aqui.
const CIDADES: Record<string, string> = {
  "RIO BRANCO": "AC", MACEIO: "AL", MACAPA: "AP", MANAUS: "AM", SALVADOR: "BA", FORTALEZA: "CE",
  BRASILIA: "DF", VITORIA: "ES", GOIANIA: "GO", "SAO LUIS": "MA", CUIABA: "MT",
  "CAMPO GRANDE": "MS", "BELO HORIZONTE": "MG", BELEM: "PA", "JOAO PESSOA": "PB",
  CURITIBA: "PR", RECIFE: "PE", TERESINA: "PI", NATAL: "RN", "PORTO ALEGRE": "RS",
  "PORTO VELHO": "RO", "BOA VISTA": "RR", FLORIANOPOLIS: "SC", "SAO PAULO": "SP",
  ARACAJU: "SE", PALMAS: "TO", "RIO DE JANEIRO": "RJ",
  CAMPINAS: "SP", SANTOS: "SP", LONDRINA: "PR", MARINGA: "PR", "CAPAO DA CANOA": "RS",
};

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function ufDoNome(nome: string): string | null {
  const n = normalizar(nome);
  if (n.length === 2 && UFS_BR.has(n)) return n;
  return ESTADOS[n] ?? null;
}

export function parseCidadeUf(raw: string | null): { cidade: string | null; uf: string | null } {
  if (!raw || !raw.trim()) return { cidade: null, uf: null };
  const t = raw.trim().replace(/[.\s]+$/, "");

  // "CIDADE/SP", "CIDADE - SP", "CIDADE -PARANÁ"
  const m = t.match(/^(.+?)\s*[-/]\s*([^-/]+)$/);
  if (m) {
    const uf = ufDoNome(m[2]);
    if (uf) return { cidade: m[1].trim(), uf };
  }

  // Só a cidade ("Campinas") ou só o estado ("PARANÁ")
  const n = normalizar(t);
  if (CIDADES[n]) return { cidade: t, uf: CIDADES[n] };
  if (ESTADOS[n]) return { cidade: t, uf: ESTADOS[n] };

  // "EMBRAPA - CAMPO GRANDE": cidade conhecida depois do traço
  if (m && CIDADES[normalizar(m[2])]) return { cidade: t, uf: CIDADES[normalizar(m[2])] };

  return { cidade: t, uf: null };
}
