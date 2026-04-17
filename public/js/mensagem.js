// ── Estado ─────────────────────────────────────────────────────────────────
let dataAtual       = dataHoje();
let devocionalAtual = null;
let paginaAtual     = 0;
const IS_HFC        = typeof HFC_MODE !== 'undefined' && HFC_MODE;
let _twTimer        = null;

// ── Typewriter ─────────────────────────────────────────────────────────────
function typewriter(el, text, speed = 16) {
  if (_twTimer) clearTimeout(_twTimer);
  el.textContent = '';
  el.classList.add('typewriting');
  let i = 0;
  function step() {
    if (i < text.length) {
      el.textContent += text[i++];
      _twTimer = setTimeout(step, speed);
    } else {
      el.classList.remove('typewriting');
    }
  }
  step();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function dataHoje() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/').reverse().join('-');
}

function formatarDataBR(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `• ${dia}/${mes}/${ano} •`;
}

function adicionarDias(dataStr, dias) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

function mostrarToast(msg, duracao = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duracao);
}

// ── Carregar devocional ────────────────────────────────────────────────────
async function carregarDevocional(data) {
  data = data || dataAtual;

  const skeleton = document.getElementById('skeletonCard');
  const viewport = document.getElementById('sliderViewport');
  const error    = document.getElementById('errorCard');

  skeleton.classList.remove('hidden');
  viewport.classList.add('hidden');
  error.classList.add('hidden');

  irParaDevo(false);

  try {
    const base = IS_HFC ? '/api/hfc' : '/api/devocional';
    const url  = data === dataHoje() ? `${base}/hoje` : `${base}/${data}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Não encontrado');

    const devocional = await res.json();
    devocionalAtual = devocional;
    dataAtual = devocional.data;

    renderizarDevocional(devocional);

    skeleton.classList.add('hidden');
    viewport.classList.remove('hidden');

    const btnProximo = document.getElementById('btnProximo');
    if (btnProximo) {
      const isHoje = dataAtual === dataHoje();
      btnProximo.style.opacity = isHoje ? '0.3' : '1';
      btnProximo.disabled = isHoje;
    }

  } catch {
    skeleton.classList.add('hidden');
    error.classList.remove('hidden');
  }
}

function renderizarDevocional(d) {
  document.getElementById('cardDate').textContent      = formatarDataBR(d.data);
  document.getElementById('versiculoRef').textContent  = d.versiculo_referencia;
  typewriter(document.getElementById('versiculoTexto'), d.versiculo_texto);
  document.getElementById('reflexao').textContent      = d.reflexao;
  document.getElementById('pratica').textContent       = d.pratica;
  document.getElementById('temaBadge').textContent     = d.tema || '';

  document.getElementById('videoDate').textContent = formatarDataBR(d.data);
  document.getElementById('videoRef').textContent  = d.versiculo_referencia;

  // Mostra/esconde só a seção de vídeo dentro do slide (não o slide inteiro)
  const videoSection = document.getElementById('videoSection');
  const player       = document.getElementById('youtubePlayer');
  if (d.youtube_id) {
    player.src = `https://www.youtube.com/embed/${d.youtube_id}`;
    videoSection.classList.remove('hidden');
  } else {
    player.src = '';
    videoSection.classList.add('hidden');
  }

  const card = document.getElementById('devocionalCard');
  card.classList.remove('card-enter');
  void card.offsetWidth;
  card.classList.add('card-enter');

  document.title = `${d.versiculo_referencia} — ${IS_HFC ? 'HFC' : 'Devocional'}`;
}

// ── Navegação entre slides ─────────────────────────────────────────────────
function irParaPagina(pagina, animar = true) {
  const track = document.getElementById('sliderTrack');
  if (!animar) {
    track.style.transition = 'none';
    void track.offsetWidth;
  }
  track.dataset.pagina = pagina;
  track.style.transform = `translateX(-${pagina * 50}%)`;
  if (!animar) {
    void track.offsetWidth;
    track.style.transition = '';
  }
  paginaAtual = pagina;
  atualizarDots();
}

function irParaDevo(animar = true) {
  const player = document.getElementById('youtubePlayer');
  if (player && player.src) player.src = player.src; // pausa o vídeo
  irParaPagina(0, animar);
}

function irParaVideo() {
  irParaPagina(1);
  carregarConteudoSlide2();
}

function atualizarDots() {
  document.querySelectorAll('.pdot').forEach((dot, i) => {
    dot.classList.toggle('active', i === paginaAtual);
  });
}

// ── Ícones SVG para redes sociais ─────────────────────────────────────────
const ICONES_SVG = {
  instagram: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
  youtube:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  whatsapp:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
  facebook:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  tiktok:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
  link:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
};

// ── Conteúdo da 2ª aba ────────────────────────────────────────────────────
async function carregarConteudoSlide2() {
  carregarLinksDevocional();
  carregarLinksSociais();
  carregarInscricoes();
  carregarAnuncios();
}

async function carregarLinksDevocional() {
  const section   = document.getElementById('linksDevocionalSection');
  const container = document.getElementById('linksDevocionalLista');
  if (!section || !container) return;
  try {
    const base = IS_HFC ? '/api/hfc' : '/api/devocional';
    const res  = await fetch(`${base}/${dataAtual}/links`);
    const links = await res.json();
    if (!links.length) { section.classList.add('hidden'); return; }
    const icones = {
      youtube:   ICONES_SVG.youtube,
      instagram: ICONES_SVG.instagram,
      site:      ICONES_SVG.link,
    };
    container.innerHTML = links.map(lk => `
      <a class="link-item ${lk.link_tipo}" href="${lk.url}" target="_blank" rel="noopener">
        <div class="link-icon">${icones[lk.link_tipo] || ICONES_SVG.link}</div>
        <div class="link-info"><span class="link-name">${lk.titulo}</span></div>
        <div class="link-arrow">›</div>
      </a>`).join('');
    section.classList.remove('hidden');
  } catch {
    section.classList.add('hidden');
  }
}

async function carregarLinksSociais() {
  const container = document.getElementById('linksSociais');
  if (!container) return;
  try {
    const res   = await fetch('/api/links');
    const links = await res.json();
    container.innerHTML = links.length
      ? links.map(lk => {
          const icone  = ICONES_SVG[lk.icone] || ICONES_SVG.link;
          const classe = ICONES_SVG[lk.icone] ? lk.icone : 'outro';
          return `
            <a class="link-item ${classe}" href="${lk.url}" target="_blank" rel="noopener">
              <div class="link-icon">${icone}</div>
              <div class="link-info"><span class="link-name">${lk.nome}</span></div>
              <div class="link-arrow">›</div>
            </a>`;
        }).join('')
      : '';
  } catch { /* silencioso */ }
}

async function carregarInscricoes() {
  const section   = document.getElementById('inscricoesSection');
  const container = document.getElementById('linksEventos');
  if (!container) return;
  const pg = IS_HFC ? 'hfc' : 'geral';
  try {
    const [resEv, resCr] = await Promise.all([
      fetch(`/api/eventos?pagina=${pg}`),
      fetch(`/api/cursos?pagina=${pg}`),
    ]);
    const eventos = await resEv.json();
    const cursos  = await resCr.json();
    const todos   = [
      ...eventos.map(e => ({ ...e, _tipo: 'evento' })),
      ...cursos.map(c => ({ ...c, _tipo: 'curso' })),
    ];
    if (todos.length) {
      container.innerHTML = todos.map(item => {
        const icone = item._tipo === 'curso' ? '🎓' : '🎟️';
        const data  = item.data_evento || item.data_inicio;
        const [a, m, d] = (data || '').split('-');
        const dataFmt = data ? `${d}/${m}/${a}` : '';
        const meta = [dataFmt, item.horario, item.local].filter(Boolean).join(' · ');
        return `
          <a class="link-event" href="/${item._tipo}/${item.id}">
            <div class="link-event-icon">${icone}</div>
            <div class="link-event-info">
              <span class="link-event-name">${item.titulo}</span>
              <span class="link-event-meta">${meta || (item._tipo === 'curso' ? 'Curso' : 'Evento')}</span>
            </div>
            <div class="link-arrow">›</div>
          </a>`;
      }).join('');
    } else if (section) {
      section.classList.add('hidden');
    }
  } catch {
    if (section) section.classList.add('hidden');
  }
}

async function carregarAnuncios() {
  const section = document.getElementById('anunciosSection');
  const lista   = document.getElementById('anunciosLista');
  if (!section || !lista) return;
  try {
    const [resAn, resCom] = await Promise.all([
      fetch('/api/anuncios'),
      fetch('/api/comunicados'),
    ]);
    const anuncios    = await resAn.json();
    const comunicados = await resCom.json();
    const todos = [
      ...anuncios.map(a => ({ ...a, _tipo: 'anuncio' })),
      ...comunicados.map(c => ({ ...c, _tipo: 'comunicado' })),
    ];
    if (todos.length) {
      lista.innerHTML = todos.map(item => `
        <div class="anuncio-item${(item.destaque || item.importante) ? ' destaque' : ''}">
          <span class="anuncio-titulo">${item.titulo}</span>
          <p class="anuncio-corpo">${item.conteudo}</p>
        </div>`).join('');
    } else {
      section.classList.add('hidden');
    }
  } catch {
    section.classList.add('hidden');
  }
}

// ── Navegação por data ─────────────────────────────────────────────────────
function navegarData(direcao) {
  const novaData = adicionarDias(dataAtual, direcao);
  if (direcao > 0 && novaData > dataHoje()) {
    mostrarToast('Este é o devocional mais recente');
    return;
  }
  dataAtual = novaData;
  carregarDevocional(dataAtual);
}

// ── Compartilhar ───────────────────────────────────────────────────────────
async function compartilhar() {
  if (!devocionalAtual) return;
  const texto = `📖 ${devocionalAtual.versiculo_referencia}\n\n"${devocionalAtual.versiculo_texto}"\n\n${devocionalAtual.reflexao}`;
  const url   = window.location.href;
  if (navigator.share) {
    try { await navigator.share({ title: 'Devocional', text: texto, url }); } catch {}
  } else {
    await navigator.clipboard.writeText(`${texto}\n\n${url}`);
    mostrarToast('Texto copiado para a área de transferência');
  }
}

// ── Copiar versículo ───────────────────────────────────────────────────────
async function copiarVersiculo() {
  if (!devocionalAtual) return;
  const texto = `"${devocionalAtual.versiculo_texto}" — ${devocionalAtual.versiculo_referencia}`;
  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast('Versículo copiado!');
  } catch {
    mostrarToast('Não foi possível copiar');
  }
}

// ── Swipe horizontal ───────────────────────────────────────────────────────
(function swipe() {
  let startX = 0, startY = 0;

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = startX - e.changedTouches[0].clientX;
    const dy = Math.abs(startY - e.changedTouches[0].clientY);
    if (dy > Math.abs(dx) * 0.8) return;
    if (Math.abs(dx) < 45) return;

    if (dx > 0) {
      // swipe esquerda → avança
      if (paginaAtual === 0) irParaVideo();
    } else {
      // swipe direita → volta
      if (paginaAtual === 1) irParaDevo();
      else if (paginaAtual === 0) navegarData(-1);
    }
  }, { passive: true });
})();

// ── Dots clicáveis ─────────────────────────────────────────────────────────
document.querySelectorAll('.pdot').forEach(dot => {
  dot.addEventListener('click', () => {
    parseInt(dot.dataset.page) === 0 ? irParaDevo() : irParaVideo();
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
carregarDevocional();
