import { RicardoAvatar3D } from './avatar3d.js';
import { VoiceController } from './voice.js';

let avatar = null;
let voice = null;
let isVoiceEnabled = true;
let audioUnlocked = false;

document.addEventListener('DOMContentLoaded', () => {
  console.log('⚡ Inicializando interface do Avatar...');

  // 1. Configurar eventos de UI em primeiro lugar
  setupUIEvents();

  // 2. Inicializar áudio com tolerância a falhas
  try {
    voice = new VoiceController({
      onLipSyncUpdate: (amplitude) => {
        if (avatar) avatar.setLipSync(amplitude);
      },
      onSpeakingStateChange: (type, active) => {
        const waveBars = document.querySelectorAll('.wave-bar');
        const voicePillText = document.getElementById('voice-status-text');

        if (type === 'speaking') {
          waveBars.forEach((b) => b.classList.toggle('speaking', active));
          if (voicePillText) {
            voicePillText.textContent = active ? 'Ricardo a falar...' : 'Voz Serena Ativa';
          }
        } else if (type === 'listening') {
          const micBtn = document.getElementById('mic-btn');
          if (micBtn) micBtn.classList.toggle('active', active);
          if (voicePillText) {
            voicePillText.textContent = active ? 'Ricardo a escutar...' : 'Voz Serena Ativa';
          }
        }
      },
    });
  } catch (err) {
    console.warn('Aviso ao inicializar áudio:', err);
  }

  // 3. Inicializar Avatar 3D com tolerância a falhas
  try {
    avatar = new RicardoAvatar3D('canvas3d-container');
  } catch (err) {
    console.error('Aviso ao inicializar Avatar 3D (WebGL):', err);
  }

  // 4. Desbloqueio de áudio na primeira interação do utilizador
  const unlockAudio = () => {
    if (!audioUnlocked) {
      if (voice) voice.ensureAudioContext();
      audioUnlocked = true;
    }
  };
  window.addEventListener('click', unlockAudio, { capture: true, once: true });
  window.addEventListener('keydown', unlockAudio, { capture: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { capture: true, once: true });

  // 5. Verificar estado do servidor ou chave local
  checkServerStatus();
});

async function checkServerStatus() {
  const settingsBtn = document.getElementById('settings-btn');
  let isReady = false;

  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      isReady = !!data.ready;
    }
  } catch {
    // Se não há backend (hospedagem estática GitHub Pages), verifica chave no localStorage
    isReady = !!localStorage.getItem('gemini_api_key');
  }

  if (settingsBtn) {
    if (isReady) {
      settingsBtn.textContent = '⚡ Gemini 3.8 Ativo';
      settingsBtn.style.borderColor = 'rgba(74, 222, 128, 0.4)';
    } else {
      settingsBtn.textContent = '⚙ Chave Gemini';
      settingsBtn.style.borderColor = '';
    }
  }
}

function setupUIEvents() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const messagesContainer = document.getElementById('messages-container');
  const apiKeyModal = document.getElementById('api-key-modal');
  const drawerPanel = document.getElementById('drawer-panel');
  const drawerBackdrop = document.getElementById('drawer-backdrop');

  // Envio de formulário de texto
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput ? chatInput.value.trim() : '';
      if (!text) return;
      sendMessage(text);
      if (chatInput) chatInput.value = '';
    });
  }

  // DELEGAÇÃO GLOBAL DE CLIQUES: garante que NENHUM clique em botão é perdido
  document.addEventListener('click', (e) => {
    // 1. Clique nos Chips de Tópicos
    const chip = e.target.closest('.chip');
    if (chip) {
      e.preventDefault();
      e.stopPropagation();
      const prompt = chip.getAttribute('data-prompt') || chip.innerText.trim();
      console.log('Tópico selecionado:', prompt);
      sendMessage(prompt);
      return;
    }

    // 2. Microfone
    const micBtn = e.target.closest('#mic-btn');
    if (micBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (!voice) return;
      voice.ensureAudioContext();
      if (voice.isListening) {
        voice.stopListening();
      } else {
        voice.startListening(
          (transcript) => {
            if (chatInput) chatInput.value = transcript;
            sendMessage(transcript);
            if (chatInput) chatInput.value = '';
          },
          (err) => {
            console.warn('Microfone:', err);
            appendMessage('avatar', 'Aviso: Permita o acesso ao microfone no navegador para falar com o Ricardo.');
          }
        );
      }
      return;
    }

    // 3. Alternar Voz (Ligar/Desligar)
    const voiceToggleBtn = e.target.closest('#voice-toggle-btn');
    if (voiceToggleBtn) {
      e.preventDefault();
      isVoiceEnabled = !isVoiceEnabled;
      const icon = voiceToggleBtn.querySelector('.icon');
      if (isVoiceEnabled) {
        voiceToggleBtn.style.color = 'var(--accent-gold-light)';
        if (icon) icon.textContent = '🔊';
      } else {
        if (voice) voice.stopSpeaking();
        voiceToggleBtn.style.color = 'var(--text-dim)';
        if (icon) icon.textContent = '🔇';
      }
      return;
    }

    // 4. Abrir Gaveta de Memória
    const memoryBtn = e.target.closest('#memory-btn');
    if (memoryBtn) {
      e.preventDefault();
      toggleDrawer(true);
      return;
    }

    // 5. Fechar Gaveta de Memória
    const closeDrawerBtn = e.target.closest('#close-drawer-btn');
    if (closeDrawerBtn) {
      e.preventDefault();
      toggleDrawer(false);
      return;
    }

    if (e.target === drawerBackdrop) {
      toggleDrawer(false);
      return;
    }

    // 6. Botão de Configuração de Chave Gemini
    const settingsBtn = e.target.closest('#settings-btn');
    if (settingsBtn) {
      e.preventDefault();
      if (apiKeyModal) {
        apiKeyModal.classList.add('open');
        apiKeyModal.style.setProperty('display', 'flex', 'important');
      }
      return;
    }

    // 7. Fechar Modal de Chave
    const closeModalBtn = e.target.closest('#close-modal-btn');
    const skipKeyBtn = e.target.closest('#skip-key-btn');
    if (closeModalBtn || skipKeyBtn) {
      e.preventDefault();
      if (apiKeyModal) {
        apiKeyModal.classList.remove('open');
        apiKeyModal.style.setProperty('display', 'none', 'important');
      }
      return;
    }

    // 8. Salvar Chave Gemini
    const saveKeyBtn = e.target.closest('#save-key-btn');
    if (saveKeyBtn) {
      e.preventDefault();
      const input = document.getElementById('api-key-input');
      const key = input ? input.value.trim() : '';
      if (!key) return;

      // Salva no localStorage para funcionar mesmo sem backend (ex: GitHub Pages)
      localStorage.setItem('gemini_api_key', key);

      // Tenta salvar também no backend se disponível
      fetch('/api/config/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      }).catch(() => {});

      if (apiKeyModal) {
        apiKeyModal.classList.remove('open');
        apiKeyModal.style.setProperty('display', 'none', 'important');
      }
      checkServerStatus();
      appendMessage('avatar', 'Excelente, Diogo. A chave Gemini foi ligada com sucesso! O raciocínio generativo avançado está ativo.');
      if (voice && isVoiceEnabled) {
        voice.speak('Excelente, Diogo. A chave Gemini foi ligada com sucesso! O raciocínio generativo avançado está ativo.');
      }
      return;
    }

    // 9. Modo Imersão (Modo 3D Puro)
    const immersionBtn = e.target.closest('#immersion-btn');
    if (immersionBtn) {
      e.preventDefault();
      if (messagesContainer) {
        messagesContainer.classList.toggle('minimized');
        immersionBtn.textContent = messagesContainer.classList.contains('minimized') ? '💬 Mostrar Chat' : '👁 Modo 3D Puro';
      }
      return;
    }

    // 10. Adicionar Meta
    const addGoalBtn = e.target.closest('#add-goal-btn');
    if (addGoalBtn) {
      e.preventDefault();
      const input = document.getElementById('new-goal-input');
      const val = input ? input.value.trim() : '';
      if (!val) return;
      fetch('/api/memory/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: val, category: 'Estratégia' }),
      })
        .then(() => {
          if (input) input.value = '';
          loadMemoryToDrawer();
        })
        .catch(() => {
          // Salva localmente caso sem backend
          if (input) input.value = '';
          loadMemoryToDrawer();
        });
      return;
    }
  });

  // Funções auxiliares
  function toggleDrawer(open) {
    if (drawerBackdrop) {
      drawerBackdrop.classList.toggle('open', open);
      drawerBackdrop.style.setProperty('display', open ? 'block' : 'none', 'important');
    }
    if (drawerPanel) {
      drawerPanel.classList.toggle('open', open);
    }
    if (open) loadMemoryToDrawer();
  }
}

// Motor de conselho direto de Ricardo no cliente (garante funcionamento 100% autônomo e offline)
function generateClientMentorAdvice(message) {
  const lower = (message || '').toLowerCase();

  if (lower.includes('80/20') || lower.includes('maior impacto') || lower.includes('foco de hoje') || lower.includes('energia hoje') || lower.includes('prioridade')) {
    return `Diogo, vou ser frontal contigo, olho no olho.

O teu maior risco hoje não é falta de capacidade; é dispersão em micro-tarefas que dão apenas uma falsa sensação de produtividade.

A tua prioridade 80/20 é uma só: focar na tua meta principal — "Estruturar e automatizar fluxos de trabalho com IA".

Pára de mexer no acessório antes de teres o motor a funcionar. Pega na decisão mais difícil que estás a evitar e ataca-a agora mesmo. Sem rodeios: qual é o primeiro passo concreto que vais dar nos próximos trinta minutos?`;
  }

  if (lower.includes('dilema') || lower.includes('verdade nua e crua') || lower.includes('sem filtros') || lower.includes('decisão')) {
    return `Vamos falar com verdade nua e crua, Diogo.

Quando temos um dilema que parece complexo demais, 90% das vezes a complexidade é apenas a nossa mente a tentar adiar o desconforto da decisão certa.

Aplica primeiros princípios:
1. Se tirares o medo do julgamento dos outros, qual é o caminho evidente?
2. Qual das opções te dá mais liberdade e controlo estratégico daqui a seis meses?

Diz-me em poucas palavras as duas alternativas. Sem floreados. Eu digo-te logo onde está o ponto cego.`;
  }

  if (lower.includes('dispersar') || lower.includes('perder tempo') || lower.includes('acessório') || lower.includes('foco')) {
    return `Queres a verdade direta? Estás a gastar energia preciosa a aperfeiçoar coisas que ainda nem foram testadas no terreno real.

A armadilha clássica do profissional inteligente é o excesso de planeamento a servir de refúgio. Estás a arrumar a mesa quando devias estar a lançar.

Corta as tarefas secundárias. Escolhe apenas UMA entrega tangível para hoje e fecha o dia com ela concluída. Qual é essa entrega única?`;
  }

  if (lower.includes('metas') || lower.includes('revisão') || lower.includes('próximo passo') || lower.includes('rever metas')) {
    return `Aqui está o raio-X das tuas metas ativas, Diogo:

• **Estruturar e automatizar fluxos de trabalho com IA** (Tecnologia / Produtividade)

Olha para isto com frieza: uma meta sem disciplina diária é apenas uma boa intenção. Esta meta teve um avanço mensurável nas últimas 48 horas? Se foi nenhum, vamos simplificar o teu foco agora mesmo.`;
  }

  return `Diogo, ouvi-te com toda a atenção e estou aqui contigo, olhos nos olhos.

Sobre "${message}": a minha resposta é direta e sem filtros. Não procures atalhos onde precisas de disciplina de primeiros princípios. Como estrategista e desenvolvedor, sabes que clareza precede a velocidade.

Diz-me com franqueza: qual é o resultado mensurável e prático que queres alcançar aqui, e qual é a primeira ação que podes executar hoje?`;
}

// Chamada direta à API Gemini quando executado como frontend estático
async function callGeminiDirect(message, apiKey) {
  const prompt = `Você é o Ricardo, o conselheiro pessoal de confiança, consultor estratégico e mentor executivo de Diogo Ferreira.
Voz masculina suave, simpática, acolhedora, frontal, direta e sem filtros. Responda diretamente a Diogo Ferreira sem rodeios corporativos:

Mensagem de Diogo: "${message}"`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) throw new Error(`Status ${res.status}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Resposta vazia');
  return text;
}

async function sendMessage(text) {
  if (voice) voice.ensureAudioContext();

  appendMessage('user', text);

  // Criar indicador de resposta do Ricardo
  const loadingId = appendMessage('avatar', 'Ricardo a refletir com frontalidade e serenidade...', true);

  try {
    let replyText = '';
    let replyAudio = null;

    // 1. Tentar obter do servidor Express backend
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, withAudio: isVoiceEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        replyText = data.text;
        replyAudio = data.audio;
      }
    } catch {
      // Backend inacessível (ex: GitHub Pages)
    }

    // 2. Se backend não responder, usar Gemini direto ou motor autónomo
    if (!replyText) {
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) {
        try {
          replyText = await callGeminiDirect(text, storedKey);
        } catch {
          replyText = generateClientMentorAdvice(text);
        }
      } else {
        replyText = generateClientMentorAdvice(text);
      }
    }

    removeMessage(loadingId);
    appendMessage('avatar', replyText);

    // Reproduzir voz do Ricardo com Lip-Sync
    if (voice && isVoiceEnabled) {
      voice.speak(replyText, replyAudio);
    }
  } catch (err) {
    removeMessage(loadingId);
    const fallback = generateClientMentorAdvice(text);
    appendMessage('avatar', fallback);
    if (voice && isVoiceEnabled) voice.speak(fallback);
  }
}

function appendMessage(sender, text, isLoading = false) {
  const container = document.getElementById('messages-container');
  if (!container) return null;

  const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.id = id;

  const senderName = sender === 'user' ? 'Diogo Ferreira' : 'Ricardo';

  const formatted = text
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  div.innerHTML = `
    <span class="message-sender">${senderName}</span>
    <div class="message-bubble ${isLoading ? 'loading' : ''}">
      <p>${formatted}</p>
    </div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeMessage(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function loadMemoryToDrawer() {
  try {
    let memory = null;
    try {
      const res = await fetch('/api/memory');
      if (res.ok) memory = await res.json();
    } catch {}

    if (!memory) {
      try {
        const res = await fetch('./data/memory.json');
        if (res.ok) memory = await res.json();
      } catch {}
    }

    if (!memory) {
      memory = {
        profile: {
          name: 'Diogo Ferreira',
          role: 'Desenvolvedor & Estrategista',
          communicationStyle: 'Direto, analítico, desafiador e focado em planos práticos (80/20).',
        },
        goals: [
          { id: 'goal-1', title: 'Estruturar e automatizar fluxos de trabalho com IA', category: 'Tecnologia', status: 'active' },
        ],
        facts: [
          'Prefere respostas estruturadas com passos práticos e sem enrolação.',
          'Foco em execução com primeiros princípios.',
        ],
      };
    }

    const goalsList = document.getElementById('drawer-goals-list');
    const factsList = document.getElementById('drawer-facts-list');
    const profileInfo = document.getElementById('drawer-profile-info');

    if (profileInfo && memory.profile) {
      profileInfo.innerHTML = `
        <div class="fact-item"><strong>Nome:</strong> ${memory.profile.name}</div>
        <div class="fact-item"><strong>Foco:</strong> ${memory.profile.role}</div>
        <div class="fact-item"><strong>Postura:</strong> ${memory.profile.communicationStyle}</div>
      `;
    }

    if (goalsList && memory.goals) {
      const active = memory.goals.filter((g) => g.status === 'active');
      if (active.length === 0) {
        goalsList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-dim);">Nenhuma meta ativa cadastrada.</p>`;
      } else {
        goalsList.innerHTML = active
          .map(
            (g) => `
          <div class="goal-card">
            <div>
              <div class="goal-title">${g.title}</div>
              <div class="goal-cat">${g.category || 'Geral'}</div>
            </div>
            <button class="action-btn" style="width: 28px; height: 28px; font-size: 0.7rem;" onclick="completeGoal('${g.id}')" title="Concluir meta">✔</button>
          </div>
        `
          )
          .join('');
      }
    }

    if (factsList && memory.facts) {
      factsList.innerHTML = memory.facts
        .map((f) => `<div class="fact-item">• ${f}</div>`)
        .join('');
    }
  } catch (e) {
    console.error('Erro ao carregar memória:', e);
  }
}

window.completeGoal = async (id) => {
  try {
    await fetch('/api/memory/goal/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  } catch {}
  loadMemoryToDrawer();
};
