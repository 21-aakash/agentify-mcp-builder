#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { fromUrl, fromFile } from './swagger-converter.js';
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

async function generate(servicesFile: string, outDir: string, readOnly: boolean, lang: 'typescript' | 'python', opts: GeneratorOptions = {}) {
  const raw = readFileSync(resolve(servicesFile), 'utf-8');
  const config = yaml.load(raw) as ServicesConfig;

  if (!config?.services?.length) {
    console.error('No services found in config file.');
    process.exit(1);
  }

  if (readOnly) console.log('Mode: read-only (GET/HEAD only — DML endpoints excluded)');
  console.log(`Language: ${lang}`);
  console.log(`Agentify — fetching specs for ${config.services.length} service(s)...\n`);

  const allTools = [];
  for (const svc of config.services) {
    if (svc.file) {
      const filePath = resolve(svc.file);
      process.stdout.write(`  ${svc.name} → file:${filePath} ... `);
      try {
        const tools = await fromFile(filePath, svc.name, readOnly);
        console.log(`${tools.length} tools`);
        allTools.push(...tools);
      } catch (err: any) {
        console.log(`FAILED (${err.message})`);
      }
    } else if (svc.url) {
      const url = svc.url.startsWith('http') ? svc.url : `${config.baseUrl ?? ''}${svc.url}`;
      process.stdout.write(`  ${svc.name} → ${url} ... `);
      try {
        const tools = await fromUrl(url, svc.name, readOnly);
        console.log(`${tools.length} tools`);
        allTools.push(...tools);
      } catch (err: any) {
        console.log(`FAILED (${err.message})`);
      }
    } else {
      console.log(`  ${svc.name} → SKIPPED (no url or file specified)`);
    }
  }

  if (allTools.length === 0) {
    console.error('\nNo tools extracted. Check your service URLs or file paths.');
    process.exit(1);
  }

  console.log(`\nGenerating MCP server with ${allTools.length} total tools...`);
  const absOut = resolve(outDir);

  if (lang === 'python') {
    const generator = new PythonGenerator(absOut, opts);
    await generator.generate(allTools);
    console.log(`\n✓ Done! Generated files in: ${absOut}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${outDir}`);
    console.log(`  pip install -r requirements.txt`);
    console.log(`  AGENTIFY_BASE_URL=http://your-service:8080 python server.py`);
    console.log(`\nTo connect to Claude Code, add to .mcp.json:`);
    console.log(`  { "mcpServers": { "agentify": { "command": "python", "args": ["${absOut}/server.py"], "env": { "AGENTIFY_BASE_URL": "http://your-service:8080" } } } }`);
  } else {
    const generator = new McpGenerator(absOut, opts);
    await generator.generate(allTools);
    console.log(`\n✓ Done! Generated files in: ${absOut}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${outDir} && npm install`);
    console.log(`  AGENTIFY_BASE_URL=http://your-service:8080 npm run mcp`);
    console.log(`\nTo connect to Claude Code, add to .mcp.json:`);
    console.log(`  { "mcpServers": { "agentify": { "command": "npx", "args": ["tsx", "${absOut}/server.ts"], "env": { "AGENTIFY_BASE_URL": "http://your-service:8080" } } } }`);
  }
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'generate') {
    const servicesIdx   = args.indexOf('--services');
  const outIdx        = args.indexOf('--out');
  const authBasicIdx  = args.indexOf('--auth-basic');
  const apiKeyIdx     = args.indexOf('--apikey');
  const langIdx       = args.indexOf('--lang');
  const servicesFile  = servicesIdx  >= 0 ? args[servicesIdx  + 1] : 'services.yaml';
  const outDir        = outIdx       >= 0 ? args[outIdx       + 1] : 'generated';
  const authBasic     = authBasicIdx >= 0 ? args[authBasicIdx + 1] : undefined;
  const apiKey        = apiKeyIdx    >= 0 ? args[apiKeyIdx    + 1] : undefined;
  const langRaw       = langIdx      >= 0 ? args[langIdx      + 1] : 'typescript';
  const readOnly      = args.includes('--read-only');

  if (langRaw !== 'typescript' && langRaw !== 'python') {
    console.error(`Unsupported --lang "${langRaw}". Use: typescript, python`);
    process.exit(1);
  }
  const lang = langRaw as 'typescript' | 'python';

  if (!servicesFile) {
    console.error('Usage: agentify generate --services <file> [--out <dir>] [--lang typescript|python] [--read-only] [--auth-basic <token>] [--apikey <token>]');
    process.exit(1);
  }

  generate(servicesFile, outDir, readOnly, lang, { authBasic, apiKey }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
} else {
  console.log('Agentify — turn OSS microservices into MCP tools\n');
  console.log('Usage:');
  console.log('  agentify generate --services services.yaml [--out generated] [--lang typescript|python] [--read-only]');
  console.log('\nservices.yaml format:');
  console.log('  services:');
  console.log('    - name: order-service');
  console.log('      url: http://localhost:8081/v3/api-docs   # live URL');
  console.log('    - name: user-service');
  console.log('      file: ./specs/user-service.json          # local file');
}
