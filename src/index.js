import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { AvatarAgent } from './agent.js';
import { loadMemory } from './memory.js';
import { handleCommand } from './commands.js';
import {
  showBanner,
  showStatusBar,
  createSpinner,
  printUserPrompt,
  printAvatarHeader,
  printSystemMessage,
  printSuccessMessage,
  printErrorMessage,
  printDivider
} from './ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../.env');

// Carrega variáveis do arquivo .env
dotenv.config({ path: ENV_PATH });

async function promptForApiKey(rl) {
  return new Promise((resolve) => {
    console.log(chalk.yellow('\n⚠ Nenhuma GEMINI_API_KEY configurada.'));
    console.log(
      chalk.dim(
        'Obtenha sua chave gratuita em: ' +
          chalk.underline.blueBright('https://aistudio.google.com/app/apikey')
      )
    );
    rl.question(
      chalk.bold.cyan('Insira sua GEMINI_API_KEY: '),
      (key) => {
        resolve(key.trim());
      }
    );
  });
}

function saveApiKeyToEnv(apiKey) {
  try {
    fs.writeFileSync(ENV_PATH, `GEMINI_API_KEY=${apiKey}\n`, 'utf-8');
    printSuccessMessage('Chave de API salva com sucesso no arquivo .env!');
  } catch (err) {
    printErrorMessage(`Não foi possível salvar o arquivo .env: ${err.message}`);
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    showBanner();
    apiKey = await promptForApiKey(rl);
    if (!apiKey) {
      printErrorMessage('Chave de API não informada. Encerrando o Avatar.');
      rl.close();
      process.exit(1);
    }
    saveApiKeyToEnv(apiKey);
    process.env.GEMINI_API_KEY = apiKey;
  }

  // Inicializa o agente Avatar
  const memory = loadMemory();
  const agent = new AvatarAgent({
    apiKey,
    model: 'gemini-3.8-flash',
    enableSearch: false,
  });

  showBanner();
  showStatusBar(agent.model, {
    goalsCount: memory.goals.filter((g) => g.status === 'active').length,
    factsCount: memory.facts.length,
  });

  console.log(
    chalk.cyanBright('Avatar: ') +
      chalk.italic.white(
        'Olá Diogo. Estou pronto para atuar como seu consultor e conselheiro estratégico. Qual é o foco prioritário hoje?'
      ) +
      '\n'
  );

  let isProcessing = false;

  const askNext = () => {
    printUserPrompt();
  };

  const shutdown = async () => {
    console.log(chalk.cyan('\n\nA guardar memórias e a sintetizar sessão...'));
    const spinner = createSpinner('Criando síntese da sessão...');
    spinner.start();
    try {
      await agent.generateSessionSummary();
      spinner.succeed(chalk.green('Sessão sintetizada e memória guardada com sucesso!'));
    } catch {
      spinner.stop();
    }
    console.log(
      chalk.bold.hex('#7aa2f7')(
        '\nAté logo, Diogo. Seus objetivos e contexto estarão prontos para a nossa próxima conversa.\n'
      )
    );
    rl.close();
    process.exit(0);
  };

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      askNext();
      return;
    }

    if (input.toLowerCase() === '/sair' || input.toLowerCase() === '/exit') {
      await shutdown();
      return;
    }

    if (input.startsWith('/')) {
      await handleCommand(input, agent);
      askNext();
      return;
    }

    if (isProcessing) {
      printWarningMessage('Aguarde a resposta anterior ser concluída.');
      return;
    }

    isProcessing = true;
    const spinner = createSpinner('Avatar analisando e estruturando raciocínio...');
    spinner.start();

    let startedStream = false;

    try {
      for await (const chunk of agent.streamMessage(input)) {
        if (!startedStream) {
          spinner.stop();
          printAvatarHeader();
          startedStream = true;
        }
        process.stdout.write(chunk);
      }
      console.log('\n');
      printDivider();
    } catch (err) {
      spinner.stop();
      console.log();
      printErrorMessage(`Erro na comunicação com o Gemini: ${err.message}`);
      if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('403')) {
        printWarningMessage(
          'A sua chave de API parece inválida ou sem permissão. Verifique seu arquivo .env ou acesse https://aistudio.google.com/'
        );
      }
    } finally {
      isProcessing = false;
      askNext();
    }
  });

  rl.on('SIGINT', async () => {
    await shutdown();
  });

  askNext();
}

main().catch((err) => {
  console.error(chalk.red('Erro fatal na inicialização:'), err);
  process.exit(1);
});
