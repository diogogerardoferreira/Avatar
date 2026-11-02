import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AvatarAgent } from './agent.js';
import { loadMemory, addGoal, addFact, completeGoal } from './memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../.env');

dotenv.config({ path: ENV_PATH });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../public')));

let agent = null;

function getAgent() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!agent) {
    agent = new AvatarAgent({
      apiKey,
      model: 'gemini-3.8-flash',
      enableSearch: false,
    });
  }
  return agent;
}

// Rota de status e verificação de chave
app.get('/api/status', (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  res.json({
    ready: !!apiKey,
    avatarName: 'Ricardo',
    model: agent ? agent.model : (apiKey ? 'gemini-3.8-flash' : 'Conselheiro Autônomo'),
  });
});

// Salvar chave de API se ainda não existir e persistir em .env
app.post('/api/config/key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return res.status(400).json({ error: 'Chave inválida' });
  }
  const cleanKey = apiKey.trim();
  process.env.GEMINI_API_KEY = cleanKey;
  try {
    fs.writeFileSync(ENV_PATH, `GEMINI_API_KEY=${cleanKey}\n`, 'utf8');
  } catch (err) {
    console.warn('Aviso: Não foi possível gravar no arquivo .env:', err.message);
  }
  agent = null; // Reinicia agente com a nova chave
  res.json({ success: true });
});

// Obter memória persistente
app.get('/api/memory', (req, res) => {
  try {
    const memory = loadMemory();
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar meta
app.post('/api/memory/goal', (req, res) => {
  try {
    const { title, category } = req.body;
    if (!title) return res.status(400).json({ error: 'Título obrigatório' });
    const goal = addGoal(title, category || 'Geral');
    if (agent) agent.initChatSession();
    res.json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar fato
app.post('/api/memory/fact', (req, res) => {
  try {
    const { fact } = req.body;
    if (!fact) return res.status(400).json({ error: 'Fato obrigatório' });
    const facts = addFact(fact);
    if (agent) agent.initChatSession();
    res.json({ success: true, facts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Concluir meta
app.post('/api/memory/goal/complete', (req, res) => {
  try {
    const { id } = req.body;
    const completed = completeGoal(id);
    if (agent) agent.initChatSession();
    res.json({ success: true, completed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function generateDirectMentorAdvice(message, memory) {
  const lower = (message || '').toLowerCase();

  if (lower.includes('80/20') || lower.includes('maior impacto') || lower.includes('foco de hoje') || lower.includes('energia hoje') || lower.includes('prioridade')) {
    const activeGoal = memory.goals?.find((g) => g.status === 'active')?.title || 'Estruturar e automatizar fluxos de trabalho com IA';
    return `Diogo, vou ser frontal contigo, olho no olho.

O teu maior risco hoje não é falta de capacidade; é dispersão em micro-tarefas que dão apenas uma falsa sensação de produtividade.

A tua prioridade 80/20 é uma só: focar na tua meta principal — "${activeGoal}".

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
    const goals = memory.goals?.filter((g) => g.status === 'active') || [];
    const goalsList = goals.length > 0
      ? goals.map((g) => `• **${g.title}** (${g.category})`).join('\n')
      : '• Nenhuma meta ativa cadastrada no momento.';

    return `Aqui está o raio-X das tuas metas ativas, Diogo:\n\n${goalsList}\n\nOlha para isto com frieza: uma meta sem disciplina diária é apenas uma boa intenção. Qual destas metas teve um avanço mensurável nas últimas 48 horas? Se foi nenhuma, vamos simplificar o teu foco agora mesmo.`;
  }

  return `Diogo, ouvi-te com toda a atenção e estou aqui contigo, olhos nos olhos.

Sobre "${message}": a minha resposta é direta e sem filtros. Não procures atalhos onde precisas de disciplina de primeiros princípios. Como estrategista e desenvolvedor, sabes que clareza precede a velocidade.

Diz-me com franqueza: qual é o resultado mensurável e prático que queres alcançar aqui, e qual é a primeira ação que podes executar hoje?`;
}

// Conversa principal com Ricardo (streaming ou json)
app.post('/api/chat', async (req, res) => {
  const { message, withAudio = true } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Mensagem vazia' });
  }

  const memory = loadMemory();

  try {
    const ag = getAgent();
    let fullResponse = '';
    let audioData = null;

    if (ag) {
      try {
        for await (const chunk of ag.streamMessage(message)) {
          fullResponse += chunk;
        }

        if (withAudio) {
          try {
            audioData = await ag.generateSpeechAudio(fullResponse);
          } catch (audioErr) {
            console.warn('Gemini TTS não retornou áudio, usando sintetizador local:', audioErr.message);
          }
        }
      } catch (geminiErr) {
        console.warn('Erro na chamada ao Gemini, usando consultor autónomo:', geminiErr.message);
        fullResponse = generateDirectMentorAdvice(message, memory);
      }
    } else {
      // Sem chave configurada: usa o motor de consultoria direta de Ricardo
      fullResponse = generateDirectMentorAdvice(message, memory);
    }

    res.json({
      text: fullResponse,
      audio: audioData ? audioData.audioBase64 : null,
      mimeType: audioData ? audioData.mimeType : null,
    });
  } catch (err) {
    console.error('Erro no /api/chat:', err);
    const fallbackText = generateDirectMentorAdvice(message, memory);
    res.json({
      text: fallbackText,
      audio: null,
      mimeType: null,
    });
  }
});

// Endpoint dedicado para geração de voz com Ricardo
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Texto obrigatório' });
  }

  try {
    const ag = getAgent();
    const audioData = await ag.generateSpeechAudio(text);
    if (!audioData) {
      return res.status(503).json({ error: 'Gemini TTS não retornou áudio' });
    }
    res.json(audioData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n⚡ O Santuário de Ricardo está online em: http://localhost:${PORT}`);
  console.log(`Pressione Ctrl+C para encerrar o servidor.\n`);
});
