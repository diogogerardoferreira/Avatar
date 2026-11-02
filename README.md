# ⚡ Avatar - Assistente, Conselheiro e Consultor Estratégico com Gemini

O **Avatar** é um agente de inteligência artificial pessoal projetado para atuar como o seu **conselheiro pessoal, consultor estratégico e mentor executivo**.

Desenvolvido para ser executado diretamente no terminal com respostas em **streaming em tempo real**, interface visual elegante e um sistema de **memória persistente** que lembra das suas metas, decisões, contexto pessoal e histórico de conversas anteriores.

---

## 🌟 Funcionalidades Principais

- **🧠 Memória Persistente**: Lembra de quem é você (Diogo), quais são suas metas ativas, valores, histórico de decisões estratégicas e fatos importantes aprendidos com o tempo.
- **⚡ Modelo de Ponta (Gemini 3.8 Flash & Gemini 4 Argon)**: Utiliza a versão mais recente da API oficial `@google/genai` com streaming contínuo.
- **🎯 Postura Consultiva de Alto Nível**: Pensamento analítico baseado em primeiros princípios, método socrático para desempatar dilemas complexos e priorização pragmática (regra 80/20).
- **🔎 Google Search Grounding Opcional**: Possibilidade de ativar pesquisa no Google em tempo real (`/pesquisa on`).
- **📝 Exportação em Markdown**: Exporte a ata ou plano de ação de qualquer conversa para arquivos `.md` com o comando `/exportar`.
- **💻 Interface Rica de Terminal**: Cores vibrantes, animações de processamento, renderização de tabelas e blocos de código com formatação impecável.

---

## 🚀 Como Executar

### 1. Iniciar o Avatar

Basta rodar o comando no diretório do projeto:

```bash
npm start
```

> **Primeira Execução:** Se você ainda não configurou uma chave, o próprio Avatar solicitará que você cole a sua `GEMINI_API_KEY` diretamente no terminal e a salvará automaticamente em um arquivo `.env` seguro.

Para obter a sua chave de API gratuitamente:
👉 [Google AI Studio - Obter API Key](https://aistudio.google.com/app/apikey)

---

## 📋 Comandos Disponíveis na CLI

Você pode digitar mensagens normalmente ou usar os seguintes comandos com `/`:

| Comando | Descrição |
| :--- | :--- |
| `/ajuda` ou `/help` | Mostra a lista completa de comandos |
| `/memoria` ou `/memory` | Exibe tudo o que o Avatar sabe sobre você (perfil, metas, fatos e decisões) |
| `/meta <texto>` | Adiciona uma nova meta ou foco prioritário na memória |
| `/concluirmeta <nº>` | Marca uma meta como concluída com sucesso |
| `/fato <texto>` | Adiciona um fato, preferência ou detalhe pessoal à memória |
| `/removerfato <nº>` | Remove um fato desatualizado da memória |
| `/modelo [nome]` | Alterna entre modelos (ex: `gemini-3.8-flash`, `gemini-4-argon`) |
| `/pesquisa [on\|off]` | Ativa ou desativa a busca na Web via Google Search |
| `/exportar` | Salva a conversa atual em um arquivo Markdown formatado em `data/history/` |
| `/limpar` ou `/clear` | Limpa a tela do terminal mantendo o contexto ativo |
| `/sair` ou `/exit` | Salva o resumo da sessão na memória e encerra |

---

## 📁 Estrutura do Projeto

```text
Avatar/
├── .env                  # Chave de API (gerado automaticamente ou manual)
├── .env.example          # Modelo de variáveis de ambiente
├── package.json          # Dependências e scripts
├── README.md             # Documentação e instruções de uso
├── src/
│   ├── index.js          # Ponto de entrada CLI e loop interativo
│   ├── agent.js          # Núcleo do agente Gemini e injeção de contexto
│   ├── memory.js         # Gerenciador de memória persistente
│   ├── commands.js       # Tratamento de comandos de barra (slash commands)
│   └── ui.js             # Formatação visual, banners e renderização de Markdown
└── data/
    ├── memory.json       # Base de memória persistente (perfil, metas, fatos)
    └── history/          # Histórico de sessões salvas e exportações em Markdown
```

---

## 🛠️ Personalização da Memória

Você pode abrir e editar diretamente o arquivo [`data/memory.json`](file:///c:/Users/DiogoFerreira/Desktop/Diogo/Avatar/data/memory.json) a qualquer momento para personalizar seu perfil, objetivos de carreira, estilo de consultoria ou princípios centrais.
