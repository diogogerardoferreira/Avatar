import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

// Estrutura padrão inicial da memória
const DEFAULT_MEMORY = {
  profile: {
    name: 'Diogo Ferreira',
    role: 'Desenvolvedor & Estrategista',
    bio: 'Profissional focado em inovação, tecnologia, inteligência artificial e resolução de problemas complexos.',
    communicationStyle: 'Direto, analítico, desafiador e focado em planos práticos e de alto impacto.',
    coreValues: [
      'Execução rápida com qualidade',
      'Aprendizado contínuo e autonomia',
      'Pensamento de primeiros princípios',
      'Foco em resultados mensuráveis (80/20)'
    ]
  },
  goals: [
    {
      id: 'goal-1',
      title: 'Estruturar e automatizar fluxos de trabalho com IA',
      category: 'Tecnologia / Produtividade',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  ],
  facts: [
    'Utiliza ambiente Windows com Node.js e ecossistema moderno.',
    'Prefere respostas estruturadas com passos práticos e sem enrolação.'
  ],
  decisions: [],
  sessionSummaries: []
};

// Garante que os diretórios necessários existem
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

export function loadMemory() {
  ensureDirectories();
  if (!fs.existsSync(MEMORY_FILE)) {
    saveMemory(DEFAULT_MEMORY);
    return DEFAULT_MEMORY;
  }

  try {
    const raw = fs.readFileSync(MEMORY_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return { ...DEFAULT_MEMORY, ...data };
  } catch (err) {
    console.error('Erro ao ler memory.json, restaurando padrões:', err.message);
    return DEFAULT_MEMORY;
  }
}

export function saveMemory(memoryData) {
  ensureDirectories();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoryData, null, 2), 'utf-8');
}

export function addGoal(title, category = 'Geral') {
  const memory = loadMemory();
  const newGoal = {
    id: `goal-${Date.now()}`,
    title,
    category,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  memory.goals.push(newGoal);
  saveMemory(memory);
  return newGoal;
}

export function completeGoal(idOrIndex) {
  const memory = loadMemory();
  if (typeof idOrIndex === 'number' && memory.goals[idOrIndex]) {
    memory.goals[idOrIndex].status = 'completed';
    saveMemory(memory);
    return memory.goals[idOrIndex];
  }
  const goal = memory.goals.find((g) => g.id === idOrIndex);
  if (goal) {
    goal.status = 'completed';
    saveMemory(memory);
    return goal;
  }
  return null;
}

export function addFact(fact) {
  const memory = loadMemory();
  if (!memory.facts.includes(fact)) {
    memory.facts.push(fact);
    saveMemory(memory);
  }
  return memory.facts;
}

export function removeFact(index) {
  const memory = loadMemory();
  if (index >= 0 && index < memory.facts.length) {
    const removed = memory.facts.splice(index, 1);
    saveMemory(memory);
    return removed[0];
  }
  return null;
}

export function addDecision(context, decision, rationale) {
  const memory = loadMemory();
  const entry = {
    date: new Date().toISOString().split('T')[0],
    context,
    decision,
    rationale
  };
  memory.decisions.push(entry);
  saveMemory(memory);
  return entry;
}

export function addSessionSummary(summary) {
  const memory = loadMemory();
  memory.sessionSummaries.push({
    date: new Date().toISOString(),
    summary
  });
  // Manter apenas os últimos 15 resumos de sessão para não poluir
  if (memory.sessionSummaries.length > 15) {
    memory.sessionSummaries = memory.sessionSummaries.slice(-15);
  }
  saveMemory(memory);
}

// Gera o contexto estruturado em Markdown para injeção no prompt de sistema
export function getMemoryContextString() {
  const memory = loadMemory();
  const activeGoals = memory.goals.filter((g) => g.status === 'active');
  const completedGoals = memory.goals.filter((g) => g.status === 'completed');

  let text = `\n--- [MEMÓRIA PERSISTENTE E PERFIL DO USUÁRIO] ---\n`;
  text += `Nome: ${memory.profile.name}\n`;
  text += `Papel/Área: ${memory.profile.role}\n`;
  text += `Estilo de Comunicação Preferido: ${memory.profile.communicationStyle}\n`;
  
  if (memory.profile.coreValues?.length) {
    text += `Princípios & Valores Centrais:\n`;
    memory.profile.coreValues.forEach((v) => {
      text += `  • ${v}\n`;
    });
  }

  text += `\nMetas Ativas:\n`;
  if (activeGoals.length === 0) {
    text += `  (Nenhuma meta ativa cadastrada)\n`;
  } else {
    activeGoals.forEach((g, idx) => {
      text += `  ${idx + 1}. [${g.category}] ${g.title}\n`;
    });
  }

  if (completedGoals.length > 0) {
    text += `\nMetas Concluídas Recentemente: ${completedGoals.length}\n`;
  }

  text += `\nFatos & Contexto Importante sobre o Diogo:\n`;
  if (memory.facts.length === 0) {
    text += `  (Nenhum fato extra registrado ainda)\n`;
  } else {
    memory.facts.forEach((f) => {
      text += `  • ${f}\n`;
    });
  }

  if (memory.decisions.length > 0) {
    text += `\nDecisões Estratégicas Anteriores:\n`;
    memory.decisions.slice(-5).forEach((d) => {
      text += `  • [${d.date}] Contexto: "${d.context}" => Decisão: "${d.decision}" (Razão: ${d.rationale})\n`;
    });
  }

  if (memory.sessionSummaries.length > 0) {
    text += `\nResumos de Conversas Anteriores:\n`;
    memory.sessionSummaries.slice(-3).forEach((s) => {
      text += `  • [${s.date.split('T')[0]}]: ${s.summary}\n`;
    });
  }

  text += `--- [FIM DA MEMÓRIA PERSISTENTE] ---\n`;
  return text;
}

export function exportSessionToMarkdown(messages) {
  ensureDirectories();
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(HISTORY_DIR, `sessao-${dateStr}.md`);
  
  let md = `# Sessão de Consultoria - Avatar & Diogo Ferreira\n`;
  md += `Data: ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;

  for (const m of messages) {
    if (m.role === 'user') {
      md += `### 👤 Diogo Ferreira\n\n${m.content}\n\n`;
    } else if (m.role === 'model') {
      md += `### ⚡ Avatar (Conselheiro)\n\n${m.content}\n\n---\n\n`;
    }
  }

  fs.writeFileSync(filename, md, 'utf-8');
  return filename;
}
