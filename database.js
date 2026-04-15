const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new DatabaseSync(path.join(DATA_DIR, 'devocional.db'));

db.exec(`
  -- Devocionais gerais
  CREATE TABLE IF NOT EXISTS devocionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT UNIQUE NOT NULL,
    versiculo_referencia TEXT NOT NULL,
    versiculo_texto TEXT NOT NULL,
    reflexao TEXT NOT NULL,
    pratica TEXT NOT NULL,
    tema TEXT,
    youtube_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Devocionais HFC (Homens de Fé e Caráter)
  CREATE TABLE IF NOT EXISTS devocionais_hfc (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT UNIQUE NOT NULL,
    versiculo_referencia TEXT NOT NULL,
    versiculo_texto TEXT NOT NULL,
    reflexao TEXT NOT NULL,
    pratica TEXT NOT NULL,
    tema TEXT,
    youtube_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Anúncios
  CREATE TABLE IF NOT EXISTS anuncios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    data_inicio TEXT NOT NULL,
    data_fim TEXT,
    destaque INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Comunicados
  CREATE TABLE IF NOT EXISTS comunicados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    data TEXT NOT NULL,
    importante INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Eventos (com inscrição via QR code)
  CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_evento TEXT NOT NULL,
    horario TEXT,
    local TEXT,
    vagas INTEGER,
    gratuito INTEGER DEFAULT 1,
    valor TEXT,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Inscrições em eventos
  CREATE TABLE IF NOT EXISTS inscricoes_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(evento_id) REFERENCES eventos(id)
  );

  -- Cursos (com inscrição via QR code)
  CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TEXT NOT NULL,
    duracao TEXT,
    local TEXT,
    vagas INTEGER,
    gratuito INTEGER DEFAULT 1,
    valor TEXT,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Inscrições em cursos
  CREATE TABLE IF NOT EXISTS inscricoes_cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(curso_id) REFERENCES cursos(id)
  );

  -- Playlists do YouTube
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    playlist_id TEXT NOT NULL,
    categoria TEXT DEFAULT 'geral',
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Pedidos de oração
  CREATE TABLE IF NOT EXISTS pedidos_oracao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    pedido TEXT NOT NULL,
    publico INTEGER DEFAULT 0,
    respondido INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Agenda da igreja
  CREATE TABLE IF NOT EXISTS agenda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data TEXT NOT NULL,
    horario TEXT,
    local TEXT,
    recorrente INTEGER DEFAULT 0,
    dia_semana TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Links de redes sociais e outros
  CREATE TABLE IF NOT EXISTS links_sociais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    url TEXT NOT NULL,
    icone TEXT DEFAULT 'link',
    ordem INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrações
const migrações = [
  'ALTER TABLE devocionais ADD COLUMN youtube_id TEXT',
  "ALTER TABLE eventos ADD COLUMN pagina TEXT DEFAULT 'ambos'",
  "ALTER TABLE cursos  ADD COLUMN pagina TEXT DEFAULT 'ambos'",
];
migrações.forEach(sql => { try { db.exec(sql); } catch {} });

// Seed links sociais
const rowLinks = db.prepare('SELECT COUNT(*) as n FROM links_sociais').get();
if (rowLinks.n === 0) {
  db.prepare("INSERT INTO links_sociais (nome, url, icone, ordem) VALUES (?,?,?,?)").run('Instagram', 'https://www.instagram.com/ap.isaqueoficial/', 'instagram', 1);
  db.prepare("INSERT INTO links_sociais (nome, url, icone, ordem) VALUES (?,?,?,?)").run('YouTube', 'https://www.youtube.com/@prisaqueoficial', 'youtube', 2);
}

// Seed devocional inicial
const row = db.prepare('SELECT COUNT(*) as n FROM devocionais').get();
if (row.n === 0) {
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/').reverse().join('-');
  db.prepare(`
    INSERT OR IGNORE INTO devocionais (data, versiculo_referencia, versiculo_texto, reflexao, pratica, tema)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(hoje,
    'Salmo 119:105',
    'A tua palavra é lâmpada que ilumina os meus passos e o meu caminho.',
    'Nem sempre enxergamos o caminho inteiro, mas Jesus ilumina o próximo passo. Sua direção vem no tempo certo, sem pressa e sem confusão.',
    'Antes de uma decisão hoje, faça uma breve pausa e busque direção na Palavra.',
    'Fé e Confiança'
  );
}

module.exports = db;
