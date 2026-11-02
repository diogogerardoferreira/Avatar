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
    return new Promise((resolve) => {
      try {
        const audioSrc = `data:audio/wav;base64,${base64Data}`;
        const audio = new Audio(audioSrc);
        this.currentAudio = audio;

        // Conecta ao analisador para Lip-Sync real
        if (this.audioContext && this.analyser) {
          try {
            const source = this.audioContext.createMediaElementSource(audio);
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
          } catch {
            // Elemento já conectado em alguns navegadores
          }
        }

        const dataArray = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 32);

        const checkLipSync = () => {
          if (!this.isPlaying || audio.paused || audio.ended) return;

          if (this.analyser) {
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            // Frequências da voz humana (faixas centrais)
            for (let i = 2; i < 24; i++) {
              sum += dataArray[i];
            }
            const average = sum / 22;
            const normalized = Math.min(1.0, (average / 110) * 1.3);
            this.onLipSyncUpdate(normalized);
          }
          requestAnimationFrame(checkLipSync);
        };

        audio.onplay = () => {
          this.isPlaying = true;
          this.onSpeakingStateChange('speaking', true);
          checkLipSync();
        };

        audio.onended = () => {
          this.isPlaying = false;
          this.onLipSyncUpdate(0);
          this.onSpeakingStateChange('speaking', false);
          resolve();
        };

        audio.onerror = () => {
          this.isPlaying = false;
          this.onLipSyncUpdate(0);
          this.onSpeakingStateChange('speaking', false);
          resolve();
        };

        audio.play().catch(() => resolve());
      } catch (err) {
        console.error('Erro na reprodução de áudio Gemini:', err);
        resolve();
      }
    });
  }

  speakWithBrowserSynth(text) {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }

      // Evita travamento de fala anterior
      try {
        this.synth.cancel();
      } catch {
        // Ignora
      }

      // Limpar marcações de markdown
      const cleanText = text
        .replace(/[*#_`~>\[\]\(\)]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'pt-PT'; // Garantir pronúncia em português

      // Escolher voz masculina, suave e acolhedora em Português
      const voices = this.synth.getVoices();
      const ptVoices = voices.filter((v) => v.lang.startsWith('pt') || v.lang.startsWith('PT'));
      
      const isFemale = (name) => {
        const lower = name.toLowerCase();
        return lower.includes('raquel') || lower.includes('francisca') || lower.includes('maria') ||
               lower.includes('heloisa') || lower.includes('vitoria') || lower.includes('luciana') ||
               lower.includes('female') || lower.includes('mulher') || lower.includes('ines') ||
               lower.includes('fernanda') || lower.includes('leticia');
      };

      const isMale = (name) => {
        const lower = name.toLowerCase();
        return lower.includes('duarte') || lower.includes('antonio') || lower.includes('daniel') ||
               lower.includes('rodrigo') || lower.includes('male') || lower.includes('homem') ||
               lower.includes('felipe') || lower.includes('thiago');
      };

      let selectedVoice = ptVoices.find((v) => isMale(v.name));
      if (!selectedVoice) {
        selectedVoice = ptVoices.find((v) => !isFemale(v.name));
      }
      if (!selectedVoice && ptVoices.length > 0) {
        selectedVoice = ptVoices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }

      // Parâmetros para voz masculina, suave, acolhedora, frontal e segura
      utterance.pitch = 0.88; // Timbre masculino suave, aveludado e acolhedor
      utterance.rate = 0.94;  // Cadência pausada, reflexiva e direta

      utterance.onstart = () => {
        this.isPlaying = true;
        this.onSpeakingStateChange('speaking', true);
        
        // Simulação realista de lip-sync durante a fala do sintetizador
        let step = 0;
        this.speechPaceInterval = setInterval(() => {
          if (!this.isPlaying) {
            clearInterval(this.speechPaceInterval);
            return;
          }
          step++;
          // Ondulação natural dos fonemas
          const amp = (Math.sin(step * 0.7) * 0.4 + 0.5) * (Math.random() * 0.3 + 0.7);
          this.onLipSyncUpdate(amp);
        }, 80);
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

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }
}
