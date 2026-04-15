// ── Auth ───────────────────────────────────────────────────────────────────
let TOKEN = sessionStorage.getItem('ivt_admin_token') || '';

function fazerLogin(e) {
  e.preventDefault();
  TOKEN = document.getElementById('tokenInput').value.trim();
  sessionStorage.setItem('ivt_admin_token', TOKEN);
  iniciarAdmin();
}

function logout() {
  TOKEN = '';
  sessionStorage.removeItem('ivt_admin_token');
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

async function iniciarAdmin() {
  // Testa o token fazendo uma requisição simples
  const res = await fetch('/api/admin/devocionais?pagina=1', {
    headers: { 'x-admin-token': TOKEN },
  });

  if (!res.ok) {
    mostrarToast('Token inválido');
    return;
  }

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');

  // Define data padrão nos inputs
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('fData').value = hoje;
  document.getElementById('dataGerar').value = hoje;
  document.getElementById('loteInicio').value = hoje;

  carregarLista();
}

// ── API ────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'x-admin-token': TOKEN,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  return res;
}

// ── Toast ──────────────────────────────────────────────────────────────────
function mostrarToast(msg, dur = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

// ── Abas ───────────────────────────────────────────────────────────────────
function mostrarAba(nome) {
  document.querySelectorAll('.aba').forEach(a => a.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`aba-${nome}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${nome}'`)) {
      n.classList.add('active');
    }
  });

  if (nome === 'lista') carregarLista();
}

// ── Lista ──────────────────────────────────────────────────────────────────
let paginaAtual = 1;

async function carregarLista(pagina = 1) {
  paginaAtual = pagina;
  const res = await api('GET', `/api/admin/devocionais?pagina=${pagina}`);
  const data = await res.json();

  const tbody = document.getElementById('tabelaBody');
  tbody.innerHTML = '';

  if (!data.devocionais?.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-row">Nenhum devocional cadastrado</td></tr>';
    return;
  }

  data.devocionais.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${formatarData(d.data)}</strong></td>
      <td>${d.versiculo_referencia}<br><small style="color:#9c8472">${d.versiculo_texto.substring(0, 60)}...</small></td>
      <td>${d.tema || '—'}</td>
      <td>
        <button class="btn-edit" onclick="editarDevocional('${d.data}')">Editar</button>
        <button class="btn-danger" onclick="deletarDevocional('${d.data}')">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Paginação
  const totalPags = Math.ceil(data.total / data.por_pagina);
  const paginacao = document.getElementById('paginacao');
  paginacao.innerHTML = '';

  for (let i = 1; i <= totalPags; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === paginaAtual) btn.classList.add('active');
    btn.onclick = () => carregarLista(i);
    paginacao.appendChild(btn);
  }
}

function formatarData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function editarDevocional(data) {
  const res = await api('GET', `/api/devocional/${data}`);
  if (!res.ok) { mostrarToast('Erro ao carregar devocional'); return; }

  const d = await res.json();

  document.getElementById('formTitulo').textContent = 'Editar Devocional';
  document.getElementById('fData').value = d.data;
  document.getElementById('fRef').value = d.versiculo_referencia;
  document.getElementById('fTexto').value = d.versiculo_texto;
  document.getElementById('fReflexao').value = d.reflexao;
  document.getElementById('fPratica').value = d.pratica;
  document.getElementById('fTema').value = d.tema || '';

  mostrarAba('novo');
}

async function deletarDevocional(data) {
  if (!confirm(`Excluir devocional de ${formatarData(data)}?`)) return;

  const res = await api('DELETE', `/api/admin/devocional/${data}`);
  if (res.ok) {
    mostrarToast('Devocional excluído');
    carregarLista(paginaAtual);
  } else {
    mostrarToast('Erro ao excluir');
  }
}

// ── Formulário ─────────────────────────────────────────────────────────────
async function salvarDevocional(e) {
  e.preventDefault();

  const payload = {
    data:                 document.getElementById('fData').value,
    versiculo_referencia: document.getElementById('fRef').value,
    versiculo_texto:      document.getElementById('fTexto').value,
    reflexao:             document.getElementById('fReflexao').value,
    pratica:              document.getElementById('fPratica').value,
    tema:                 document.getElementById('fTema').value,
  };

  const res = await api('POST', '/api/admin/devocional', payload);

  if (res.ok) {
    mostrarToast('Salvo com sucesso!');
    document.getElementById('formDevocional').reset();
    document.getElementById('fData').value = new Date().toISOString().split('T')[0];
    document.getElementById('formTitulo').textContent = 'Novo Devocional';
    mostrarAba('lista');
  } else {
    const err = await res.json();
    mostrarToast('Erro: ' + (err.error || 'desconhecido'));
  }
}

// ── Geração IA ─────────────────────────────────────────────────────────────
async function gerarComIA() {
  const data  = document.getElementById('dataGerar').value;
  const btn   = document.getElementById('btnGerar');
  const result = document.getElementById('resultadoIA');
  const erro  = document.getElementById('erroIA');

  btn.disabled = true;
  btn.textContent = '⏳ Gerando...';
  result.classList.add('hidden');
  erro.classList.add('hidden');

  try {
    const res = await api('POST', '/api/admin/gerar', { data });
    const json = await res.json();

    if (!res.ok) throw new Error(json.error || 'Erro desconhecido');

    const d = json.devocional;

    document.getElementById('iaPreview').innerHTML = `
      <div class="ref">${d.versiculo_referencia}</div>
      <div class="quote">"${d.versiculo_texto}"</div>
      <div class="label">Reflexão</div>
      <div class="body">${d.reflexao}</div>
      <div class="label">Prática</div>
      <div class="body">${d.pratica}</div>
    `;

    result.classList.remove('hidden');
    carregarLista();
  } catch (err) {
    erro.textContent = 'Erro: ' + err.message;
    erro.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Gerar Devocional';
  }
}

async function gerarLote() {
  const inicio = document.getElementById('loteInicio').value;
  const dias   = parseInt(document.getElementById('loteDias').value) || 7;
  const btn    = document.getElementById('btnLote');
  const prog   = document.getElementById('progressoLote');

  if (!inicio) { mostrarToast('Selecione a data inicial'); return; }

  btn.disabled = true;
  prog.classList.remove('hidden');
  prog.textContent = 'Iniciando...';

  let sucesso = 0, erros = 0;

  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const dataStr = d.toISOString().split('T')[0];

    prog.textContent = `Gerando ${i + 1}/${dias}: ${dataStr}...`;

    try {
      const res = await api('POST', '/api/admin/gerar', { data: dataStr });
      if (res.ok) sucesso++;
      else erros++;
    } catch {
      erros++;
    }

    // Pausa para não sobrecarregar a API
    await new Promise(r => setTimeout(r, 1500));
  }

  prog.textContent = `Concluído: ${sucesso} gerados, ${erros} erros.`;
  btn.disabled = false;
  carregarLista();
}

// ── Init ───────────────────────────────────────────────────────────────────
if (TOKEN) {
  iniciarAdmin();
}
