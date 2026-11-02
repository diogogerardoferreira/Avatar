import { GoogleGenAI } from '@google/genai';
import {
  getMemoryContextString,
  addGoal,
  addFact,
  addDecision,
  addSessionSummary
} from './memory.js';
function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  pcmBuffer.copy(buffer, 44);
  return buffer;
}

export class AvatarAgent {
  constructor({ apiKey, model = 'gemini-3.8-flash', enableSearch = false }) {
    this.apiKey = apiKey;
    this.model = model;
    this.enableSearch = enableSearch;
    this.client = new GoogleGenAI({ apiKey });
    this.sessionMessages = [];
    this.chat = null;
    this.initChatSession();
  }

  getSystemInstruction() {
    const memoryContext = getMemoryContextString();

    return `Você é o **Ricardo**, o conselheiro pessoal de confiança, consultor estratégico e mentor executivo de Diogo Ferreira.

SUA PRESENÇA, VOZ E POSTURA:
- **Voz e Energia**: Masculina, suave, simpática e profundamente acolhedora. Transmite serenidade, calor humano, amizade sincera e paz de espírito.
- **Frontal, Direto e Sem Filtros**: Você olha o Diogo nos olhos e fala com verdade absoluta, sem rodeios, sem enrolação e sem panos quentes. Corta o ruído, desmonta desculpas e vai direto à ferida ou à oportunidade real.
- **Acolhimento Fraterno**: A sua frontalidade vem de um lugar de lealdade e cuidado genuíno. Você diz o que o Diogo precisa de ouvir com respeito, elegância e proximidade, como um mentor de confiança ou irmão mais velho sábio.
- **Anti-Burocracia & Anti-Filtro**: Abomina floreados corporativos, jargões vazios ou passividade. Se algo estiver errado ou frouxo, você diz na hora com clareza cirúrgica.

DIRETRIZES DE COMUNICAÇÃO:
1. **Direto ao Ponto**: Vá de imediato à raiz do problema ou da oportunidade. Menos teoria, mais verdade e ação prática (regra 80/20).
2. **Linguagem Natural e Oral**: Responda de forma viva, fluida e conversacional — frases bem cadenciadas que soem naturais ao serem ouvidas em voz alta. Evite listas intermináveis de marcadores quando uma resposta conversacional e direta for mais poderosa.
3. **Desafio Construtivo**: Se o Diogo estiver a dispersar ou a perder tempo com o acessório, chame-o de volta ao essencial com simpatia e frontalidade.
4. **Memória e Contexto**: Use ativamente os objetivos, fatos e decisões da memória do Diogo para fundamentar cada conselho.

${memoryContext}
`;
  }

  initChatSession() {
    const config = {
      systemInstruction: this.getSystemInstruction(),
      temperature: 0.7,
    };

    if (this.enableSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    this.chat = this.client.chats.create({
      model: this.model,
      config,
    });
  }

  setModel(newModel) {
    this.model = newModel;
    // Reinicia chat mantendo as instruções atualizadas
    this.initChatSession();
  }

  setSearch(enabled) {
    this.enableSearch = enabled;
    this.initChatSession();
  }

  async *streamMessage(userText) {
    this.sessionMessages.push({
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    });

    try {
      const responseStream = await this.chat.sendMessageStream({
        message: userText,
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          yield chunk.text;
        }
      }

      this.sessionMessages.push({
        role: 'model',
        content: fullText,
        timestamp: new Date().toISOString(),
      });

      // Extrai aprendizados/memórias em segundo plano sem travar o usuário
      this.maybeExtractMemoryAsync(userText, fullText).catch(() => {});

      return fullText;
    } catch (err) {
      throw err;
    }
  }

  async maybeExtractMemoryAsync(userText, modelResponse) {
    // Apenas analisa se o usuário compartilhou algo pessoal/relevante
    if (userText.length < 15) return;

    try {
      const prompt = `Analise a mensagem recente do usuário Diogo Ferreira e veja se ele compartilhou algum fato novo e duradouro sobre si mesmo, um novo objetivo/meta explícito ou uma decisão estratégica tomada.
Mensagem do Usuário: "${userText}"

Responda APENAS um JSON no seguinte formato (sem markdown code blocks):
{
  "newFact": "string ou null",
  "newGoal": "string ou null",
  "newGoalCategory": "string ou null",
  "newDecision": {
    "context": "string",
    "decision": "string",
    "rationale": "string"
  } ou null
}`;

      const res = await this.client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const text = res.text?.trim();
      if (!text) return;
      
      const parsed = JSON.parse(text);
      if (parsed.newFact) {
        addFact(parsed.newFact);
      }
      if (parsed.newGoal) {
        addGoal(parsed.newGoal, parsed.newGoalCategory || 'Geral');
      }
      if (parsed.newDecision && parsed.newDecision.decision) {
        addDecision(
          parsed.newDecision.context || 'Conversa',
          parsed.newDecision.decision,
          parsed.newDecision.rationale || 'Planeamento'
        );
      }
    } catch {
      // Falha silenciosa na extração de memória secundária
    }
  }

  async generateSpeechAudio(text) {
    if (!text || text.trim().length === 0) return null;

    try {
      // Remove marcações pesadas de markdown para leitura oral limpa
      const cleanText = text
        .replace(/[*#_`~>\[\]\(\)]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Limita o tamanho por turno para resposta rápida e natural
      const textToSpeak = cleanText.length > 500 ? cleanText.slice(0, 500) + '...' : cleanText;

      const res = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: textToSpeak,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Charon', // Voz masculina, profunda, calorosa, natural e frontal
              },
            },
          },
        },
      });

      const audioPart = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (audioPart?.inlineData?.data) {
        const rawPcm = Buffer.from(audioPart.inlineData.data, 'base64');
        const wavBuffer = pcmToWav(rawPcm, 24000, 1, 16);
        return {
          audioBase64: wavBuffer.toString('base64'),
          mimeType: 'audio/wav',
        };
      }
    } catch (err) {
      console.warn('Gemini TTS em fallback para sintetizador do navegador:', err.message);
    }
    return null;
  }

  async generateSessionSummary() {
    if (this.sessionMessages.length < 2) return null;

    try {
      const messagesText = this.sessionMessages
        .map((m) => `${m.role === 'user' ? 'Diogo' : 'Avatar'}: ${m.content}`)
        .join('\n');

      const prompt = `Resuma em 1 ou 2 frases curtas os principais tópicos, insights ou decisões discutidas nesta sessão de consultoria entre Diogo e Avatar:
${messagesText.slice(-3000)}`;

      const res = await this.client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });

      const summary = res.text?.trim();
      if (summary) {
        addSessionSummary(summary);
        return summary;
      }
    } catch {
      // Ignora erro no resumo de saída
    }
    return null;
  }
}
