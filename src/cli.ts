#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { version } = require('../package.json');
import { readFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { select, checkbox, confirm } from '@inquirer/prompts';
import { fromUrl, fromFile, type ExtractedTool } from './swagger-converter.js';
import { McpGenerator, type GeneratorOptions } from './mcp-generator.js';
import { PythonGenerator } from './python-generator.js';

interface ServiceEntry {
  name: string;
  url?:  string;
  file?: string;
}

interface ServicesConfig {
  baseUrl?: string;
  services: ServiceEntry[];
}

// ── Banner ───────────────────────────────────────────────────────────────────

function printBanner() {
  // Purple → violet gradient across the 6 rows
  const colors = ['#9333EA', '#8B31E0', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95'];
  const art = [
    '░█████╗░░██████╗░███████╗███╗░░██╗████████╗██╗███████╗██╗░░░██╗',
    '██╔══██╗██╔════╝░██╔════╝████╗░██║╚══██╔══╝██║██╔════╝╚██╗░██╔╝',
    '███████║██║░░██╗░█████╗░░██╔██╗██║░░░██║░░░██║█████╗░░░╚████╔╝░',
    '██╔══██║██║░░╚██╗██╔══╝░░██║╚████║░░░██║░░░██║██╔══╝░░░░╚██╔╝░░',
    '██║░░██║╚██████╔╝███████╗██║░╚███║░░░██║░░░██║██║░░░░░░░░██║░░░',
    '╚═╝░░╚═╝░╚═════╝░╚══════╝╚═╝░░╚══╝░░░╚═╝░░░╚═╝╚═╝░░░░░░░░╚═╝░░░',
  ];

  console.log();
  art.forEach((line, i) => console.log(chalk.hex(colors[i])(line)));
  console.log();
  console.log(
    chalk.bold.white('  Turn any microservice into an MCP tool') +
    chalk.gray(' — instantly.')
  );
  console.log(
    chalk.gray(`  v${version}`) +
    chalk.gray('  ·  ') +
    chalk.cyan('npm: @skyaque/agentify') +
    chalk.gray('  ·  ') +
    chalk.gray('by ') +
    chalk.hex('#7C3AED')('skyaque')
  );
  console.log();
}

// ── Help ─────────────────────────────────────────────────────────────────────

function printHelp() {
  printBanner();
  console.log(chalk.bold('Usage:\n'));
  console.log(
    '  ' + chalk.cyan('npx @skyaque/agentify') + ' ' +
    chalk.yellow('generate') + ' ' +
    chalk.gray('--services <file> [options]\n')
  );
  console.log(chalk.bold('  Interactive mode (no flags needed):\n'));
  console.log(
    '  ' + chalk.cyan('npx @skyaque/agentify') + ' ' +
    chalk.yellow('generate') + ' ' +
    chalk.gray('--services services.yaml') + '\n'
  );

  const opts: [string, string, string][] = [
    ['--services <file>', 'Path to services.yaml',           'services.yaml'],
    ['--out <dir>',       'Output directory',                'generated'],
    ['--lang <lang>',     'Output language (skip prompts)',  'typescript | python'],
    ['--read-only',       'GET/HEAD tools only (skip prompt)', ''],
    ['--all-tools',       'Use all tools (skip tool picker)', ''],
    ['--auth-basic <t>',  'Inject Basic auth header',        ''],
    ['--apikey <t>',      'Inject apikey header',            ''],
  ];
  for (const [flag, desc, def] of opts) {
    console.log(
      '  ' + chalk.green(flag.padEnd(22)) +
      chalk.white(desc.padEnd(36)) +
      (def ? chalk.gray(`(default: ${def})`) : '')
    );
  }
  console.log();
}

// ── Fetch specs ───────────────────────────────────────────────────────────────

async function fetchAllTools(config: ServicesConfig, readOnly: boolean): Promise<ExtractedTool[]> {
  const allTools: ExtractedTool[] = [];

  for (const svc of config.services) {
    const spinner = ora({
      text:    chalk.gray('Fetching ') + chalk.cyan(svc.name) + chalk.gray(' …'),
      spinner: 'dots',
      color:   'cyan',
    }).start();

    try {
      let tools: ExtractedTool[];
      if (svc.file) {
        const filePath = resolve(svc.file);
        tools = await fromFile(filePath, svc.name, readOnly);
        spinner.succeed(chalk.cyan(svc.name) + chalk.gray(` ← file:${svc.file}  `) + chalk.bold.green(`${tools.length} tools`));
      } else if (svc.url) {
        const url = svc.url.startsWith('http') ? svc.url : `${config.baseUrl ?? ''}${svc.url}`;
        tools = await fromUrl(url, svc.name, readOnly);
        spinner.succeed(chalk.cyan(svc.name) + chalk.gray(` ← ${url}  `) + chalk.bold.green(`${tools.length} tools`));
      } else {
        spinner.warn(chalk.yellow(`${svc.name} — skipped (no url or file)`));
        continue;
      }
      allTools.push(...tools);
    } catch (err: any) {
      spinner.fail(chalk.cyan(svc.name) + chalk.red(' — failed: ') + chalk.gray(err.message));
    }
  }

  return allTools;
}

// ── Interactive prompts ───────────────────────────────────────────────────────

async function runInteractive(
  allTools: ExtractedTool[],
  langFlag?: string,
  readOnlyFlag?: boolean,
  allToolsFlag?: boolean,
): Promise<{ lang: 'typescript' | 'python'; selectedTools: ExtractedTool[]; readOnly: boolean }> {

  console.log(chalk.bold.hex('#7C3AED')('\n  ✦ Interactive Setup\n'));

  // 1. Language
  let lang: 'typescript' | 'python';
  if (langFlag === 'typescript' || langFlag === 'python') {
    lang = langFlag;
    console.log(chalk.gray('  Language:') + '  ' + chalk.cyan(lang) + chalk.gray(' (from --lang flag)'));
  } else {
    lang = await select({
      message: 'Output language:',
      choices: [
        {
          name:  chalk.cyan('TypeScript') + chalk.gray('  — server.ts + tools.ts + Zod schemas (Node.js)'),
          value: 'typescript' as const,
          short: 'TypeScript',
        },
        {
          name:  chalk.cyan('Python') + chalk.gray('     — server.py with async httpx calls (stdio + SSE)'),
          value: 'python' as const,
          short: 'Python',
        },
      ],
    });
  }

  // 2. Read-only mode
  let readOnly: boolean;
  if (readOnlyFlag !== undefined) {
    readOnly = readOnlyFlag;
    console.log(chalk.gray('  Mode:') + '      ' + (readOnly ? chalk.yellow('read-only') : chalk.green('full')) + chalk.gray(' (from --read-only flag)'));
  } else {
    readOnly = await select({
      message: 'Generation mode:',
      choices: [
        {
          name:  chalk.green('Full') + chalk.gray('       — include all HTTP methods (GET, POST, PUT, PATCH, DELETE)'),
          value: false,
          short: 'Full',
        },
        {
          name:  chalk.yellow('Read-only') + chalk.gray('  — GET and HEAD only (safe for analytics / monitoring agents)'),
          value: true,
          short: 'Read-only',
        },
      ],
    });
  }

  // 3. Tool selection
  let selectedTools: ExtractedTool[];
  if (allToolsFlag) {
    selectedTools = allTools;
    console.log(chalk.gray(`  Tools:`) + '      ' + chalk.green(`all ${allTools.length} tools`) + chalk.gray(' (from --all-tools flag)'));
  } else {
    console.log(chalk.bold(`\n  ${allTools.length} tools available — select which to include:\n`));

    const choices = allTools.map(t => ({
      name:    chalk.cyan(t.name) + chalk.gray(`  [${t.httpMethod}] `) + chalk.white(t.description.slice(0, 60) + (t.description.length > 60 ? '…' : '')),
      value:   t,
      checked: true,  // all selected by default
      short:   t.name,
    }));

    selectedTools = await checkbox({
      message: 'Select tools to generate (Space to toggle, A to toggle all, Enter to confirm):',
      choices,
      pageSize: 15,
      loop: false,
    });

    if (selectedTools.length === 0) {
      console.log(chalk.red('\n  ✖ No tools selected. Exiting.'));
      process.exit(0);
    }
  }

  console.log();
  return { lang, selectedTools, readOnly };
}

// ── Generate files ────────────────────────────────────────────────────────────

async function runGenerate(
  tools: ExtractedTool[],
  lang: 'typescript' | 'python',
  outDir: string,
  opts: GeneratorOptions
): Promise<void> {
  const spinner = ora({
    text:    chalk.gray(`Generating ${lang} MCP server (${tools.length} tools) …`),
    spinner: 'bouncingBar',
    color:   'magenta',
  }).start();

  const absOut = resolve(outDir);
  try {
    if (lang === 'python') {
      await new PythonGenerator(absOut, opts).generate(tools);
    } else {
      await new McpGenerator(absOut, opts).generate(tools);
    }
    spinner.succeed(chalk.bold.green('Generated → ') + chalk.white(absOut));
  } catch (err: any) {
    spinner.fail(chalk.red('Generation failed: ') + err.message);
    process.exit(1);
  }
}

// ── Summary + next steps ──────────────────────────────────────────────────────

function printSummary(tools: ExtractedTool[], lang: string, outDir: string) {
  const services = [...new Set(tools.map(t => t.service))];
  const toolLines = services.map(svc => {
    const count = tools.filter(t => t.service === svc).length;
    return `  ${chalk.cyan('●')} ${chalk.white(svc)}  ${chalk.gray(`(${count} tools)`)}`;
  });

  console.log(boxen(
    [
      chalk.bold.green('✔ Done!'),
      '',
      chalk.gray(`  ${services.length} service(s) · ${tools.length} tools · ${lang}`),
      '',
      ...toolLines,
    ].join('\n'),
    {
      padding:     { top: 0, bottom: 0, left: 1, right: 3 },
      margin:      { top: 1, bottom: 0, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'green',
    }
  ));

  const absOut = resolve(outDir);
  console.log(chalk.bold('\nNext steps:\n'));
  if (lang === 'python') {
    console.log(`  ${chalk.gray('1.')} ${chalk.cyan('cd')} ${outDir}`);
    console.log(`  ${chalk.gray('2.')} ${chalk.cyan('pip install -r requirements.txt')}`);
    console.log(`  ${chalk.gray('3.')} ${chalk.cyan('AGENTIFY_BASE_URL=http://your-api:8080 python server.py')}`);
    console.log(`     ${chalk.gray('# Cloud Run: PORT=8080 AGENTIFY_BASE_URL=https://your-api.com python server.py')}`);
  } else {
    console.log(`  ${chalk.gray('1.')} ${chalk.cyan(`cd ${outDir} && npm install`)}`);
    console.log(`  ${chalk.gray('2.')} ${chalk.cyan('AGENTIFY_BASE_URL=http://your-api:8080 npm run mcp')}`);
  }

  console.log(chalk.bold('\nConnect to Claude Code — add to .mcp.json:\n'));
  const mcpJson = lang === 'python'
    ? `  { "mcpServers": { "agentify": { "command": "python", "args": ["${absOut}/server.py"], "env": { "AGENTIFY_BASE_URL": "..." } } } }`
    : `  { "mcpServers": { "agentify": { "command": "npx", "args": ["tsx", "${absOut}/server.ts"], "env": { "AGENTIFY_BASE_URL": "..." } } } }`;
  console.log(chalk.gray(mcpJson));
  console.log();
}

// ── Entry point ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd  = args[0];

if (cmd === 'generate') {
  const servicesIdx  = args.indexOf('--services');
  const outIdx       = args.indexOf('--out');
  const authBasicIdx = args.indexOf('--auth-basic');
  const apiKeyIdx    = args.indexOf('--apikey');
  const langIdx      = args.indexOf('--lang');

  const servicesFile = servicesIdx  >= 0 ? args[servicesIdx  + 1] : 'services.yaml';
  const outDir       = outIdx       >= 0 ? args[outIdx       + 1] : 'generated';
  const authBasic    = authBasicIdx >= 0 ? args[authBasicIdx + 1] : undefined;
  const apiKey       = apiKeyIdx    >= 0 ? args[apiKeyIdx    + 1] : undefined;
  const langFlag     = langIdx      >= 0 ? args[langIdx      + 1] : undefined;
  const readOnlyFlag = args.includes('--read-only') ? true : undefined;
  const allToolsFlag = args.includes('--all-tools');

  if (langFlag && langFlag !== 'typescript' && langFlag !== 'python') {
    console.error(chalk.red(`✖ Unsupported --lang "${langFlag}". Use: typescript, python`));
    process.exit(1);
  }

  (async () => {
    printBanner();

    // Load config
    let config: ServicesConfig;
    try {
      const raw = readFileSync(resolve(servicesFile), 'utf-8');
      config = yaml.load(raw) as ServicesConfig;
    } catch {
      console.error(chalk.red(`✖ Could not read services file: ${servicesFile}`));
      process.exit(1);
    }

    if (!config?.services?.length) {
      console.error(chalk.red('✖ No services found in config file.'));
      process.exit(1);
    }

    // Show config box
    const configLines = [
      chalk.bold('Config'),
      '',
      `  ${chalk.gray('Services:')}  ${chalk.white(String(config.services.length))}`,
      `  ${chalk.gray('File:')}      ${chalk.white(servicesFile)}`,
      `  ${chalk.gray('Output:')}    ${chalk.white(resolve(outDir))}`,
    ].join('\n');

    console.log(boxen(configLines, {
      padding:     { top: 0, bottom: 0, left: 1, right: 2 },
      margin:      { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: 'gray',
    }));

    // Fetch all tools first (need them for the picker)
    // Use readOnly flag if provided, else false for initial fetch (we re-filter after)
    const allTools = await fetchAllTools(config, false);
    console.log();

    if (allTools.length === 0) {
      console.log(boxen(
        chalk.red.bold('✖ No tools extracted.\n') + chalk.gray('Check your service URLs or file paths.'),
        { padding: 1, borderColor: 'red', borderStyle: 'round' }
      ));
      process.exit(1);
    }

    // Interactive: language, mode, tool picker
    const { lang, selectedTools, readOnly } = await runInteractive(
      allTools,
      langFlag,
      readOnlyFlag,
      allToolsFlag,
    );

    // Filter by read-only after selection if needed
    const finalTools = readOnly
      ? selectedTools.filter(t => t.httpMethod === 'GET' || t.httpMethod === 'HEAD')
      : selectedTools;

    if (finalTools.length === 0) {
      console.log(chalk.red('✖ No tools remain after applying read-only filter.'));
      process.exit(1);
    }

    // Generate
    await runGenerate(finalTools, lang, outDir, { authBasic, apiKey });

    // Summary
    printSummary(finalTools, lang, outDir);
  })().catch(err => {
    // Handle Ctrl+C from inquirer gracefully
    if (err?.name === 'ExitPromptError' || err?.message?.includes('User force closed')) {
      console.log(chalk.gray('\n  Cancelled.'));
      process.exit(0);
    }
    console.error(chalk.red('✖ Error: ') + err.message);
    process.exit(1);
  });

} else {
  printHelp();
}
