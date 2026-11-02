import chalk from 'chalk';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import ora from 'ora';

// Configuração do renderizador de Markdown no terminal
marked.use(
  markedTerminal({
    width: 90,
    reflowText: true,
    showListNumbers: true,
    tab: 2,
    heading: chalk.bold.cyanBright,
    firstHeading: chalk.bold.magentaBright.underline,
    secondHeading: chalk.bold.cyan,
    strong: chalk.bold.yellowBright,
    em: chalk.italic.whiteBright,
    codespan: chalk.bgHex('#1f2430').hex('#ffcc66').bold,
    blockquote: chalk.dim.italic.gray,
    link: chalk.blueBright.underline,
    listitem: chalk.white,
  })
);

export function renderMarkdown(text) {
  try {
    return marked(text);
  } catch {
    return text;
  }
}

export function showBanner() {
  console.clear();
  const bannerText = `
   █████╗ ██╗   ██╗ █████╗ ████████╗ █████╗ ██████╗ 
  ██╔══██╗██║   ██║██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗
  ███████║██║   ██║███████║   ██║   ███████║██████╔╝
  ██╔══██║╚██╗ ██╔╝██╔══██║   ██║   ██╔══██║██╔══██╗
  ██║  ██║ ╚████╔╝ ██║  ██║   ██║   ██║  ██║██║  ██║
  ╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝
`;
  console.log(chalk.cyan(bannerText));
  console.log(
    chalk.bold.hex('#7aa2f7')(
      '  ⚡ SEU ASSISTENTE, CONSELHEIRO E CONSULTOR ESTRATÉGICO PESSOAL ⚡'
    )
  );
  console.log(
    chalk.gray(
      '  Alimentado por Google Gemini • Memória Persistente Ativa\n'
    )
  );
}

export function showStatusBar(model, memoryStats) {
  const modelTag = chalk.bgCyan.black.bold(` MODELO: ${model} `);
  const memoryTag = chalk.bgMagenta.black.bold(
    ` METAS: ${memoryStats.goalsCount} `
  );
  const factsTag = chalk.bgBlue.black.bold(
    ` FATOS NA MEMÓRIA: ${memoryStats.factsCount} `
  );

  console.log(
    chalk.gray('┌──────────────────────────────────────────────────────────────┐')
  );
  console.log(`  ${modelTag}  ${memoryTag}  ${factsTag}`);
  console.log(
    chalk.gray('└──────────────────────────────────────────────────────────────┘')
  );
  console.log(
    chalk.dim(
      '  Digite sua mensagem normalmente ou use comandos como ' +
        chalk.yellow('/ajuda') +
        ', ' +
        chalk.yellow('/memoria') +
        ', ' +
        chalk.yellow('/meta') +
        ', ' +
        chalk.yellow('/sair') +
        '.\n'
    )
  );
}

export function createSpinner(text = 'Avatar analisando e estruturando raciocínio...') {
  return ora({
    text: chalk.italic.cyan(text),
    spinner: 'dots12',
    color: 'cyan',
  });
}

export function printUserPrompt() {
  process.stdout.write(chalk.bold.greenBright('Diogo ❯ '));
}

export function printAvatarHeader() {
  console.log(chalk.bold.cyanBright('\nAvatar ❯'));
}

export function printSystemMessage(msg) {
  console.log(chalk.dim.italic.blueBright(`ℹ ${msg}`));
}

export function printSuccessMessage(msg) {
  console.log(chalk.greenBright(`✔ ${msg}`));
}

export function printWarningMessage(msg) {
  console.log(chalk.yellowBright(`⚠ ${msg}`));
}

export function printErrorMessage(msg) {
  console.log(chalk.redBright(`✖ ${msg}`));
}

export function printDivider() {
  console.log(chalk.gray('─'.repeat(70)));
}
