import { RicardoAvatar3D } from './avatar3d.js';
import { VoiceController } from './voice.js';

let avatar = null;
let voice = null;
let isVoiceEnabled = true;
let audioUnlocked = false;

document.addEventListener('DOMContentLoaded', () => {
  console.log('⚡ Inicializando interface do Avatar...');

  // 1. REGRA DE OURO: Configurar eventos de UI em primeiro lugar absoluto!
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

  // 4. Desbloqueio de áudio em qualquer interação
  const unlockAudio = () => {
    if (!audioUnlocked) {
      if (voice) voice.ensureAudioContext();
      audioUnlocked = true;
    }
  };
  window.addEventListener('click', unlockAudio, { capture: true, once: true });
  window.addEventListener('keydown', unlockAudio, { capture: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { capture: true, once: true });

  // 5. Verificar estado do servidor
  checkServerStatus();
});

async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      if (data.ready) {
        settingsBtn.textContent = '⚡ Gemini 3.8 Ativo';
        settingsBtn.style.borderColor = 'rgba(74, 222, 128, 0.4)';
      } else {
        settingsBtn.textContent = '⚙ Chave Gemini';
      }
    }
  } catch (e) {
    console.warn('Erro ao verificar status:', e);
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

      fetch('/api/config/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            if (apiKeyModal) {
              apiKeyModal.classList.remove('open');
              apiKeyModal.style.setProperty('display', 'none', 'important');
            }
            checkServerStatus();
            appendMessage('avatar', 'Excelente, Diogo. A chave Gemini foi ligada com sucesso! O raciocínio generativo está ativo.');
            if (voice && isVoiceEnabled) {
              voice.speak('Excelente, Diogo. A chave Gemini foi ligada com sucesso! O raciocínio generativo avançado está ativo.');
            }
          }
        })
        .catch((err) => console.error('Erro ao salvar chave:', err));
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
        .catch((err) => console.error(err));
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

async function sendMessage(text) {
  if (voice) voice.ensureAudioContext();

  appendMessage('user', text);

  // Criar indicador de resposta do Ricardo
  const loadingId = appendMessage('avatar', 'Ricardo a refletir com frontalidade e serenidade...', true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, withAudio: isVoiceEnabled }),
    });

    const data = await res.json();
    removeMessage(loadingId);

    if (data && data.text) {
      appendMessage('avatar', data.text);

      // Reproduzir voz do Ricardo com Lip-Sync
      if (voice && isVoiceEnabled) {
        voice.speak(data.text, data.audio);
      }
    } else {
      appendMessage('avatar', 'Diogo, estou aqui contigo. Repete a tua mensagem.');
    }
  } catch (err) {
    removeMessage(loadingId);
    appendMessage('avatar', `Diogo, estou contigo. Ocorreu uma oscilação na ligação (${err.message}). Diz-me novamente.`);
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
    const res = await fetch('/api/memory');
    const memory = await res.json();

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
    loadMemoryToDrawer();
  } catch (e) {
    console.error(e);
  }
};
