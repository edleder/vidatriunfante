const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const db = new DatabaseSync(path.join(DATA_DIR, 'devocional.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS devocionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT UNIQUE NOT NULL,
    versiculo_referencia TEXT NOT NULL,
    versiculo_texto TEXT NOT NULL,
    reflexao TEXT NOT NULL,
    pratica TEXT NOT NULL,
    tema TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed com dados de exemplo se estiver vazio
const row = db.prepare('SELECT COUNT(*) as n FROM devocionais').get();
if (row.n === 0) {
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/').reverse().join('-');

  db.prepare(`
    INSERT OR IGNORE INTO devocionais (data, versiculo_referencia, versiculo_texto, reflexao, pratica, tema)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    hoje,
    'Salmo 119:105',
    'A tua palavra é lâmpada que ilumina os meus passos e o meu caminho.',
    'Nem sempre enxergamos o caminho inteiro, mas Jesus ilumina o próximo passo. Sua direção vem no tempo certo, sem pressa e sem confusão. Confiar nisso traz paz para continuar.',
    'Antes de uma decisão hoje, faça uma breve pausa e busque direção na Palavra. Leia um salmo e anote o que Deus fala ao seu coração.',
    'Fé e Confiança'
  );
}

module.exports = db;
