require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const db = require('./database');
const { gerarDevocional } = require('./generate');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'ivt-admin-2026';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────────────────────

function dataHojeBrasil() {
  return new Date()
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/')
    .reverse()
    .join('-');
}

function autenticarAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Acesso não autorizado' });
  }
  next();
}

// ── Rotas públicas ────────────────────────────────────────────────────────────

// Página principal da mensagem (acessada via NFC)
app.get('/mensagem', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mensagem.html'));
});

// Devocional de hoje
app.get('/api/devocional/hoje', (req, res) => {
  const hoje = dataHojeBrasil();
  const devocional = db.prepare('SELECT * FROM devocionais WHERE data = ?').get(hoje);

  if (!devocional) {
    return res.status(404).json({
      error: 'Nenhum devocional para hoje',
      data: hoje,
    });
  }

  res.json(devocional);
});

// Devocional por data
app.get('/api/devocional/:data', (req, res) => {
  const devocional = db.prepare('SELECT * FROM devocionais WHERE data = ?').get(req.params.data);

  if (!devocional) {
    return res.status(404).json({ error: 'Devocional não encontrado para esta data' });
  }

  res.json(devocional);
});

// Últimos N devocionais (para navegação)
app.get('/api/devocionais/recentes', (req, res) => {
  const limite = Math.min(parseInt(req.query.limite) || 7, 30);
  const devocionais = db
    .prepare('SELECT * FROM devocionais ORDER BY data DESC LIMIT ?')
    .all(limite);
  res.json(devocionais);
});

// ── Rotas administrativas ─────────────────────────────────────────────────────

// Painel admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Listar todos os devocionais
app.get('/api/admin/devocionais', autenticarAdmin, (req, res) => {
  const pagina = parseInt(req.query.pagina) || 1;
  const porPagina = 20;
  const offset = (pagina - 1) * porPagina;

  const total = db.prepare('SELECT COUNT(*) as n FROM devocionais').get().n;
  const devocionais = db
    .prepare('SELECT * FROM devocionais ORDER BY data DESC LIMIT ? OFFSET ?')
    .all(porPagina, offset);

  res.json({ total, pagina, por_pagina: porPagina, devocionais });
});

// Gerar devocional com IA para uma data
app.post('/api/admin/gerar', autenticarAdmin, async (req, res) => {
  try {
    const { data } = req.body;
    const devocional = await gerarDevocional(data);
    res.json({ sucesso: true, devocional });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar devocional: ' + err.message });
  }
});

// Criar/editar devocional manualmente
app.post('/api/admin/devocional', autenticarAdmin, (req, res) => {
  const { data, versiculo_referencia, versiculo_texto, reflexao, pratica, tema, youtube_id } = req.body;

  if (!data || !versiculo_referencia || !versiculo_texto || !reflexao || !pratica) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  db.prepare(`
    INSERT OR REPLACE INTO devocionais (data, versiculo_referencia, versiculo_texto, reflexao, pratica, tema, youtube_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data, versiculo_referencia, versiculo_texto, reflexao, pratica, tema || '', youtube_id || null);

  res.json({ sucesso: true });
});

// Deletar devocional
app.delete('/api/admin/devocional/:data', autenticarAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM devocionais WHERE data = ?').run(req.params.data);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Devocional não encontrado' });
  }
  res.json({ sucesso: true });
});

// ── Geração automática via cron ────────────────────────────────────────────────

// Roda todo dia às 00:05 (horário de Brasília) para gerar o devocional do dia
if (process.env.ANTHROPIC_API_KEY) {
  cron.schedule(
    '5 0 * * *',
    async () => {
      console.log('[CRON] Gerando devocional do dia...');
      try {
        await gerarDevocional();
        console.log('[CRON] Devocional gerado com sucesso.');
      } catch (err) {
        console.error('[CRON] Erro ao gerar devocional:', err.message);
      }
    },
    { timezone: 'America/Sao_Paulo' }
  );
}

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║         IVT Devocional - Servidor            ║
╠══════════════════════════════════════════════╣
║  Site:  https://vidatriunfante.com           ║
║  NFC:   https://vidatriunfante.com/mensagem  ║
║  Admin: https://vidatriunfante.com/admin     ║
║  Local: http://localhost:${PORT}                  ║
╚══════════════════════════════════════════════╝
  `);
});
