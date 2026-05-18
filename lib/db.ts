import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

let _db: Database.Database | null = null;

function init(): Database.Database {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "chronomax.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
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
  `);

  function colExiste(tab: string, col: string): boolean {
    const cols = db.prepare(`PRAGMA table_info(${tab})`).all() as { name: string }[];
    return cols.some((c) => c.name === col);
  }

  if (!colExiste("produtos", "quantidade_estoque")) {
    db.exec("ALTER TABLE produtos ADD COLUMN quantidade_estoque INTEGER DEFAULT 0");
  }
  if (!colExiste("eventos", "local_entrega")) {
    db.exec("ALTER TABLE eventos ADD COLUMN local_entrega TEXT");
  }
  if (!colExiste("eventos", "base1_ok")) {
    db.exec("ALTER TABLE eventos ADD COLUMN base1_ok INTEGER DEFAULT 0");
  }
  if (!colExiste("eventos", "base_final_ok")) {
    db.exec("ALTER TABLE eventos ADD COLUMN base_final_ok INTEGER DEFAULT 0");
  }
  if (!colExiste("eventos", "base1_ok_em")) {
    db.exec("ALTER TABLE eventos ADD COLUMN base1_ok_em TEXT");
  }
  if (!colExiste("eventos", "base_final_ok_em")) {
    db.exec("ALTER TABLE eventos ADD COLUMN base_final_ok_em TEXT");
  }
  if (!colExiste("equipamentos_alugados", "quantidade")) {
    db.exec("ALTER TABLE equipamentos_alugados ADD COLUMN quantidade INTEGER DEFAULT 1");
  }
  if (!colExiste("celulares_chip", "quantidade")) {
    db.exec("ALTER TABLE celulares_chip ADD COLUMN quantidade INTEGER DEFAULT 1");
  }
  if (!colExiste("eventos", "briefing_data")) {
    db.exec("ALTER TABLE eventos ADD COLUMN briefing_data TEXT");
  }
  if (!colExiste("eventos", "briefing_hora")) {
    db.exec("ALTER TABLE eventos ADD COLUMN briefing_hora TEXT");
  }
  if (!colExiste("eventos", "tem_kit")) {
    db.exec("ALTER TABLE eventos ADD COLUMN tem_kit INTEGER DEFAULT 0");
    // Backfill: todos os eventos existentes vieram via filtro de kit, então marca tudo como 1
    db.exec("UPDATE eventos SET tem_kit = 1");
  }
  if (!colExiste("tecnicos", "cpf_prefixo")) {
    db.exec("ALTER TABLE tecnicos ADD COLUMN cpf_prefixo TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_tecnicos_cpf_prefixo ON tecnicos(cpf_prefixo)");
  }
  if (!colExiste("tecnicos", "email")) {
    db.exec("ALTER TABLE tecnicos ADD COLUMN email TEXT");
  }
  if (!colExiste("tecnicos", "cidade")) {
    db.exec("ALTER TABLE tecnicos ADD COLUMN cidade TEXT");
  }
  if (!colExiste("tecnicos", "ultima_sync_gestao")) {
    db.exec("ALTER TABLE tecnicos ADD COLUMN ultima_sync_gestao TEXT");
  }
  // Campos do book de entrega de kit
  if (!colExiste("eventos", "datas_horarios_retirada")) {
    db.exec("ALTER TABLE eventos ADD COLUMN datas_horarios_retirada TEXT");
  }
  if (!colExiste("eventos", "endereco_retirada")) {
    db.exec("ALTER TABLE eventos ADD COLUMN endereco_retirada TEXT");
  }
  if (!colExiste("eventos", "avisos_retirada")) {
    db.exec("ALTER TABLE eventos ADD COLUMN avisos_retirada TEXT");
  }
  if (!colExiste("eventos", "obs_retirada")) {
    db.exec("ALTER TABLE eventos ADD COLUMN obs_retirada TEXT");
  }
  if (!colExiste("eventos", "cronograma_evento")) {
    db.exec("ALTER TABLE eventos ADD COLUMN cronograma_evento TEXT");
  }
  if (!colExiste("eventos", "passo_a_passo_kits")) {
    db.exec("ALTER TABLE eventos ADD COLUMN passo_a_passo_kits TEXT");
  }
  if (!colExiste("eventos", "entrega_locais_separados")) {
    db.exec("ALTER TABLE eventos ADD COLUMN entrega_locais_separados TEXT");
  }
  if (!colExiste("eventos", "qtd_roteadores")) {
    db.exec("ALTER TABLE eventos ADD COLUMN qtd_roteadores INTEGER DEFAULT 0");
  }
  if (!colExiste("eventos", "qtd_celulares_grupo_online")) {
    db.exec("ALTER TABLE eventos ADD COLUMN qtd_celulares_grupo_online INTEGER DEFAULT 0");
  }
  if (!colExiste("eventos", "qtd_celulares_produtos_online")) {
    db.exec("ALTER TABLE eventos ADD COLUMN qtd_celulares_produtos_online INTEGER DEFAULT 0");
  }
  if (!colExiste("eventos", "qtd_notebooks")) {
    db.exec("ALTER TABLE eventos ADD COLUMN qtd_notebooks INTEGER DEFAULT 0");
  }
  if (!colExiste("eventos", "qtd_totens")) {
    db.exec("ALTER TABLE eventos ADD COLUMN qtd_totens INTEGER DEFAULT 0");
  }
  if (!colExiste("eventos", "url_site_oficial")) {
    db.exec("ALTER TABLE eventos ADD COLUMN url_site_oficial TEXT");
  }
  if (!colExiste("eventos", "links_evento")) {
    db.exec("ALTER TABLE eventos ADD COLUMN links_evento TEXT");
  }
  if (!colExiste("eventos", "usuarios_evento")) {
    db.exec("ALTER TABLE eventos ADD COLUMN usuarios_evento TEXT");
  }
  if (!colExiste("eventos", "local_prova")) {
    db.exec("ALTER TABLE eventos ADD COLUMN local_prova TEXT");
  }
  if (!colExiste("eventos", "tipo_kit")) {
    // 'entrega' = Chronomax envia equipe (técnicos com E.K > 0)
    // 'sistema' = só fornece sistema (item Estação de Entrega de Kits via App GoRunKing)
    // null = sem kit
    db.exec("ALTER TABLE eventos ADD COLUMN tipo_kit TEXT");
  }

  // Tabelas pra dados extraídos do Gestão usados pelo book de evento
  // (separadas das tabelas core porque são consumidas por chronomax-grupos-wa)
  db.exec(`
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

  if (!colExiste("evento_equipe_gestao", "is_entrega_kit")) {
    db.exec("ALTER TABLE evento_equipe_gestao ADD COLUMN is_entrega_kit INTEGER DEFAULT 0");
  }
  if (!colExiste("evento_equipe_gestao", "cache_ek")) {
    db.exec("ALTER TABLE evento_equipe_gestao ADD COLUMN cache_ek INTEGER DEFAULT 0");
  }

  const hash = bcrypt.hashSync("chronomax", 10);
  const insUser = db.prepare("INSERT OR IGNORE INTO users (username, password_hash, name) VALUES (?, ?, ?)");
  insUser.run("admin", hash, "Administrador");
  insUser.run("lider", hash, "Líder");

  const insProd = db.prepare("INSERT OR IGNORE INTO produtos (nome) VALUES (?)");
  ["Notebook", "Celular", "Extensão", "Régua de energia", "Totem", "Roteador"].forEach((n) => insProd.run(n));

  const insBase = db.prepare("INSERT OR IGNORE INTO bases (nome, uf, ordem) VALUES (?, ?, ?)");
  insBase.run("Porto Alegre", "RS", 1);
  insBase.run("São Paulo", "SP", 2);
  insBase.run("Rio de Janeiro", "RJ", 3);
  insBase.run("Aracaju", "SE", 4);

  return db;
}

export function getDB(): Database.Database {
  if (!_db) _db = init();
  return _db;
}

const proxy = new Proxy({} as Database.Database, {
  get(_, prop) {
    const target = getDB() as unknown as Record<string | symbol, unknown>;
    const v = target[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
  },
});

export default proxy;
