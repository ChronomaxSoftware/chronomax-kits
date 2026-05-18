import { createClient, type Client, type InValue } from "@libsql/client";
import bcrypt from "bcryptjs";

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

// ── helpers async que substituem db.prepare().run/get/all ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dbRun(sql: string, ...args: any[]) {
  const client = getClient();
  const result = await client.execute({ sql, args: args as InValue[] });
  return { lastInsertRowid: result.lastInsertRowid, changes: result.rowsAffected };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dbGet<T = Record<string, unknown>>(sql: string, ...args: any[]): Promise<T | undefined> {
  const client = getClient();
  const result = await client.execute({ sql, args: args as InValue[] });
  return (result.rows[0] as T | undefined);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dbAll<T = Record<string, unknown>>(sql: string, ...args: any[]): Promise<T[]> {
  const client = getClient();
  const result = await client.execute({ sql, args: args as InValue[] });
  return result.rows as T[];
}

export async function dbExec(sql: string) {
  const client = getClient();
  await client.executeMultiple(sql);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dbBatch(statements: { sql: string; args: any[] }[]) {
  if (statements.length === 0) return [];
  const client = getClient();
  return client.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args as InValue[] })),
    "write"
  );
}

// ── inicialização do schema (chamada uma vez) ──

let _initialized = false;

export async function initDB() {
  if (_initialized) return;
  _initialized = true;

  await dbExec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  data TEXT NOT NULL,
  cidade TEXT,
  uf TEXT,
  qtd_celulares INTEGER DEFAULT 0,
  dias_entrega INTEGER DEFAULT 0,
  qtd_atletas INTEGER DEFAULT 0,
  nivel TEXT,
  data_entrega TEXT,
  hora_entrega TEXT,
  status TEXT DEFAULT 'pendente',
  observacoes TEXT,
  url_gestao TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tecnicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT,
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT UNIQUE NOT NULL,
  ativo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evento_tecnicos (
  evento_id INTEGER NOT NULL,
  tecnico_id INTEGER NOT NULL,
  PRIMARY KEY (evento_id, tecnico_id),
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
  FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evento_produtos (
  evento_id INTEGER NOT NULL,
  produto_id INTEGER NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (evento_id, produto_id),
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL,
  mensagem TEXT,
  eventos_encontrados INTEGER DEFAULT 0,
  eventos_kit INTEGER DEFAULT 0,
  eventos_importados INTEGER DEFAULT 0,
  iniciado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  finalizado_em TEXT
);

CREATE TABLE IF NOT EXISTS bases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT UNIQUE NOT NULL,
  uf TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estoque_base (
  base_id INTEGER NOT NULL,
  produto_id INTEGER NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (base_id, produto_id),
  FOREIGN KEY (base_id) REFERENCES bases(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evento_kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  imagem_path TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS celulares_chip (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apelido TEXT,
  numero TEXT,
  operadora TEXT,
  identificador TEXT,
  base_id INTEGER,
  evento_id INTEGER,
  observacao TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (base_id) REFERENCES bases(id) ON DELETE SET NULL,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS equipamentos_alugados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  identificador TEXT,
  fornecedor TEXT,
  evento_id INTEGER,
  observacao TEXT,
  data_inicio TEXT,
  data_fim TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS evento_itens_gestao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 0,
  unidade TEXT,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_evento_itens_gestao_evento_id ON evento_itens_gestao(evento_id);

CREATE TABLE IF NOT EXISTS evento_equipe_gestao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  funcao TEXT,
  cpf_prefixo TEXT,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_evento_equipe_gestao_evento_id ON evento_equipe_gestao(evento_id);
  `);

  // ── Migrations (ALTER TABLE) ──

  async function colExiste(tab: string, col: string): Promise<boolean> {
    const rows = await dbAll<{ name: string }>(`PRAGMA table_info(${tab})`);
    return rows.some((c) => c.name === col);
  }

  const migrations: [string, string, string][] = [
    ["produtos", "quantidade_estoque", "ALTER TABLE produtos ADD COLUMN quantidade_estoque INTEGER DEFAULT 0"],
    ["eventos", "local_entrega", "ALTER TABLE eventos ADD COLUMN local_entrega TEXT"],
    ["eventos", "base1_ok", "ALTER TABLE eventos ADD COLUMN base1_ok INTEGER DEFAULT 0"],
    ["eventos", "base_final_ok", "ALTER TABLE eventos ADD COLUMN base_final_ok INTEGER DEFAULT 0"],
    ["eventos", "base1_ok_em", "ALTER TABLE eventos ADD COLUMN base1_ok_em TEXT"],
    ["eventos", "base_final_ok_em", "ALTER TABLE eventos ADD COLUMN base_final_ok_em TEXT"],
    ["equipamentos_alugados", "quantidade", "ALTER TABLE equipamentos_alugados ADD COLUMN quantidade INTEGER DEFAULT 1"],
    ["celulares_chip", "quantidade", "ALTER TABLE celulares_chip ADD COLUMN quantidade INTEGER DEFAULT 1"],
    ["eventos", "briefing_data", "ALTER TABLE eventos ADD COLUMN briefing_data TEXT"],
    ["eventos", "briefing_hora", "ALTER TABLE eventos ADD COLUMN briefing_hora TEXT"],
    ["eventos", "datas_horarios_retirada", "ALTER TABLE eventos ADD COLUMN datas_horarios_retirada TEXT"],
    ["eventos", "endereco_retirada", "ALTER TABLE eventos ADD COLUMN endereco_retirada TEXT"],
    ["eventos", "avisos_retirada", "ALTER TABLE eventos ADD COLUMN avisos_retirada TEXT"],
    ["eventos", "obs_retirada", "ALTER TABLE eventos ADD COLUMN obs_retirada TEXT"],
    ["eventos", "cronograma_evento", "ALTER TABLE eventos ADD COLUMN cronograma_evento TEXT"],
    ["eventos", "passo_a_passo_kits", "ALTER TABLE eventos ADD COLUMN passo_a_passo_kits TEXT"],
    ["eventos", "entrega_locais_separados", "ALTER TABLE eventos ADD COLUMN entrega_locais_separados TEXT"],
    ["eventos", "qtd_roteadores", "ALTER TABLE eventos ADD COLUMN qtd_roteadores INTEGER DEFAULT 0"],
    ["eventos", "qtd_celulares_grupo_online", "ALTER TABLE eventos ADD COLUMN qtd_celulares_grupo_online INTEGER DEFAULT 0"],
    ["eventos", "qtd_celulares_produtos_online", "ALTER TABLE eventos ADD COLUMN qtd_celulares_produtos_online INTEGER DEFAULT 0"],
    ["eventos", "qtd_notebooks", "ALTER TABLE eventos ADD COLUMN qtd_notebooks INTEGER DEFAULT 0"],
    ["eventos", "qtd_totens", "ALTER TABLE eventos ADD COLUMN qtd_totens INTEGER DEFAULT 0"],
    ["eventos", "url_site_oficial", "ALTER TABLE eventos ADD COLUMN url_site_oficial TEXT"],
    ["eventos", "links_evento", "ALTER TABLE eventos ADD COLUMN links_evento TEXT"],
    ["eventos", "usuarios_evento", "ALTER TABLE eventos ADD COLUMN usuarios_evento TEXT"],
    ["eventos", "local_prova", "ALTER TABLE eventos ADD COLUMN local_prova TEXT"],
    ["eventos", "tipo_kit", "ALTER TABLE eventos ADD COLUMN tipo_kit TEXT"],
    ["evento_equipe_gestao", "is_entrega_kit", "ALTER TABLE evento_equipe_gestao ADD COLUMN is_entrega_kit INTEGER DEFAULT 0"],
    ["evento_equipe_gestao", "cache_ek", "ALTER TABLE evento_equipe_gestao ADD COLUMN cache_ek INTEGER DEFAULT 0"],
  ];

  // tem_kit precisa de backfill especial
  if (!(await colExiste("eventos", "tem_kit"))) {
    await dbRun("ALTER TABLE eventos ADD COLUMN tem_kit INTEGER DEFAULT 0");
    await dbRun("UPDATE eventos SET tem_kit = 1");
  }

  if (!(await colExiste("tecnicos", "cpf_prefixo"))) {
    await dbRun("ALTER TABLE tecnicos ADD COLUMN cpf_prefixo TEXT");
    await dbRun("CREATE INDEX IF NOT EXISTS idx_tecnicos_cpf_prefixo ON tecnicos(cpf_prefixo)");
  }
  if (!(await colExiste("tecnicos", "email"))) {
    await dbRun("ALTER TABLE tecnicos ADD COLUMN email TEXT");
  }
  if (!(await colExiste("tecnicos", "cidade"))) {
    await dbRun("ALTER TABLE tecnicos ADD COLUMN cidade TEXT");
  }
  if (!(await colExiste("tecnicos", "ultima_sync_gestao"))) {
    await dbRun("ALTER TABLE tecnicos ADD COLUMN ultima_sync_gestao TEXT");
  }

  for (const [tab, col, sql] of migrations) {
    if (!(await colExiste(tab, col))) {
      await dbRun(sql);
    }
  }

  // ── Seed data ──

  const hash = bcrypt.hashSync("chronomax", 10);
  await dbRun("INSERT OR IGNORE INTO users (username, password_hash, name) VALUES (?, ?, ?)", "admin", hash, "Administrador");
  await dbRun("INSERT OR IGNORE INTO users (username, password_hash, name) VALUES (?, ?, ?)", "lider", hash, "Líder");

  for (const nome of ["Notebook", "Celular", "Extensão", "Régua de energia", "Totem", "Roteador"]) {
    await dbRun("INSERT OR IGNORE INTO produtos (nome) VALUES (?)", nome);
  }

  await dbRun("INSERT OR IGNORE INTO bases (nome, uf, ordem) VALUES (?, ?, ?)", "Porto Alegre", "RS", 1);
  await dbRun("INSERT OR IGNORE INTO bases (nome, uf, ordem) VALUES (?, ?, ?)", "São Paulo", "SP", 2);
  await dbRun("INSERT OR IGNORE INTO bases (nome, uf, ordem) VALUES (?, ?, ?)", "Rio de Janeiro", "RJ", 3);
  await dbRun("INSERT OR IGNORE INTO bases (nome, uf, ordem) VALUES (?, ?, ?)", "Aracaju", "SE", 4);
}
