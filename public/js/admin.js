// ── Auth ───────────────────────────────────────────────────────────────────
let SESSION = JSON.parse(sessionStorage.getItem('ivt_admin_session') || 'null');

function TOKEN() { return SESSION?.token || ''; }

async function fazerLogin(e) {
  e.preventDefault();
  const btn  = document.getElementById('loginBtn');
  const erro = document.getElementById('loginErro');
  const usuario = document.getElementById('loginUsuario').value.trim();
  const senha   = document.getElementById('loginSenha').value;
  if (!usuario || !senha) return;
  btn.disabled = true; btn.textContent = 'Entrando…';
  erro.classList.add('hidden');
  try {
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    });
    const data = await r.json();
    if (!r.ok) { erro.textContent = data.error || 'Erro ao entrar'; erro.classList.remove('hidden'); return; }
    SESSION = data;
    sessionStorage.setItem('ivt_admin_session', JSON.stringify(SESSION));
    iniciarAdmin();
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function logout() {
  if (SESSION?.token) await api('POST', '/api/admin/logout').catch(() => {});
  SESSION = null;
  sessionStorage.removeItem('ivt_admin_session');
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

async function iniciarAdmin() {
  const r = await api('GET', '/api/admin/me');
  if (!r.ok) { SESSION = null; sessionStorage.removeItem('ivt_admin_session'); mostrarToast('Sessão expirada'); return; }
  const me = await r.json();
  SESSION = { ...SESSION, ...me };
  sessionStorage.setItem('ivt_admin_session', JSON.stringify(SESSION));

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');

  // Topbar user info
  document.getElementById('topbarNome').textContent = me.nome;
  document.getElementById('topbarPerfil').textContent = me.perfil;
  document.getElementById('topbarPerfil').className = `topbar-perfil-badge perfil-${me.perfil}`;

  // Mostrar menu Usuários somente para superadmin
  if (me.perfil === 'superadmin') {
    document.getElementById('navGrupoSistema').style.display = '';
  }

  const hoje = new Date().toISOString().split('T')[0];
  ['dData','gData','loteInicio','agData','aInicio','cData','eData','crData'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = hoje;
  });
  mostrarAba('dashboard');
}

// ── API ────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'x-admin-token': TOKEN(), 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(path, opts);
}

// ── Toast ──────────────────────────────────────────────────────────────────
function mostrarToast(msg, dur = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Abas ───────────────────────────────────────────────────────────────────
const ABA_TITULOS = {
  dashboard: 'Dashboard',
  devocional: 'Devocional Geral', hfc: 'Devocional HFC', gerar: 'Gerar com IA',
  anuncios: 'Anúncios', comunicados: 'Comunicados',
  eventos: 'Eventos', cursos: 'Cursos',
  agenda: 'Agenda', oracao: 'Pedidos de Oração', playlists: 'Playlists YouTube',
  links: 'Links & Redes Sociais',
  usuarios: 'Usuários', configuracoes: 'Configurações', pulseiras: 'NFC / Pulseiras', logs: 'Logs de Acesso',
};
const ABA_LOADERS = {
  dashboard:    carregarDashboard,
  devocional:   () => carregarDevocionais('geral'),
  hfc:          () => carregarDevocionais('hfc'),
  anuncios:     carregarAnuncios,
  comunicados:  carregarComunicados,
  eventos:      carregarEventos,
  cursos:       carregarCursos,
  agenda:       carregarAgenda,
  oracao:       carregarOracao,
  playlists:    carregarPlaylists,
  links:        carregarLinks,
  usuarios:     carregarUsuarios,
  configuracoes:carregarConfiguracoes,
  pulseiras:    carregarPulseiras,
  logs:         carregarLogs,
};

function mostrarAba(nome) {
  document.querySelectorAll('.aba').forEach(a => a.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`aba-${nome}`)?.classList.remove('hidden');
  document.querySelector(`[data-aba="${nome}"]`)?.classList.add('active');
  document.getElementById('topbarTitle').textContent = ABA_TITULOS[nome] || nome;
  if (ABA_LOADERS[nome]) ABA_LOADERS[nome]();
  // Fecha sidebar em mobile
  document.getElementById('sidebar').classList.remove('open');
}

// ── Utils ──────────────────────────────────────────────────────────────────
function fmtData(s) { if (!s) return '—'; const [a,m,d] = s.split('-'); return `${d}/${m}/${a}`; }
function fmtDataHora(s) { if (!s) return '—'; return s.replace('T',' ').slice(0,16); }

function extrairYoutubeId(input) {
  if (!input) return '';
  input = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const m = input.match(/(?:youtu\.be\/|[?&]v=|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}
function extrairPlaylistId(input) {
  if (!input) return '';
  input = input.trim();
  const m = input.match(/list=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^PL[a-zA-Z0-9_-]+/.test(input)) return input;
  return input;
}

function toggleValor(boxId) {
  const box = document.getElementById(boxId);
  const cb  = document.querySelector(`#${boxId.replace('ValorBox','Gratuito')}`);
  if (cb) box.classList.toggle('hidden', cb.checked);
}

// ── Links por devocional ────────────────────────────────────────────────────
let devoEditandoData = null;
let devoEditandoTipo = 'geral';

async function carregarLinksDevocional() {
  const container = document.getElementById('dLinksContainer');
  if (!container) return;
  if (!devoEditandoData) {
    container.innerHTML = '<p style="color:#888;font-size:13px;margin:4px 0">Salve o devocional antes de adicionar links.</p>';
    document.getElementById('dBtnAddLink').classList.add('hidden');
    return;
  }
  document.getElementById('dBtnAddLink').classList.remove('hidden');
  try {
    const r = await api('GET', `/api/admin/devocional-links?data=${devoEditandoData}&tipo=${devoEditandoTipo}`);
    const links = await r.json();
    renderLinksDevocional(links);
  } catch { container.innerHTML = ''; }
}

function renderLinksDevocional(links) {
  const container = document.getElementById('dLinksContainer');
  const icons = { youtube: '▶️', instagram: '📷', site: '🔗' };
  container.innerHTML = links.length
    ? links.map(lk => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee">
          <span style="font-size:14px">${icons[lk.link_tipo] || '🔗'}</span>
          <span style="flex:1;font-size:13px"><strong>${lk.titulo}</strong> <span style="color:#888;font-size:11px">${lk.url.length > 40 ? lk.url.substring(0,40)+'…' : lk.url}</span></span>
          <button type="button" class="btn-icon danger" onclick="deletarLinkDevocional(${lk.id})" title="Excluir">🗑️</button>
        </div>`).join('')
    : '<p style="color:#888;font-size:13px;margin:4px 0">Nenhum link adicionado.</p>';
}

function mostrarFormLinkDevocional() {
  document.getElementById('dLinkForm').classList.remove('hidden');
  document.getElementById('dLinkTitulo').focus();
}

async function salvarLinkDevocional() {
  const link_tipo = document.getElementById('dLinkTipo').value;
  const titulo    = document.getElementById('dLinkTitulo').value.trim();
  const url       = document.getElementById('dLinkUrl').value.trim();
  if (!titulo || !url) { mostrarToast('Preencha título e URL'); return; }
  const r = await api('POST', '/api/admin/devocional-link', {
    data: devoEditandoData, tipo: devoEditandoTipo, link_tipo, titulo, url,
  });
  if (r.ok) {
    document.getElementById('dLinkForm').classList.add('hidden');
    document.getElementById('dLinkTitulo').value = '';
    document.getElementById('dLinkUrl').value = '';
    carregarLinksDevocional();
  } else mostrarToast('Erro ao salvar link');
}

async function deletarLinkDevocional(id) {
  if (!confirm('Excluir este link?')) return;
  const r = await api('DELETE', `/api/admin/devocional-link/${id}`);
  if (r.ok) carregarLinksDevocional();
  else mostrarToast('Erro ao excluir');
}

// ── Modais ─────────────────────────────────────────────────────────────────
function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.getElementById('overlay').classList.add('show');
}
function fecharModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById('overlay').classList.remove('show');
}
function fecharTodosModais() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('overlay').classList.remove('show');
}

// ══════════════════════════════════════════════════════════════════════
// DEVOCIONAIS
// ══════════════════════════════════════════════════════════════════════
async function carregarDevocionais(tipo) {
  const r = await api('GET', `/api/admin/devocionais?tipo=${tipo}`);
  const data = await r.json();
  const containerId = tipo === 'hfc' ? 'lista-hfc' : 'lista-devocional';
  const container = document.getElementById(containerId);

  if (!data.devocionais?.length) {
    container.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum devocional cadastrado</td></tr></table></div>';
    return;
  }

  container.innerHTML = `
    <div class="data-table">
      <table>
        <thead><tr><th>Data</th><th>Versículo</th><th>Tema</th><th>Vídeo</th><th>Ações</th></tr></thead>
        <tbody>
          ${data.devocionais.map(d => `
            <tr>
              <td><strong>${fmtData(d.data)}</strong></td>
              <td>${d.versiculo_referencia}<br><span class="text-muted">${d.versiculo_texto.substring(0,50)}…</span></td>
              <td>${d.tema ? `<span class="badge badge-gold">${d.tema}</span>` : '—'}</td>
              <td>${d.youtube_id ? '▶️' : '—'}</td>
              <td>
                <button class="btn-icon" onclick="editarDevocional('${d.data}','${tipo}')" title="Editar">✏️</button>
                <button class="btn-icon danger" onclick="deletarDevocional('${d.data}','${tipo}')" title="Excluir">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function abrirFormDevocional(tipo) {
  devoEditandoData = null;
  devoEditandoTipo = tipo;
  document.getElementById('dTipo').value = tipo;
  document.getElementById('modalDevoTitulo').textContent = tipo === 'hfc' ? 'Devocional HFC' : 'Devocional Geral';
  document.getElementById('dData').value = new Date().toISOString().split('T')[0];
  ['dRef','dTexto','dReflexao','dPratica','dTema','dYoutube'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('dLinkForm').classList.add('hidden');
  carregarLinksDevocional();
  abrirModal('modalDevocional');
}

async function editarDevocional(data, tipo) {
  const tabela = tipo === 'hfc' ? 'hfc' : 'devocional';
  const r = await api('GET', `/api/${tabela}/${data}`);
  if (!r.ok) { mostrarToast('Erro ao carregar'); return; }
  const d = await r.json();
  devoEditandoData = data;
  devoEditandoTipo = tipo;
  document.getElementById('dTipo').value = tipo;
  document.getElementById('modalDevoTitulo').textContent = tipo === 'hfc' ? 'Devocional HFC' : 'Devocional Geral';
  document.getElementById('dData').value    = d.data;
  document.getElementById('dRef').value     = d.versiculo_referencia;
  document.getElementById('dTexto').value   = d.versiculo_texto;
  document.getElementById('dReflexao').value = d.reflexao;
  document.getElementById('dPratica').value  = d.pratica;
  document.getElementById('dTema').value    = d.tema || '';
  document.getElementById('dYoutube').value = d.youtube_id ? `https://youtu.be/${d.youtube_id}` : '';
  document.getElementById('dLinkForm').classList.add('hidden');
  carregarLinksDevocional();
  abrirModal('modalDevocional');
}

async function salvarDevocional(e) {
  e.preventDefault();
  const tipo = document.getElementById('dTipo').value;
  const r = await api('POST', '/api/admin/devocional', {
    tipo, data: document.getElementById('dData').value,
    versiculo_referencia: document.getElementById('dRef').value,
    versiculo_texto: document.getElementById('dTexto').value,
    reflexao: document.getElementById('dReflexao').value,
    pratica: document.getElementById('dPratica').value,
    tema: document.getElementById('dTema').value,
    youtube_id: extrairYoutubeId(document.getElementById('dYoutube').value),
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalDevocional'); carregarDevocionais(tipo); }
  else mostrarToast('Erro ao salvar');
}

async function deletarDevocional(data, tipo) {
  if (!confirm(`Excluir devocional de ${fmtData(data)}?`)) return;
  const r = await api('DELETE', `/api/admin/devocional/${data}?tipo=${tipo}`);
  if (r.ok) { mostrarToast('Excluído'); carregarDevocionais(tipo); }
}

// Gerar com IA
async function gerarComIA() {
  const btn = document.getElementById('btnGerar');
  const res  = document.getElementById('resultadoIA');
  const erro = document.getElementById('erroIA');
  btn.disabled = true; btn.textContent = '⏳ Gerando…';
  res.classList.add('hidden'); erro.classList.add('hidden');
  try {
    const r = await api('POST', '/api/admin/gerar', {
      data: document.getElementById('gData').value,
      tipo: document.getElementById('gTipo').value,
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error);
    const d = json.devocional;
    res.innerHTML = `
      <h3>Gerado:</h3>
      <div class="ref">${d.versiculo_referencia}</div>
      <div class="quote">"${d.versiculo_texto}"</div>
      <div class="lbl">Reflexão</div><div class="body">${d.reflexao}</div>
      <div class="lbl">Prática</div><div class="body">${d.pratica}</div>
      <div class="ia-ok">✅ Salvo com sucesso!</div>`;
    res.classList.remove('hidden');
    carregarDevocionais(document.getElementById('gTipo').value);
  } catch(err) {
    erro.textContent = 'Erro: ' + err.message; erro.classList.remove('hidden');
  } finally { btn.disabled = false; btn.textContent = '🤖 Gerar Devocional'; }
}

async function gerarLote() {
  const tipo  = document.getElementById('loteTipo').value;
  const inicio = document.getElementById('loteInicio').value;
  const dias  = parseInt(document.getElementById('loteDias').value) || 7;
  const btn   = document.getElementById('btnLote');
  const prog  = document.getElementById('progressoLote');
  if (!inicio) { mostrarToast('Selecione a data inicial'); return; }
  btn.disabled = true; prog.classList.remove('hidden');
  let ok = 0, err = 0;
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio + 'T12:00:00'); d.setDate(d.getDate() + i);
    const dataStr = d.toISOString().split('T')[0];
    prog.textContent = `Gerando ${i+1}/${dias}: ${dataStr}…`;
    try { const r = await api('POST', '/api/admin/gerar', { data: dataStr, tipo }); r.ok ? ok++ : err++; } catch { err++; }
    await new Promise(r => setTimeout(r, 1500));
  }
  prog.textContent = `✅ Concluído: ${ok} gerados, ${err} erros.`;
  btn.disabled = false;
}

// ══════════════════════════════════════════════════════════════════════
// ANÚNCIOS
// ══════════════════════════════════════════════════════════════════════
async function carregarAnuncios() {
  const r = await api('GET', '/api/admin/anuncios');
  const lista = await r.json();
  const c = document.getElementById('lista-anuncios');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum anúncio</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Título</th><th>Período</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(a => `<tr>
      <td><strong>${a.titulo}</strong>${a.destaque ? ' <span class="badge badge-gold">Destaque</span>' : ''}<br><span class="text-muted">${a.conteudo.substring(0,60)}…</span></td>
      <td>${fmtData(a.data_inicio)} → ${a.data_fim ? fmtData(a.data_fim) : 'sem fim'}</td>
      <td><span class="badge ${a.ativo ? 'badge-green' : 'badge-gray'}">${a.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td><button class="btn-icon" onclick='editarAnuncio(${JSON.stringify(a)})'>✏️</button>
          <button class="btn-icon danger" onclick="deletar('anuncio',${a.id},carregarAnuncios)">🗑️</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function editarAnuncio(a) {
  document.getElementById('aId').value = a.id;
  document.getElementById('aTitulo').value = a.titulo;
  document.getElementById('aConteudo').value = a.conteudo;
  document.getElementById('aInicio').value = a.data_inicio;
  document.getElementById('aFim').value = a.data_fim || '';
  document.getElementById('aDestaque').checked = !!a.destaque;
  document.getElementById('aAtivo').checked = !!a.ativo;
  abrirModal('modalAnuncio');
}

async function salvarAnuncio(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/anuncio', {
    id: document.getElementById('aId').value || null,
    titulo: document.getElementById('aTitulo').value,
    conteudo: document.getElementById('aConteudo').value,
    data_inicio: document.getElementById('aInicio').value,
    data_fim: document.getElementById('aFim').value || null,
    destaque: document.getElementById('aDestaque').checked,
    ativo: document.getElementById('aAtivo').checked,
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalAnuncio'); carregarAnuncios(); document.getElementById('aId').value=''; }
  else mostrarToast('Erro ao salvar');
}

// ══════════════════════════════════════════════════════════════════════
// COMUNICADOS
// ══════════════════════════════════════════════════════════════════════
async function carregarComunicados() {
  const r = await api('GET', '/api/admin/comunicados');
  const lista = await r.json();
  const c = document.getElementById('lista-comunicados');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum comunicado</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Título</th><th>Data</th><th>Urgente</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(a => `<tr>
      <td><strong>${a.titulo}</strong><br><span class="text-muted">${a.conteudo.substring(0,60)}…</span></td>
      <td>${fmtData(a.data)}</td>
      <td>${a.importante ? '<span class="badge badge-red">⚠️ Urgente</span>' : '—'}</td>
      <td><button class="btn-icon" onclick='editarComunicado(${JSON.stringify(a)})'>✏️</button>
          <button class="btn-icon danger" onclick="deletar('comunicado',${a.id},carregarComunicados)">🗑️</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function editarComunicado(a) {
  document.getElementById('cId').value = a.id;
  document.getElementById('cTitulo').value = a.titulo;
  document.getElementById('cConteudo').value = a.conteudo;
  document.getElementById('cData').value = a.data;
  document.getElementById('cImportante').checked = !!a.importante;
  abrirModal('modalComunicado');
}

async function salvarComunicado(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/comunicado', {
    id: document.getElementById('cId').value || null,
    titulo: document.getElementById('cTitulo').value,
    conteudo: document.getElementById('cConteudo').value,
    data: document.getElementById('cData').value,
    importante: document.getElementById('cImportante').checked,
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalComunicado'); carregarComunicados(); document.getElementById('cId').value=''; }
  else mostrarToast('Erro ao salvar');
}

// ══════════════════════════════════════════════════════════════════════
// EVENTOS
// ══════════════════════════════════════════════════════════════════════
async function carregarEventos() {
  const r = await api('GET', '/api/admin/eventos');
  const lista = await r.json();
  const c = document.getElementById('lista-eventos');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum evento</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Título</th><th>Data</th><th>Local</th><th>Vagas</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(e => `<tr>
      <td><strong>${e.titulo}</strong></td>
      <td>${fmtData(e.data_evento)}${e.horario ? ' ' + e.horario : ''}</td>
      <td>${e.local || '—'}</td>
      <td>${e.vagas || '∞'}</td>
      <td><span class="badge ${e.ativo ? 'badge-green' : 'badge-gray'}">${e.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn-icon" onclick='editarEvento(${JSON.stringify(e)})' title="Editar">✏️</button>
        <button class="btn-icon" onclick="verQR('evento',${e.id},'${e.titulo}')" title="QR Code">📱</button>
        <button class="btn-icon" onclick="verInscricoes('evento',${e.id},'${e.titulo}')" title="Inscrições">👥</button>
        <button class="btn-icon danger" onclick="deletar('evento',${e.id},carregarEventos)" title="Excluir">🗑️</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function editarEvento(e) {
  document.getElementById('eId').value = e.id;
  document.getElementById('eTitulo').value = e.titulo;
  document.getElementById('eDescricao').value = e.descricao || '';
  document.getElementById('eData').value = e.data_evento;
  document.getElementById('eHorario').value = e.horario || '';
  document.getElementById('eLocal').value = e.local || '';
  document.getElementById('eVagas').value = e.vagas || '';
  document.getElementById('eGratuito').checked = !!e.gratuito;
  document.getElementById('eAtivo').checked = !!e.ativo;
  document.getElementById('eValor').value = e.valor || '';
  document.getElementById('ePagina').value = e.pagina || 'ambos';
  document.getElementById('eValorBox').classList.toggle('hidden', !!e.gratuito);
  abrirModal('modalEvento');
}

async function salvarEvento(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/evento', {
    id: document.getElementById('eId').value || null,
    titulo: document.getElementById('eTitulo').value,
    descricao: document.getElementById('eDescricao').value,
    data_evento: document.getElementById('eData').value,
    horario: document.getElementById('eHorario').value,
    local: document.getElementById('eLocal').value,
    vagas: document.getElementById('eVagas').value || null,
    gratuito: document.getElementById('eGratuito').checked,
    valor: document.getElementById('eValor').value,
    ativo: document.getElementById('eAtivo').checked,
    pagina: document.getElementById('ePagina').value,
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalEvento'); carregarEventos(); document.getElementById('eId').value=''; }
  else mostrarToast('Erro ao salvar');
}

// ══════════════════════════════════════════════════════════════════════
// CURSOS
// ══════════════════════════════════════════════════════════════════════
async function carregarCursos() {
  const r = await api('GET', '/api/admin/cursos');
  const lista = await r.json();
  const c = document.getElementById('lista-cursos');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum curso</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Título</th><th>Início</th><th>Duração</th><th>Vagas</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(e => `<tr>
      <td><strong>${e.titulo}</strong></td>
      <td>${fmtData(e.data_inicio)}</td>
      <td>${e.duracao || '—'}</td>
      <td>${e.vagas || '∞'}</td>
      <td><span class="badge ${e.ativo ? 'badge-green' : 'badge-gray'}">${e.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn-icon" onclick='editarCurso(${JSON.stringify(e)})'>✏️</button>
        <button class="btn-icon" onclick="verQR('curso',${e.id},'${e.titulo}')">📱</button>
        <button class="btn-icon" onclick="verInscricoes('curso',${e.id},'${e.titulo}')">👥</button>
        <button class="btn-icon danger" onclick="deletar('curso',${e.id},carregarCursos)">🗑️</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function editarCurso(e) {
  document.getElementById('crId').value = e.id;
  document.getElementById('crTitulo').value = e.titulo;
  document.getElementById('crDescricao').value = e.descricao || '';
  document.getElementById('crData').value = e.data_inicio;
  document.getElementById('crDuracao').value = e.duracao || '';
  document.getElementById('crLocal').value = e.local || '';
  document.getElementById('crVagas').value = e.vagas || '';
  document.getElementById('crGratuito').checked = !!e.gratuito;
  document.getElementById('crAtivo').checked = !!e.ativo;
  document.getElementById('crValor').value = e.valor || '';
  document.getElementById('crPagina').value = e.pagina || 'ambos';
  document.getElementById('crValorBox').classList.toggle('hidden', !!e.gratuito);
  abrirModal('modalCurso');
}

async function salvarCurso(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/curso', {
    id: document.getElementById('crId').value || null,
    titulo: document.getElementById('crTitulo').value,
    descricao: document.getElementById('crDescricao').value,
    data_inicio: document.getElementById('crData').value,
    duracao: document.getElementById('crDuracao').value,
    local: document.getElementById('crLocal').value,
    vagas: document.getElementById('crVagas').value || null,
    gratuito: document.getElementById('crGratuito').checked,
    valor: document.getElementById('crValor').value,
    ativo: document.getElementById('crAtivo').checked,
    pagina: document.getElementById('crPagina').value,
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalCurso'); carregarCursos(); document.getElementById('crId').value=''; }
  else mostrarToast('Erro ao salvar');
}

// ══════════════════════════════════════════════════════════════════════
// AGENDA
// ══════════════════════════════════════════════════════════════════════
async function carregarAgenda() {
  const r = await api('GET', '/api/admin/agenda');
  const lista = await r.json();
  const c = document.getElementById('lista-agenda');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum evento na agenda</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Título</th><th>Data</th><th>Horário</th><th>Local</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(a => `<tr>
      <td><strong>${a.titulo}</strong>${a.recorrente ? ' <span class="badge badge-blue">Recorrente</span>' : ''}</td>
      <td>${fmtData(a.data)}</td><td>${a.horario || '—'}</td><td>${a.local || '—'}</td>
      <td><button class="btn-icon" onclick='editarAgenda(${JSON.stringify(a)})'>✏️</button>
          <button class="btn-icon danger" onclick="deletar('agenda',${a.id},carregarAgenda)">🗑️</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function editarAgenda(a) {
  document.getElementById('agId').value = a.id;
  document.getElementById('agTitulo').value = a.titulo;
  document.getElementById('agDescricao').value = a.descricao || '';
  document.getElementById('agData').value = a.data;
  document.getElementById('agHorario').value = a.horario || '';
  document.getElementById('agLocal').value = a.local || '';
  document.getElementById('agRecorrente').checked = !!a.recorrente;
  abrirModal('modalAgenda');
}

async function salvarAgenda(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/agenda', {
    id: document.getElementById('agId').value || null,
    titulo: document.getElementById('agTitulo').value,
    descricao: document.getElementById('agDescricao').value,
    data: document.getElementById('agData').value,
    horario: document.getElementById('agHorario').value,
    local: document.getElementById('agLocal').value,
    recorrente: document.getElementById('agRecorrente').checked,
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalAgenda'); carregarAgenda(); document.getElementById('agId').value=''; }
  else mostrarToast('Erro ao salvar');
}

// ══════════════════════════════════════════════════════════════════════
// ORAÇÃO
// ══════════════════════════════════════════════════════════════════════
async function carregarOracao() {
  const r = await api('GET', '/api/admin/oracao');
  const lista = await r.json();
  const c = document.getElementById('lista-oracao');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum pedido de oração</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Nome</th><th>Pedido</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(a => `<tr>
      <td><strong>${a.nome}</strong>${a.publico ? ' <span class="badge badge-blue">Público</span>' : ''}</td>
      <td>${a.pedido.substring(0,80)}…</td>
      <td>${fmtDataHora(a.created_at)}</td>
      <td><span class="badge ${a.respondido ? 'badge-green' : 'badge-gold'}">${a.respondido ? '✅ Orado' : '🙏 Pendente'}</span></td>
      <td>
        ${!a.respondido ? `<button class="btn-icon" onclick="marcarOrado(${a.id})" title="Marcar como orado">✅</button>` : ''}
        <button class="btn-icon danger" onclick="deletar('oracao',${a.id},carregarOracao)">🗑️</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function marcarOrado(id) {
  const r = await api('POST', `/api/admin/oracao/${id}/respondido`);
  if (r.ok) { mostrarToast('Marcado como orado!'); carregarOracao(); }
}

// ══════════════════════════════════════════════════════════════════════
// PLAYLISTS
// ══════════════════════════════════════════════════════════════════════
async function carregarPlaylists() {
  const r = await api('GET', '/api/admin/playlists');
  const lista = await r.json();
  const c = document.getElementById('lista-playlists');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhuma playlist</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Título</th><th>Categoria</th><th>ID</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(p => `<tr>
      <td><strong>${p.titulo}</strong><br><span class="text-muted">${p.descricao || ''}</span></td>
      <td><span class="badge badge-blue">${p.categoria}</span></td>
      <td><code style="font-size:11px">${p.playlist_id.substring(0,20)}…</code></td>
      <td><span class="badge ${p.ativo ? 'badge-green' : 'badge-gray'}">${p.ativo ? 'Ativa' : 'Inativa'}</span></td>
      <td><button class="btn-icon" onclick='editarPlaylist(${JSON.stringify(p)})'>✏️</button>
          <button class="btn-icon danger" onclick="deletar('playlist',${p.id},carregarPlaylists)">🗑️</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function editarPlaylist(p) {
  document.getElementById('plId').value = p.id;
  document.getElementById('plTitulo').value = p.titulo;
  document.getElementById('plDescricao').value = p.descricao || '';
  document.getElementById('plUrl').value = p.playlist_id;
  document.getElementById('plCategoria').value = p.categoria || 'geral';
  document.getElementById('plAtivo').checked = !!p.ativo;
  abrirModal('modalPlaylist');
}

async function salvarPlaylist(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/playlist', {
    id: document.getElementById('plId').value || null,
    titulo: document.getElementById('plTitulo').value,
    descricao: document.getElementById('plDescricao').value,
    playlist_id: extrairPlaylistId(document.getElementById('plUrl').value),
    categoria: document.getElementById('plCategoria').value,
    ativo: document.getElementById('plAtivo').checked,
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalPlaylist'); carregarPlaylists(); document.getElementById('plId').value=''; }
  else mostrarToast('Erro ao salvar');
}

// ══════════════════════════════════════════════════════════════════════
// LINKS & REDES SOCIAIS
// ══════════════════════════════════════════════════════════════════════
const ICONE_LABELS = { instagram: 'Instagram', youtube: 'YouTube', whatsapp: 'WhatsApp', facebook: 'Facebook', tiktok: 'TikTok', link: 'Genérico' };

async function carregarLinks() {
  const r = await api('GET', '/api/admin/links');
  const lista = await r.json();
  const c = document.getElementById('lista-links');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum link cadastrado</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Nome</th><th>URL</th><th>Ícone</th><th>Ordem</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(lk => `<tr>
      <td><strong>${lk.nome}</strong></td>
      <td><a href="${lk.url}" target="_blank" rel="noopener" style="color:var(--gold);word-break:break-all">${lk.url}</a></td>
      <td>${ICONE_LABELS[lk.icone] || lk.icone}</td>
      <td>${lk.ordem}</td>
      <td><span class="badge ${lk.ativo ? 'badge-green' : 'badge-gray'}">${lk.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn-icon" onclick='editarLink(${JSON.stringify(lk)})'>✏️</button>
        <button class="btn-icon danger" onclick="deletar('link',${lk.id},carregarLinks)">🗑️</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function editarLink(lk) {
  document.getElementById('lId').value = lk.id;
  document.getElementById('lNome').value = lk.nome;
  document.getElementById('lUrl').value = lk.url;
  document.getElementById('lIcone').value = lk.icone || 'link';
  document.getElementById('lOrdem').value = lk.ordem || 0;
  document.getElementById('lAtivo').checked = !!lk.ativo;
  document.getElementById('modalLinkTitulo').textContent = 'Editar Link';
  abrirModal('modalLink');
}

async function salvarLink(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/link', {
    id: document.getElementById('lId').value || null,
    nome: document.getElementById('lNome').value,
    url: document.getElementById('lUrl').value,
    icone: document.getElementById('lIcone').value,
    ordem: parseInt(document.getElementById('lOrdem').value) || 0,
    ativo: document.getElementById('lAtivo').checked,
  });
  if (r.ok) {
    mostrarToast('Salvo!');
    fecharModal('modalLink');
    carregarLinks();
    document.getElementById('lId').value = '';
    document.getElementById('modalLinkTitulo').textContent = 'Novo Link';
  } else {
    mostrarToast('Erro ao salvar');
  }
}

// ══════════════════════════════════════════════════════════════════════
// QR CODE & INSCRIÇÕES
// ══════════════════════════════════════════════════════════════════════
async function verQR(tipo, id, titulo) {
  const r = await fetch(`/api/qrcode/${tipo}/${id}`);
  const svg = await r.text();
  document.getElementById('qrTitulo').textContent = `QR Code — ${titulo}`;
  document.getElementById('qrContainer').innerHTML = svg;
  document.getElementById('qrUrl').textContent = `${window.location.origin}/${tipo}/${id}`;
  abrirModal('modalQR');
}

function imprimirQR() {
  const conteudo = document.getElementById('qrContainer').innerHTML;
  const titulo   = document.getElementById('qrTitulo').textContent;
  const url      = document.getElementById('qrUrl').textContent;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>${titulo}</title>
    <style>body{font-family:sans-serif;text-align:center;padding:40px}
    svg{width:280px;height:280px}h2{margin-bottom:16px}p{margin-top:16px;font-size:14px;color:#666}</style>
    </head><body><h2>${titulo}</h2>${conteudo}<p>${url}</p></body></html>`);
  w.document.close(); w.print();
}

async function verInscricoes(tipo, id, titulo) {
  const r = await api('GET', `/api/admin/${tipo}/${id}/inscricoes`);
  const lista = await r.json();
  document.getElementById('inscTitulo').textContent = `Inscrições — ${titulo}`;
  document.getElementById('listaInscricoes').innerHTML = lista.length
    ? `<p class="insc-count"><strong>${lista.length}</strong> inscrição(ões)</p>
       <div class="data-table"><table>
         <thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Data</th></tr></thead>
         <tbody>${lista.map((i,n) => `<tr>
           <td>${n+1}</td><td><strong>${i.nome}</strong></td>
           <td>${i.telefone}</td><td>${i.email || '—'}</td>
           <td>${fmtDataHora(i.created_at)}</td>
         </tr>`).join('')}</tbody></table></div>`
    : '<p class="text-muted" style="text-align:center;padding:24px">Nenhuma inscrição ainda.</p>';
  abrirModal('modalInscricoes');
}

// ══════════════════════════════════════════════════════════════════════
// DELETE genérico
// ══════════════════════════════════════════════════════════════════════
async function deletar(recurso, id, recarregar) {
  if (!confirm('Confirmar exclusão?')) return;
  const r = await api('DELETE', `/api/admin/${recurso}/${id}`);
  if (r.ok) { mostrarToast('Excluído'); recarregar(); }
  else mostrarToast('Erro ao excluir');
}

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════
async function carregarDashboard() {
  const r = await api('GET', '/api/admin/dashboard');
  if (!r.ok) return;
  const d = await r.json();

  const stats = [
    { label: 'Devocionais Geral', valor: d.devocionais_geral, icon: '📖' },
    { label: 'Devocionais HFC',   valor: d.devocionais_hfc,   icon: '🛡️' },
    { label: 'Eventos Ativos',    valor: d.eventos_ativos,    icon: '🎟️' },
    { label: 'Anúncios Ativos',   valor: d.anuncios_ativos,   icon: '📢' },
    { label: 'Usuários Ativos',   valor: d.usuarios_ativos,   icon: '👥' },
    { label: 'Orações Pendentes', valor: d.pedidos_pendentes, icon: '🙏' },
  ];
  document.getElementById('dashboardGrid').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-valor">${s.valor}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');

  document.getElementById('dashProximosEventos').innerHTML = d.proximos_eventos.length
    ? d.proximos_eventos.map(e => `<div class="dash-row"><span>${fmtData(e.data_evento)}${e.horario?' '+e.horario:''}</span><strong>${e.titulo}</strong></div>`).join('')
    : '<p class="text-muted" style="font-size:13px;padding:8px 0">Nenhum evento próximo.</p>';

  document.getElementById('dashUltimosLogs').innerHTML = d.ultimos_logs.length
    ? d.ultimos_logs.map(l => `<div class="dash-row"><span>${fmtDataHora(l.created_at)}</span><span><strong>${l.usuario_nome||'—'}</strong> · ${l.acao}</span></div>`).join('')
    : '<p class="text-muted" style="font-size:13px;padding:8px 0">Nenhum acesso registrado.</p>';
}

// ══════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ══════════════════════════════════════════════════════════════════════
async function carregarConfiguracoes() {
  const r = await api('GET', '/api/admin/configuracoes');
  if (!r.ok) return;
  const c = await r.json();
  document.getElementById('cfgNomeIgreja').value = c.nome_igreja || '';
  document.getElementById('cfgSiteUrl').value    = c.site_url    || '';
  document.getElementById('cfgEmail').value      = c.contato_email    || '';
  document.getElementById('cfgTelefone').value   = c.contato_telefone || '';
}

async function salvarConfiguracoes(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/configuracoes', {
    nome_igreja:       document.getElementById('cfgNomeIgreja').value,
    site_url:          document.getElementById('cfgSiteUrl').value,
    contato_email:     document.getElementById('cfgEmail').value,
    contato_telefone:  document.getElementById('cfgTelefone').value,
  });
  if (r.ok) mostrarToast('Configurações salvas!');
  else mostrarToast('Erro ao salvar');
}

// ══════════════════════════════════════════════════════════════════════
// NFC / PULSEIRAS
// ══════════════════════════════════════════════════════════════════════
async function carregarPulseiras() {
  const r = await api('GET', '/api/admin/pulseiras');
  if (!r.ok) { document.getElementById('lista-pulseiras').innerHTML = '<p class="text-muted">Sem permissão.</p>'; return; }
  const lista = await r.json();
  const c = document.getElementById('lista-pulseiras');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhuma pulseira cadastrada</td></tr></table></div>'; return; }
  const base = window.location.origin;
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Código</th><th>Nome</th><th>URL Destino</th><th>Link NFC</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(p => `<tr>
      <td><code>${p.codigo}</code></td>
      <td><strong>${p.nome}</strong>${p.descricao ? `<br><span class="text-muted">${p.descricao}</span>` : ''}</td>
      <td>${p.url_destino}</td>
      <td>
        <button class="btn-icon" onclick="copiarTexto('${base}/p/${p.codigo}')" title="Copiar link NFC">📋</button>
        <span class="text-muted" style="font-size:11px">/p/${p.codigo}</span>
      </td>
      <td><span class="badge ${p.ativo ? 'badge-green' : 'badge-gray'}">${p.ativo ? 'Ativa' : 'Inativa'}</span></td>
      <td>
        <button class="btn-icon" onclick='editarPulseira(${JSON.stringify(p)})' title="Editar">✏️</button>
        <button class="btn-icon danger" onclick="deletar('pulseira',${p.id},carregarPulseiras)" title="Excluir">🗑️</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function abrirModalPulseira() {
  document.getElementById('pId').value = '';
  ['pCodigo','pNome','pDescricao','pUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pAtivo').checked = true;
  document.getElementById('modalPulseiraTitulo').textContent = 'Nova Pulseira';
  abrirModal('modalPulseira');
}

function editarPulseira(p) {
  document.getElementById('pId').value      = p.id;
  document.getElementById('pCodigo').value  = p.codigo;
  document.getElementById('pNome').value    = p.nome;
  document.getElementById('pDescricao').value = p.descricao || '';
  document.getElementById('pUrl').value     = p.url_destino;
  document.getElementById('pAtivo').checked = !!p.ativo;
  document.getElementById('modalPulseiraTitulo').textContent = 'Editar Pulseira';
  abrirModal('modalPulseira');
}

async function salvarPulseira(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/pulseira', {
    id:          document.getElementById('pId').value || null,
    codigo:      document.getElementById('pCodigo').value.trim(),
    nome:        document.getElementById('pNome').value,
    descricao:   document.getElementById('pDescricao').value,
    url_destino: document.getElementById('pUrl').value.trim(),
    ativo:       document.getElementById('pAtivo').checked,
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalPulseira'); carregarPulseiras(); }
  else { const j = await r.json(); mostrarToast(j.error || 'Erro ao salvar'); }
}

function copiarTexto(texto) {
  navigator.clipboard.writeText(texto).then(() => mostrarToast('Link copiado!'));
}

// ══════════════════════════════════════════════════════════════════════
// LOGS
// ══════════════════════════════════════════════════════════════════════
async function carregarLogs(pagina = 1) {
  const r = await api('GET', `/api/admin/logs?pagina=${pagina}`);
  if (!r.ok) { document.getElementById('lista-logs').innerHTML = '<p class="text-muted">Sem permissão.</p>'; return; }
  const { total, logs } = await r.json();
  const c = document.getElementById('lista-logs');
  if (!logs.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum log registrado</td></tr></table></div>'; return; }
  c.innerHTML = `
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">${total} registro(s) total</p>
    <div class="data-table"><table>
    <thead><tr><th>Usuário</th><th>Ação</th><th>Detalhes</th><th>IP</th><th>Data</th></tr></thead>
    <tbody>${logs.map(l => `<tr>
      <td><strong>${l.usuario_nome||'—'}</strong></td>
      <td>${l.acao}</td>
      <td>${l.detalhes||'—'}</td>
      <td><span class="text-muted" style="font-size:11px">${l.ip||'—'}</span></td>
      <td>${fmtDataHora(l.created_at)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function limparLogs() {
  if (!confirm('Excluir logs com mais de 30 dias?')) return;
  const r = await api('DELETE', '/api/admin/logs?dias=30');
  if (r.ok) { mostrarToast('Logs antigos excluídos'); carregarLogs(); }
  else mostrarToast('Erro ao limpar logs');
}

// ══════════════════════════════════════════════════════════════════════
// USUÁRIOS
// ══════════════════════════════════════════════════════════════════════
const PERFIL_LABELS = { superadmin: 'Superadmin', apostolo: 'Apóstolo', editor: 'Editor', visualizador: 'Visualizador' };
const PERFIL_BADGES = { superadmin: 'badge-red', apostolo: 'badge-gold', editor: 'badge-blue', visualizador: 'badge-gray' };

async function carregarUsuarios() {
  const r = await api('GET', '/api/admin/usuarios');
  if (!r.ok) { document.getElementById('lista-usuarios').innerHTML = '<p class="text-muted">Sem permissão.</p>'; return; }
  const lista = await r.json();
  const c = document.getElementById('lista-usuarios');
  if (!lista.length) { c.innerHTML = '<div class="data-table"><table><tr><td class="empty">Nenhum usuário</td></tr></table></div>'; return; }
  c.innerHTML = `<div class="data-table"><table>
    <thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${lista.map(u => `<tr>
      <td><strong>${u.nome}</strong></td>
      <td><code>${u.usuario}</code></td>
      <td><span class="badge ${PERFIL_BADGES[u.perfil] || 'badge-gray'}">${PERFIL_LABELS[u.perfil] || u.perfil}</span></td>
      <td><span class="badge ${u.ativo ? 'badge-green' : 'badge-gray'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn-icon" onclick='editarUsuario(${JSON.stringify(u)})' title="Editar">✏️</button>
        <button class="btn-icon danger" onclick="deletarUsuario(${u.id},'${u.nome}')" title="Excluir">🗑️</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function abrirModalUsuario() {
  document.getElementById('uId').value = '';
  document.getElementById('uNome').value = '';
  document.getElementById('uUsuario').value = '';
  document.getElementById('uSenha').value = '';
  document.getElementById('uPerfil').value = 'visualizador';
  document.getElementById('uAtivo').checked = true;
  document.getElementById('uSenhaHint').textContent = '(obrigatória)';
  document.getElementById('modalUsuarioTitulo').textContent = 'Novo Usuário';
  abrirModal('modalUsuario');
}

function editarUsuario(u) {
  document.getElementById('uId').value = u.id;
  document.getElementById('uNome').value = u.nome;
  document.getElementById('uUsuario').value = u.usuario;
  document.getElementById('uSenha').value = '';
  document.getElementById('uPerfil').value = u.perfil;
  document.getElementById('uAtivo').checked = !!u.ativo;
  document.getElementById('uSenhaHint').textContent = '(deixe em branco para não alterar)';
  document.getElementById('modalUsuarioTitulo').textContent = 'Editar Usuário';
  abrirModal('modalUsuario');
}

async function salvarUsuario(e) {
  e.preventDefault();
  const r = await api('POST', '/api/admin/usuario', {
    id: document.getElementById('uId').value || null,
    nome: document.getElementById('uNome').value,
    usuario: document.getElementById('uUsuario').value,
    senha: document.getElementById('uSenha').value || undefined,
    perfil: document.getElementById('uPerfil').value,
    ativo: document.getElementById('uAtivo').checked,
  });
  if (r.ok) { mostrarToast('Salvo!'); fecharModal('modalUsuario'); carregarUsuarios(); }
  else { const j = await r.json(); mostrarToast(j.error || 'Erro ao salvar'); }
}

async function deletarUsuario(id, nome) {
  if (!confirm(`Excluir usuário "${nome}"?`)) return;
  const r = await api('DELETE', `/api/admin/usuario/${id}`);
  if (r.ok) { mostrarToast('Excluído'); carregarUsuarios(); }
  else { const j = await r.json(); mostrarToast(j.error || 'Erro ao excluir'); }
}

// ── Init ───────────────────────────────────────────────────────────────────
if (SESSION?.token) iniciarAdmin();
