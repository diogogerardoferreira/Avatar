import chalk from 'chalk';
import {
  loadMemory,
  addGoal,
  completeGoal,
  addFact,
  removeFact,
  exportSessionToMarkdown
} from './memory.js';
import {
  printSystemMessage,
  printSuccessMessage,
  printWarningMessage,
  printDivider,
  showBanner,
  showStatusBar
} from './ui.js';

export async function handleCommand(cmdLine, agent) {
  const parts = cmdLine.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ').trim();

  switch (command) {
    case '/ajuda':
    case '/help':
      printHelpMenu();
      return true;

    case '/memoria':
    case '/memory':
      displayMemoryDetails();
      return true;

    case '/meta':
    case '/addgoal':
      if (!args) {
        printWarningMessage('Uso: /meta <descrição da sua meta>');
        return true;
      }
      const newGoal = addGoal(args);
      printSuccessMessage(`Meta adicionada com sucesso: "${newGoal.title}"`);
      agent.initChatSession(); // Atualiza o prompt do agente com a nova meta
      return true;

    case '/concluirmeta':
      if (!args || isNaN(parseInt(args, 10))) {
        printWarningMessage('Uso: /concluirmeta <número da meta>');
        return true;
      }
      const idx = parseInt(args, 10) - 1;
      const mem = loadMemory();
      const activeGoals = mem.goals.filter((g) => g.status === 'active');
      if (idx >= 0 && idx < activeGoals.length) {
        completeGoal(activeGoals[idx].id);
        printSuccessMessage(`Meta concluída: "${activeGoals[idx].title}"! 🎉`);
        agent.initChatSession();
      } else {
        printWarningMessage(`Índice de meta inválido. Veja suas metas com /memoria.`);
      }
      return true;

    case '/fato':
    case '/addfact':
      if (!args) {
        printWarningMessage('Uso: /fato <novo fato ou informação sobre você>');
        return true;
      }
      addFact(args);
      printSuccessMessage(`Novo fato guardado na memória: "${args}"`);
      agent.initChatSession();
      return true;

    case '/removerfato':
      if (!args || isNaN(parseInt(args, 10))) {
        printWarningMessage('Uso: /removerfato <número do fato>');
        return true;
      }
      const fIdx = parseInt(args, 10) - 1;
      const removed = removeFact(fIdx);
      if (removed) {
        printSuccessMessage(`Fato removido: "${removed}"`);
        agent.initChatSession();
      } else {
        printWarningMessage(`Fato não encontrado.`);
      }
      return true;

    case '/modelo':
    case '/model':
      if (!args) {
        console.log(
          chalk.cyan(`Modelo atual: `) + chalk.bold.yellow(agent.model)
        );
        console.log(
          chalk.dim('Disponíveis: gemini-3.8-flash, gemini-4-argon, gemini-3.5-flash-lite')
        );
        return true;
      }
      agent.setModel(args);
      printSuccessMessage(`Modelo alterado para: ${agent.model}`);
      return true;

    case '/pesquisa':
    case '/search':
      if (args === 'on' || args === 'ativar' || args === '1') {
        agent.setSearch(true);
        printSuccessMessage('Pesquisa na Web (Google Search Grounding) ATIVADA.');
      } else if (args === 'off' || args === 'desativar' || args === '0') {
        agent.setSearch(false);
        printSuccessMessage('Pesquisa na Web DESATIVADA.');
      } else {
        console.log(
          `Pesquisa na web atual: ` +
            (agent.enableSearch
              ? chalk.green('Ativada')
              : chalk.gray('Desativada')) +
            chalk.dim(' (Use: /pesquisa on ou /pesquisa off)')
        );
      }
      return true;

    case '/limpar':
    case '/clear':
      showBanner();
      const currentMem = loadMemory();
      showStatusBar(agent.model, {
        goalsCount: currentMem.goals.filter((g) => g.status === 'active').length,
        factsCount: currentMem.facts.length,
      });
      return true;

    case '/exportar':
    case '/export':
      if (agent.sessionMessages.length === 0) {
        printWarningMessage('Ainda não há mensagens nesta sessão para exportar.');
        return true;
      }
      const file = exportSessionToMarkdown(agent.sessionMessages);
      printSuccessMessage(`Sessão exportada com sucesso para:\n  ${chalk.cyan(file)}`);
      return true;

    default:
      if (cmdLine.startsWith('/')) {
        printWarningMessage(`Comando desconhecido: "${command}". Digite /ajuda para ver as opções.`);
        return true;
      }
      return false;
  }
}

function printHelpMenu() {
  console.log(chalk.bold.cyanBright('\n  📋 COMANDOS DISPONÍVEIS NO AVATAR\n'));
  const commands = [
    { cmd: '/ajuda, /help', desc: 'Exibe este menu de ajuda com todos os comandos' },
    { cmd: '/memoria, /memory', desc: 'Visualiza seu perfil, metas, fatos e decisões guardadas' },
    { cmd: '/meta <texto>', desc: 'Cadastra uma nova meta na sua memória pessoal' },
    { cmd: '/concluirmeta <nº>', desc: 'Marca a meta número <nº> como concluída' },
    { cmd: '/fato <texto>', desc: 'Guarda um novo fato ou preferência na memória' },
    { cmd: '/removerfato <nº>', desc: 'Remove um fato específico da memória' },
    { cmd: '/modelo [nome]', desc: 'Ver ou trocar o modelo (ex: gemini-3.8-flash, gemini-4-argon)' },
    { cmd: '/pesquisa [on|off]', desc: 'Ativa ou desativa busca no Google Search em tempo real' },
    { cmd: '/exportar', desc: 'Exporta a conversa atual para um documento Markdown' },
    { cmd: '/limpar, /clear', desc: 'Limpa o ecrã do terminal' },
    { cmd: '/sair, /exit', desc: 'Salva o resumo da conversa e encerra a sessão' },
  ];

  for (const c of commands) {
    console.log(
      `  ${chalk.bold.yellow(c.cmd.padEnd(22))} ${chalk.white(c.desc)}`
    );
  }
  console.log();
}

function displayMemoryDetails() {
  const mem = loadMemory();
  console.log(chalk.bold.magentaBright('\n  🧠 MEMÓRIA PERSISTENTE DO AVATAR\n'));

  console.log(chalk.bold.cyan('  [ Perfil ]'));
  console.log(`  Nome: ${chalk.bold.white(mem.profile.name)}`);
  console.log(`  Área: ${chalk.white(mem.profile.role)}`);
  console.log(`  Estilo de Consultoria: ${chalk.white(mem.profile.communicationStyle)}`);
  
  if (mem.profile.coreValues?.length) {
    console.log(chalk.dim('  Valores: ') + mem.profile.coreValues.join(' • '));
  }

  const activeGoals = mem.goals.filter((g) => g.status === 'active');
  console.log(chalk.bold.cyan('\n  [ Metas Ativas ]'));
  if (activeGoals.length === 0) {
    console.log(chalk.dim('  Nenhuma meta ativa no momento. Adicione com /meta <texto>'));
  } else {
    activeGoals.forEach((g, i) => {
      console.log(
        `  ${chalk.yellow(`[${i + 1}]`)} ${chalk.bold.white(g.title)} ${chalk.dim(`(${g.category || 'Geral'})`)}`
      );
    });
  }

  console.log(chalk.bold.cyan('\n  [ Fatos & Contexto Conhecido ]'));
  if (mem.facts.length === 0) {
    console.log(chalk.dim('  Nenhum fato extra gravado. Adicione com /fato <texto>'));
  } else {
    mem.facts.forEach((f, i) => {
      console.log(`  ${chalk.gray(`[${i + 1}]`)} ${f}`);
    });
  }

  if (mem.decisions?.length > 0) {
    console.log(chalk.bold.cyan('\n  [ Decisões Estratégicas Registadas ]'));
    mem.decisions.slice(-3).forEach((d) => {
      console.log(
        `  • ${chalk.dim(`[${d.date}]`)} ${chalk.white(d.decision)} ${chalk.dim(`(${d.context})`)}`
      );
    });
  }

  console.log();
  printDivider();
}
