export class VoiceController {
  constructor({ onLipSyncUpdate, onSpeakingStateChange }) {
    this.onLipSyncUpdate = onLipSyncUpdate || (() => {});
    this.onSpeakingStateChange = onSpeakingStateChange || (() => {});
    
    this.audioContext = null;
    this.analyser = null;
    this.currentAudio = null;
    this.synth = window.speechSynthesis;
    this.recognition = null;
    this.isListening = false;
    this.isPlaying = false;
    this.voiceMode = 'gemini'; // 'gemini' ou 'browser'
    this.speechPaceInterval = null;

    this.initAudioContext();
    this.initSpeechRecognition();
  }

  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 128;
      }
    } catch (e) {
      console.warn('Web Audio API não inicializada:', e);
    }
  }

  ensureAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'pt-PT'; // Português
    }
  }

  startListening(onResult, onError) {
    if (!this.recognition) {
      if (onError) onError('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onSpeakingStateChange('listening', true);
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (onResult) onResult(transcript);
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      this.onSpeakingStateChange('listening', false);
      if (onError) onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onSpeakingStateChange('listening', false);
    };

    try {
      this.recognition.start();
    } catch {
      // Ignora erro se já estiver ativo
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  async speak(text, audioBase64 = null) {
    this.stopSpeaking();
    this.ensureAudioContext();

    if (audioBase64) {
      return this.playGeminiAudio(audioBase64);
    } else {
      return this.speakWithBrowserSynth(text);
    }
  }

  async playGeminiAudio(base64Data) {
    return new Promise(async (resolve) => {
      try {
        this.ensureAudioContext();

        // Conversão direta de base64 para ArrayBuffer
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer.slice(0));
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Conectar ao analisador de frequências para Lip-Sync de alta fidelidade
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.isPlaying = true;
        this.onSpeakingStateChange('speaking', true);

        const checkLipSync = () => {
          if (!this.isPlaying) return;

          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          // Faixa vocal masculina (frequências médias-graves)
          for (let i = 2; i < 26; i++) {
            sum += dataArray[i];
          }
          const average = sum / 24;
          const normalized = Math.min(1.0, (average / 115) * 1.35);
          this.onLipSyncUpdate(normalized);

          requestAnimationFrame(checkLipSync);
        };

        checkLipSync();

        source.onended = () => {
          this.isPlaying = false;
          this.onLipSyncUpdate(0);
          this.onSpeakingStateChange('speaking', false);
          resolve();
        };

        source.start(0);
        this.currentAudioSource = source;
      } catch (err) {
        console.warn('Fallback na reprodução Web Audio para Audio element:', err);
        // Fallback de segurança para elemento de áudio HTML5
        try {
          const audio = new Audio(`data:audio/wav;base64,${base64Data}`);
          this.currentAudio = audio;
          audio.onended = () => {
            this.isPlaying = false;
            this.onLipSyncUpdate(0);
            this.onSpeakingStateChange('speaking', false);
            resolve();
          };
          audio.play().catch(() => resolve());
        } catch {
          resolve();
        }
      }
    });
  }

  speakWithBrowserSynth(text) {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }

      try {
        this.synth.cancel();
      } catch {}

      // Limpar marcações de markdown e emojis para leitura oral limpa
      const cleanText = text
        .replace(/[*#_`~>\[\]\(\)]/g, ' ')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'pt-PT';

      // 1. Catálogo e Filtro Cirúrgico de Vozes Masculinas Naturais
      const voices = this.synth.getVoices();
      const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));

      const isFemale = (name) => {
        const lower = name.toLowerCase();
        return lower.includes('raquel') || lower.includes('francisca') || lower.includes('maria') ||
               lower.includes('heloisa') || lower.includes('vitoria') || lower.includes('luciana') ||
               lower.includes('female') || lower.includes('mulher') || lower.includes('ines') ||
               lower.includes('fernanda') || lower.includes('leticia') || lower.includes('clara') ||
               lower.includes('camila') || lower.includes('yara') || lower.includes('joana') ||
               lower.includes('teresa') || lower.includes('girl') || lower.includes('woman') ||
               lower.includes('catherine') || lower.includes('zira') || lower.includes('eva');
      };

      const isMale = (name) => {
        const lower = name.toLowerCase();
        return lower.includes('duarte') || lower.includes('antonio') || lower.includes('fabio') ||
               lower.includes('daniel') || lower.includes('rodrigo') || lower.includes('male') ||
               lower.includes('homem') || lower.includes('felipe') || lower.includes('thiago') ||
               lower.includes('alvaro') || lower.includes('david') || lower.includes('george') ||
               lower.includes('guy');
      };

      // Prioridade 1: Voz natural masculina em Português (ex: Duarte Online Natural, Antonio Natural)
      let selectedVoice = ptVoices.find((v) => isMale(v.name) && (v.name.includes('Natural') || v.name.includes('Online')));

      // Prioridade 2: Qualquer voz masculina em Português
      if (!selectedVoice) {
        selectedVoice = ptVoices.find((v) => isMale(v.name));
      }

      // Prioridade 3: Voz em Português que não seja explicitamente feminina
      if (!selectedVoice) {
        selectedVoice = ptVoices.find((v) => !isFemale(v.name));
      }

      // Prioridade 4: Se nenhuma voz masculina pt existir, procurar uma voz natural masculina geral
      if (!selectedVoice) {
        selectedVoice = voices.find((v) => isMale(v.name) && v.name.includes('Natural'));
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }

      // 2. Afinação de Timbre Masculino Natural (Sem distorção robótica)
      // Pitch 1.0 preserva as frequências formantes da laringe humana original da voz natural
      utterance.pitch = 1.0; 
      utterance.rate = 0.95;  // Ritmo sereno, deliberado, acolhedor e seguro
      utterance.volume = 1.0;

      utterance.onstart = () => {
        this.isPlaying = true;
        this.onSpeakingStateChange('speaking', true);

        // Simulação fonética orgânica de fala (pausas entre palavras e ênfase nas vogais)
        let step = 0;
        this.speechPaceInterval = setInterval(() => {
          if (!this.isPlaying) {
            clearInterval(this.speechPaceInterval);
            return;
          }
          step++;
          // Cadência silábica realista com pausas naturais
          const syllable = Math.sin(step * 0.75);
          const emphasis = Math.sin(step * 0.25) * 0.2 + 0.8;
          const amp = syllable > -0.2 ? (syllable * 0.4 + 0.5) * emphasis : 0.05;
          this.onLipSyncUpdate(Math.max(0, Math.min(1.0, amp)));
        }, 75);
      };

      utterance.onend = () => {
        this.isPlaying = false;
        clearInterval(this.speechPaceInterval);
        this.onLipSyncUpdate(0);
        this.onSpeakingStateChange('speaking', false);
        resolve();
      };

      utterance.onerror = () => {
        this.isPlaying = false;
        clearInterval(this.speechPaceInterval);
        this.onLipSyncUpdate(0);
        this.onSpeakingStateChange('speaking', false);
        resolve();
      };

      this.synth.speak(utterance);
    });
  }

  stopSpeaking() {
    this.isPlaying = false;
    clearInterval(this.speechPaceInterval);
    this.onLipSyncUpdate(0);
    this.onSpeakingStateChange('speaking', false);

    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch {}
      this.currentAudioSource = null;
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }
}
