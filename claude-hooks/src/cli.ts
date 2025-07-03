#!/usr/bin/env node
import { Command } from 'commander';
import { init } from './commands/init.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('claude-hooks')
  .description('Set up Claude Code hooks in your project')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize Claude Code hooks in your project')
  .option('-f, --force', 'Overwrite existing files')
  .option('-d, --directory <path>', 'Directory to create hooks in', '.claude/hooks')
  .action(init);

// Default command
program
  .action(() => {
    // If no command is specified, run init
    init({});
  });

program.parse();