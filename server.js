require('dotenv').config();
const express = require('express');
const path    = require('path');
const cron    = require('node-cron');
const QRCode  = require('qrcode');
const db      = require('./database');
const { gerarDevocional } = require('./generate');

const app   = express();
const PORT  = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'ivt-admin-2026';
const BASE_URL    = process.env.DOMAIN || `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────────────────────
function dataHojeBR() {
  return new Date()
    .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/').reverse().join('-');
}

function auth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Não autorizado' });
  next();
}

// ── Páginas públicas ──────────────────────────────────────────────────────────
app.get('/mensagem',       (_, res) => res.sendFile(path.join(__dirname, 'public/mensagem.html')));
app.get('/hfc',            (_, res) => res.sendFile(path.join(__dirname, 'public/hfc.html')));
app.get('/evento/:id',     (_, res) => res.sendFile(path.join(__dirname, 'public/inscricao.html')));
app.get('/curso/:id',      (_, res) => res.sendFile(path.join(__dirname, 'public/inscricao.html')));
app.get('/admin',          (_, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// ── API Pública ───────────────────────────────────────────────────────────────

// Devocionais gerais
app.get('/api/devocional/hoje', (_, res) => {
  const d = db.prepare('SELECT * FROM devocionais WHERE data = ?').get(dataHojeBR());
  d ? res.json(d) : res.status(404).json({ error: 'Não encontrado', data: dataHojeBR() });
});
app.get('/api/devocional/:data', (req, res) => {
  const d = db.prepare('SELECT * FROM devocionais WHERE data = ?').get(req.params.data);
  d ? res.json(d) : res.status(404).json({ error: 'Não encontrado' });
});

// Devocionais HFC
app.get('/api/hfc/hoje', (_, res) => {
  const d = db.prepare('SELECT * FROM devocionais_hfc WHERE data = ?').get(dataHojeBR());
  d ? res.json(d) : res.status(404).json({ error: 'Não encontrado', data: dataHojeBR() });
});
app.get('/api/hfc/:data', (req, res) => {
  const d = db.prepare('SELECT * FROM devocionais_hfc WHERE data = ?').get(req.params.data);
  d ? res.json(d) : res.status(404).json({ error: 'Não encontrado' });
});

// Anúncios ativos
app.get('/api/anuncios', (_, res) => {
  const hoje = dataHojeBR();
  const items = db.prepare(`
    SELECT * FROM anuncios
    WHERE ativo = 1 AND data_inicio <= ?
      AND (data_fim IS NULL OR data_fim >= ?)
    ORDER BY destaque DESC, created_at DESC
  `).all(hoje, hoje);
  res.json(items);
});

// Comunicados
app.get('/api/comunicados', (_, res) => {
  const items = db.prepare('SELECT * FROM comunicados ORDER BY importante DESC, data DESC LIMIT 20').all();
  res.json(items);
});

// Eventos públicos
app.get('/api/eventos', (req, res) => {
  const pagina = req.query.pagina || 'geral';
  const items = db.prepare(
    "SELECT * FROM eventos WHERE ativo = 1 AND (pagina IS NULL OR pagina = 'ambos' OR pagina = ?) ORDER BY data_evento ASC"
  ).all(pagina);
  res.json(items);
});
app.get('/api/evento/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM eventos WHERE id = ?').get(req.params.id);
  item ? res.json(item) : res.status(404).json({ error: 'Não encontrado' });
});

// Inscrição em evento (pública)
app.post('/api/evento/:id/inscricao', (req, res) => {
  const { nome, email, telefone } = req.body;
  if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone obrigatórios' });

  const evento = db.prepare('SELECT * FROM eventos WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!evento) return res.status(404).json({ error: 'Evento não encontrado' });

  if (evento.vagas) {
    const total = db.prepare('SELECT COUNT(*) as n FROM inscricoes_eventos WHERE evento_id = ?').get(req.params.id).n;
    if (total >= evento.vagas) return res.status(400).json({ error: 'Vagas esgotadas' });
  }

  db.prepare('INSERT INTO inscricoes_eventos (evento_id, nome, email, telefone) VALUES (?,?,?,?)')
    .run(req.params.id, nome, email || '', telefone);
  res.json({ sucesso: true, mensagem: 'Inscrição realizada com sucesso!' });
});

// Cursos públicos
app.get('/api/cursos', (req, res) => {
  const pagina = req.query.pagina || 'geral';
  const items = db.prepare(
    "SELECT * FROM cursos WHERE ativo = 1 AND (pagina IS NULL OR pagina = 'ambos' OR pagina = ?) ORDER BY data_inicio ASC"
  ).all(pagina);
  res.json(items);
});
app.get('/api/curso/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM cursos WHERE id = ?').get(req.params.id);
  item ? res.json(item) : res.status(404).json({ error: 'Não encontrado' });
});

// Inscrição em curso (pública)
app.post('/api/curso/:id/inscricao', (req, res) => {
  const { nome, email, telefone } = req.body;
  if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone obrigatórios' });

  const curso = db.prepare('SELECT * FROM cursos WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!curso) return res.status(404).json({ error: 'Curso não encontrado' });

  if (curso.vagas) {
    const total = db.prepare('SELECT COUNT(*) as n FROM inscricoes_cursos WHERE curso_id = ?').get(req.params.id).n;
    if (total >= curso.vagas) return res.status(400).json({ error: 'Vagas esgotadas' });
  }

  db.prepare('INSERT INTO inscricoes_cursos (curso_id, nome, email, telefone) VALUES (?,?,?,?)')
    .run(req.params.id, nome, email || '', telefone);
  res.json({ sucesso: true, mensagem: 'Inscrição realizada com sucesso!' });
});

// Playlists
app.get('/api/playlists', (_, res) => {
  const items = db.prepare('SELECT * FROM playlists WHERE ativo = 1 ORDER BY categoria, titulo').all();
  res.json(items);
});

// Agenda
app.get('/api/agenda', (_, res) => {
  const hoje = dataHojeBR();
  const items = db.prepare('SELECT * FROM agenda WHERE data >= ? ORDER BY data, horario LIMIT 20').all(hoje);
  res.json(items);
});

// Pedidos de oração (públicos)
app.post('/api/oracao', (req, res) => {
  const { nome, pedido, publico } = req.body;
  if (!nome || !pedido) return res.status(400).json({ error: 'Nome e pedido obrigatórios' });
  db.prepare('INSERT INTO pedidos_oracao (nome, pedido, publico) VALUES (?,?,?)').run(nome, pedido, publico ? 1 : 0);
  res.json({ sucesso: true });
});
app.get('/api/oracao/publicos', (_, res) => {
  const items = db.prepare('SELECT id, nome, pedido, created_at FROM pedidos_oracao WHERE publico = 1 AND respondido = 0 ORDER BY created_at DESC LIMIT 20').all();
  res.json(items);
});

// Links extras de um devocional (públicos)
app.get('/api/devocional/:data/links', (req, res) => {
  const items = db.prepare("SELECT * FROM devocional_links WHERE data=? AND tipo='geral' ORDER BY ordem, created_at").all(req.params.data);
  res.json(items);
});
app.get('/api/hfc/:data/links', (req, res) => {
  const items = db.prepare("SELECT * FROM devocional_links WHERE data=? AND tipo='hfc' ORDER BY ordem, created_at").all(req.params.data);
  res.json(items);
});

// Links sociais (públicos)
app.get('/api/links', (_, res) => {
  const items = db.prepare('SELECT * FROM links_sociais WHERE ativo = 1 ORDER BY ordem, nome').all();
  res.json(items);
});

// ── QR Codes ──────────────────────────────────────────────────────────────────
app.get('/api/qrcode/evento/:id', async (req, res) => {
  const url = `${BASE_URL}/evento/${req.params.id}`;
  const svg = await QRCode.toString(url, { type: 'svg', width: 300, margin: 2 });
  res.type('svg').send(svg);
});
app.get('/api/qrcode/curso/:id', async (req, res) => {
  const url = `${BASE_URL}/curso/${req.params.id}`;
  const svg = await QRCode.toString(url, { type: 'svg', width: 300, margin: 2 });
  res.type('svg').send(svg);
});

// ── API Admin ─────────────────────────────────────────────────────────────────

// ── Devocionais Admin ──
app.get('/api/admin/devocionais', auth, (req, res) => {
  const tabela = req.query.tipo === 'hfc' ? 'devocionais_hfc' : 'devocionais';
  const p = parseInt(req.query.pagina) || 1;
  const total = db.prepare(`SELECT COUNT(*) as n FROM ${tabela}`).get().n;
  const items = db.prepare(`SELECT * FROM ${tabela} ORDER BY data DESC LIMIT 20 OFFSET ?`).all((p - 1) * 20);
  res.json({ total, pagina: p, por_pagina: 20, devocionais: items });
});

app.post('/api/admin/devocional', auth, (req, res) => {
  const { data, versiculo_referencia, versiculo_texto, reflexao, pratica, tema, youtube_id, tipo } = req.body;
  if (!data || !versiculo_referencia || !versiculo_texto || !reflexao || !pratica)
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  const tabela = tipo === 'hfc' ? 'devocionais_hfc' : 'devocionais';
  db.prepare(`INSERT OR REPLACE INTO ${tabela} (data,versiculo_referencia,versiculo_texto,reflexao,pratica,tema,youtube_id) VALUES (?,?,?,?,?,?,?)`)
    .run(data, versiculo_referencia, versiculo_texto, reflexao, pratica, tema||'', youtube_id||null);
  res.json({ sucesso: true });
});

app.delete('/api/admin/devocional/:data', auth, (req, res) => {
  const tabela = req.query.tipo === 'hfc' ? 'devocionais_hfc' : 'devocionais';
  db.prepare(`DELETE FROM ${tabela} WHERE data = ?`).run(req.params.data);
  res.json({ sucesso: true });
});

app.post('/api/admin/gerar', auth, async (req, res) => {
  try {
    const d = await gerarDevocional(req.body.data, req.body.tipo);
    res.json({ sucesso: true, devocional: d });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Anúncios Admin ──
app.get('/api/admin/anuncios', auth, (_, res) => {
  res.json(db.prepare('SELECT * FROM anuncios ORDER BY created_at DESC').all());
});
app.post('/api/admin/anuncio', auth, (req, res) => {
  const { id, titulo, conteudo, data_inicio, data_fim, destaque, ativo } = req.body;
  if (!titulo || !conteudo || !data_inicio) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  if (id) {
    db.prepare('UPDATE anuncios SET titulo=?,conteudo=?,data_inicio=?,data_fim=?,destaque=?,ativo=? WHERE id=?')
      .run(titulo, conteudo, data_inicio, data_fim||null, destaque?1:0, ativo?1:0, id);
  } else {
    db.prepare('INSERT INTO anuncios (titulo,conteudo,data_inicio,data_fim,destaque,ativo) VALUES (?,?,?,?,?,?)')
      .run(titulo, conteudo, data_inicio, data_fim||null, destaque?1:0, ativo?1:0);
  }
  res.json({ sucesso: true });
});
app.delete('/api/admin/anuncio/:id', auth, (req, res) => {
  db.prepare('DELETE FROM anuncios WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});

// ── Comunicados Admin ──
app.get('/api/admin/comunicados', auth, (_, res) => {
  res.json(db.prepare('SELECT * FROM comunicados ORDER BY data DESC').all());
});
app.post('/api/admin/comunicado', auth, (req, res) => {
  const { id, titulo, conteudo, data, importante } = req.body;
  if (!titulo || !conteudo || !data) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  if (id) {
    db.prepare('UPDATE comunicados SET titulo=?,conteudo=?,data=?,importante=? WHERE id=?')
      .run(titulo, conteudo, data, importante?1:0, id);
  } else {
    db.prepare('INSERT INTO comunicados (titulo,conteudo,data,importante) VALUES (?,?,?,?)')
      .run(titulo, conteudo, data, importante?1:0);
  }
  res.json({ sucesso: true });
});
app.delete('/api/admin/comunicado/:id', auth, (req, res) => {
  db.prepare('DELETE FROM comunicados WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});

// ── Eventos Admin ──
app.get('/api/admin/eventos', auth, (_, res) => {
  res.json(db.prepare('SELECT * FROM eventos ORDER BY data_evento DESC').all());
});
app.post('/api/admin/evento', auth, (req, res) => {
  const { id, titulo, descricao, data_evento, horario, local, vagas, gratuito, valor, ativo, pagina } = req.body;
  if (!titulo || !data_evento) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  const pg = ['geral','hfc','ambos'].includes(pagina) ? pagina : 'ambos';
  if (id) {
    db.prepare('UPDATE eventos SET titulo=?,descricao=?,data_evento=?,horario=?,local=?,vagas=?,gratuito=?,valor=?,ativo=?,pagina=? WHERE id=?')
      .run(titulo,descricao||'',data_evento,horario||'',local||'',vagas||null,gratuito?1:0,valor||'',ativo?1:0,pg,id);
  } else {
    db.prepare('INSERT INTO eventos (titulo,descricao,data_evento,horario,local,vagas,gratuito,valor,ativo,pagina) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(titulo,descricao||'',data_evento,horario||'',local||'',vagas||null,gratuito?1:0,valor||'',ativo?1:0,pg);
  }
  res.json({ sucesso: true });
});
app.delete('/api/admin/evento/:id', auth, (req, res) => {
  db.prepare('DELETE FROM eventos WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});
app.get('/api/admin/evento/:id/inscricoes', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM inscricoes_eventos WHERE evento_id=? ORDER BY created_at DESC').all(req.params.id));
});

// ── Cursos Admin ──
app.get('/api/admin/cursos', auth, (_, res) => {
  res.json(db.prepare('SELECT * FROM cursos ORDER BY data_inicio DESC').all());
});
app.post('/api/admin/curso', auth, (req, res) => {
  const { id, titulo, descricao, data_inicio, duracao, local, vagas, gratuito, valor, ativo, pagina } = req.body;
  if (!titulo || !data_inicio) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  const pg = ['geral','hfc','ambos'].includes(pagina) ? pagina : 'ambos';
  if (id) {
    db.prepare('UPDATE cursos SET titulo=?,descricao=?,data_inicio=?,duracao=?,local=?,vagas=?,gratuito=?,valor=?,ativo=?,pagina=? WHERE id=?')
      .run(titulo,descricao||'',data_inicio,duracao||'',local||'',vagas||null,gratuito?1:0,valor||'',ativo?1:0,pg,id);
  } else {
    db.prepare('INSERT INTO cursos (titulo,descricao,data_inicio,duracao,local,vagas,gratuito,valor,ativo,pagina) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(titulo,descricao||'',data_inicio,duracao||'',local||'',vagas||null,gratuito?1:0,valor||'',ativo?1:0,pg);
  }
  res.json({ sucesso: true });
});
app.delete('/api/admin/curso/:id', auth, (req, res) => {
  db.prepare('DELETE FROM cursos WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});
app.get('/api/admin/curso/:id/inscricoes', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM inscricoes_cursos WHERE curso_id=? ORDER BY created_at DESC').all(req.params.id));
});

// ── Playlists Admin ──
app.get('/api/admin/playlists', auth, (_, res) => {
  res.json(db.prepare('SELECT * FROM playlists ORDER BY categoria, titulo').all());
});
app.post('/api/admin/playlist', auth, (req, res) => {
  const { id, titulo, descricao, playlist_id, categoria, ativo } = req.body;
  if (!titulo || !playlist_id) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  if (id) {
    db.prepare('UPDATE playlists SET titulo=?,descricao=?,playlist_id=?,categoria=?,ativo=? WHERE id=?')
      .run(titulo,descricao||'',playlist_id,categoria||'geral',ativo?1:0,id);
  } else {
    db.prepare('INSERT INTO playlists (titulo,descricao,playlist_id,categoria,ativo) VALUES (?,?,?,?,?)')
      .run(titulo,descricao||'',playlist_id,categoria||'geral',ativo?1:0);
  }
  res.json({ sucesso: true });
});
app.delete('/api/admin/playlist/:id', auth, (req, res) => {
  db.prepare('DELETE FROM playlists WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});

// ── Agenda Admin ──
app.get('/api/admin/agenda', auth, (_, res) => {
  res.json(db.prepare('SELECT * FROM agenda ORDER BY data, horario').all());
});
app.post('/api/admin/agenda', auth, (req, res) => {
  const { id, titulo, descricao, data, horario, local, recorrente, dia_semana } = req.body;
  if (!titulo || !data) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  if (id) {
    db.prepare('UPDATE agenda SET titulo=?,descricao=?,data=?,horario=?,local=?,recorrente=?,dia_semana=? WHERE id=?')
      .run(titulo,descricao||'',data,horario||'',local||'',recorrente?1:0,dia_semana||'',id);
  } else {
    db.prepare('INSERT INTO agenda (titulo,descricao,data,horario,local,recorrente,dia_semana) VALUES (?,?,?,?,?,?,?)')
      .run(titulo,descricao||'',data,horario||'',local||'',recorrente?1:0,dia_semana||'');
  }
  res.json({ sucesso: true });
});
app.delete('/api/admin/agenda/:id', auth, (req, res) => {
  db.prepare('DELETE FROM agenda WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});

// ── Links de Devocional Admin ──
app.get('/api/admin/devocional-links', auth, (req, res) => {
  const { data, tipo } = req.query;
  const items = db.prepare("SELECT * FROM devocional_links WHERE data=? AND tipo=? ORDER BY ordem, created_at").all(data, tipo || 'geral');
  res.json(items);
});
app.post('/api/admin/devocional-link', auth, (req, res) => {
  const { data, tipo, link_tipo, titulo, url, ordem } = req.body;
  if (!data || !link_tipo || !titulo || !url) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  const tipos = ['youtube', 'instagram', 'site'];
  if (!tipos.includes(link_tipo)) return res.status(400).json({ error: 'link_tipo inválido' });
  db.prepare("INSERT INTO devocional_links (data,tipo,link_tipo,titulo,url,ordem) VALUES (?,?,?,?,?,?)")
    .run(data, tipo || 'geral', link_tipo, titulo, url, ordem || 0);
  res.json({ sucesso: true });
});
app.delete('/api/admin/devocional-link/:id', auth, (req, res) => {
  db.prepare('DELETE FROM devocional_links WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});

// ── Links Sociais Admin ──
app.get('/api/admin/links', auth, (_, res) => {
  res.json(db.prepare('SELECT * FROM links_sociais ORDER BY ordem, nome').all());
});
app.post('/api/admin/link', auth, (req, res) => {
  const { id, nome, url, icone, ordem, ativo } = req.body;
  if (!nome || !url) return res.status(400).json({ error: 'Nome e URL obrigatórios' });
  if (id) {
    db.prepare('UPDATE links_sociais SET nome=?,url=?,icone=?,ordem=?,ativo=? WHERE id=?')
      .run(nome, url, icone||'link', ordem||0, ativo?1:0, id);
  } else {
    db.prepare('INSERT INTO links_sociais (nome,url,icone,ordem,ativo) VALUES (?,?,?,?,?)')
      .run(nome, url, icone||'link', ordem||0, ativo?1:0);
  }
  res.json({ sucesso: true });
});
app.delete('/api/admin/link/:id', auth, (req, res) => {
  db.prepare('DELETE FROM links_sociais WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});

// ── Oração Admin ──
app.get('/api/admin/oracao', auth, (_, res) => {
  res.json(db.prepare('SELECT * FROM pedidos_oracao ORDER BY created_at DESC').all());
});
app.post('/api/admin/oracao/:id/respondido', auth, (req, res) => {
  db.prepare('UPDATE pedidos_oracao SET respondido=1 WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});
app.delete('/api/admin/oracao/:id', auth, (req, res) => {
  db.prepare('DELETE FROM pedidos_oracao WHERE id=?').run(req.params.id);
  res.json({ sucesso: true });
});

// ── Cron ──────────────────────────────────────────────────────────────────────
if (process.env.GEMINI_API_KEY) {
  cron.schedule('5 0 * * *', async () => {
    try { await gerarDevocional(null, 'geral'); } catch (e) { console.error('[CRON geral]', e.message); }
    try { await gerarDevocional(null, 'hfc');   } catch (e) { console.error('[CRON hfc]', e.message); }
  }, { timezone: 'America/Sao_Paulo' });
}

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║         IVT Devocional - Servidor            ║
╠══════════════════════════════════════════════╣
║  Site:  ${BASE_URL}
║  Admin: ${BASE_URL}/admin
║  Local: http://localhost:${PORT}
╚══════════════════════════════════════════════╝`);
});
