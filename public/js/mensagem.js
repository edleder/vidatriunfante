// ── Estado ─────────────────────────────────────────────────────────────────
let dataAtual = dataHoje();
let devocionalAtual = null;

// ── Helpers ────────────────────────────────────────────────────────────────
function dataHoje() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/').reverse().join('-');
}

function formatarDataBR(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
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
  const card     = document.getElementById('devocionalCard');
  const error    = document.getElementById('errorCard');

  skeleton.classList.remove('hidden');
  card.classList.add('hidden');
  error.classList.add('hidden');

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
    card.classList.remove('hidden');

    // Atualiza botão "próximo"
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
  document.getElementById('cardDate').textContent = formatarDataBR(d.data);
  document.getElementById('versiculoRef').textContent = d.versiculo_referencia;
  document.getElementById('versiculoTexto').textContent = d.versiculo_texto;
  document.getElementById('reflexao').textContent = d.reflexao;
  document.getElementById('pratica').textContent = d.pratica;

  const badge = document.getElementById('temaBadge');
  badge.textContent = d.tema || '';

  // Vídeo do YouTube
  const videoSection = document.getElementById('videoSection');
  const player = document.getElementById('youtubePlayer');
  if (d.youtube_id) {
    player.src = `https://www.youtube.com/embed/${d.youtube_id}`;
    videoSection.classList.remove('hidden');
  } else {
    player.src = '';
    videoSection.classList.add('hidden');
  }

  // Animação de entrada
  const card = document.getElementById('devocionalCard');
  card.classList.remove('card-enter');
  void card.offsetWidth; // reflow
  card.classList.add('card-enter');

  document.title = `${d.versiculo_referencia} — Devocional`;
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
    try {
      await navigator.share({ title: 'Devocional IVT', text: texto, url });
    } catch {}
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

// ── Swipe gesture para navegar ─────────────────────────────────────────────
(function swipe() {
  let startX = 0;
  const container = document.getElementById('cardContainer');

  container.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  container.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      navegarData(diff > 0 ? -1 : 1);
    }
  }, { passive: true });
})();

// ── Init ───────────────────────────────────────────────────────────────────
carregarDevocional();
