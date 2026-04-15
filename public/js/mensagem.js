// ── Estado ─────────────────────────────────────────────────────────────────
let dataAtual   = dataHoje();
let devocionalAtual = null;
let paginaAtual = 0; // 0 = devocional, 1 = vídeo

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

  const skeleton  = document.getElementById('skeletonCard');
  const viewport  = document.getElementById('sliderViewport');
  const error     = document.getElementById('errorCard');

  skeleton.classList.remove('hidden');
  viewport.classList.add('hidden');
  error.classList.add('hidden');

  // Volta sempre para a página do devocional ao trocar de dia
  irParaDevo(false);

  try {
    const url = data === dataHoje()
      ? '/api/devocional/hoje'
      : `/api/devocional/${data}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Não encontrado');

    const devocional = await res.json();
    devocionalAtual = devocional;
    dataAtual = devocional.data;

    renderizarDevocional(devocional);

    skeleton.classList.add('hidden');
    viewport.classList.remove('hidden');

    // Botão próximo
    const btnProximo = document.getElementById('btnProximo');
    if (btnProximo) {
      const isHoje = dataAtual === dataHoje();
      btnProximo.style.opacity = isHoje ? '0.3' : '1';
      btnProximo.disabled = isHoje;
    }

  } catch (err) {
    skeleton.classList.add('hidden');
    error.classList.remove('hidden');
  }
}

function renderizarDevocional(d) {
  // Página 1
  document.getElementById('cardDate').textContent    = formatarDataBR(d.data);
  document.getElementById('versiculoRef').textContent = d.versiculo_referencia;
  document.getElementById('versiculoTexto').textContent = d.versiculo_texto;
  document.getElementById('reflexao').textContent    = d.reflexao;
  document.getElementById('pratica').textContent     = d.pratica;
  document.getElementById('temaBadge').textContent   = d.tema || '';

  // Página 2 (vídeo)
  document.getElementById('videoDate').textContent = formatarDataBR(d.data);
  document.getElementById('videoRef').textContent  = d.versiculo_referencia;

  // Controla visibilidade da seta e slide de vídeo
  const arrow     = document.getElementById('videoArrow');
  const slideVid  = document.getElementById('slideVideo');
  const dotVideo  = document.getElementById('dotVideo');
  const player    = document.getElementById('youtubePlayer');

  if (d.youtube_id) {
    player.src = `https://www.youtube.com/embed/${d.youtube_id}`;
    arrow.classList.remove('hidden');
    slideVid.classList.remove('hidden');
    dotVideo.classList.remove('hidden');
  } else {
    player.src = '';
    arrow.classList.add('hidden');
    slideVid.classList.add('hidden');
    dotVideo.classList.add('hidden');
  }

  // Animação de entrada
  const card = document.getElementById('devocionalCard');
  card.classList.remove('card-enter');
  void card.offsetWidth;
  card.classList.add('card-enter');

  document.title = `${d.versiculo_referencia} — Devocional`;
}

// ── Navegação entre slides ─────────────────────────────────────────────────
function irParaVideo() {
  if (!devocionalAtual?.youtube_id) return;
  paginaAtual = 1;
  document.getElementById('sliderTrack').classList.add('on-video');
  atualizarDots();
}

function irParaDevo(animar = true) {
  paginaAtual = 0;
  const track = document.getElementById('sliderTrack');
  if (!animar) {
    track.style.transition = 'none';
    track.classList.remove('on-video');
    void track.offsetWidth;
    track.style.transition = '';
  } else {
    track.classList.remove('on-video');
  }
  // Para o vídeo ao voltar
  const player = document.getElementById('youtubePlayer');
  if (player.src) {
    player.src = player.src; // reset para pausar
  }
  atualizarDots();
}

function atualizarDots() {
  document.querySelectorAll('.pdot').forEach((dot, i) => {
    dot.classList.toggle('active', i === paginaAtual);
  });
}

// ── Navegação por data ─────────────────────────────────────────────────────
function navegarData(direcao) {
  const novaData = adicionarDias(dataAtual, direcao);
  const hoje = dataHoje();

  if (direcao > 0 && novaData > hoje) {
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
  let startX = 0, startY = 0, bloqueado = false;

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    bloqueado = false;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (bloqueado) return;
    const dx = startX - e.changedTouches[0].clientX;
    const dy = Math.abs(startY - e.changedTouches[0].clientY);

    // Ignora se for scroll vertical
    if (dy > Math.abs(dx) * 0.8) return;

    if (Math.abs(dx) > 45) {
      if (dx > 0 && paginaAtual === 0 && devocionalAtual?.youtube_id) {
        irParaVideo();
      } else if (dx < 0 && paginaAtual === 1) {
        irParaDevo();
      } else if (dx < 0 && paginaAtual === 0) {
        navegarData(1);
      } else if (dx > 0 && paginaAtual === 0) {
        navegarData(-1);
      }
    }
  }, { passive: true });
})();

// ── Dots clicáveis ─────────────────────────────────────────────────────────
document.querySelectorAll('.pdot').forEach(dot => {
  dot.addEventListener('click', () => {
    const pg = parseInt(dot.dataset.page);
    pg === 0 ? irParaDevo() : irParaVideo();
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
carregarDevocional();
