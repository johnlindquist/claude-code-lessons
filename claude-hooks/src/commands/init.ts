import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fsExtra from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface InitOptions {
  force?: boolean;
  directory?: string;
}

interface ClaudeSettings {
  hooks?: {
    command: string;
    workingDirectory?: string;
    environment?: Record<string, string>;
  };
  [key: string]: unknown;
}

export async function init(options: InitOptions) {
  const hooksDir = options.directory || '.claude/hooks';
  const settingsPath = '.claude/settings.json';
  
  console.log(chalk.blue('🪝 Setting up Claude Code hooks...'));

  try {
    // Ensure .claude directory exists
    await fs.mkdir('.claude', { recursive: true });
    
    // Create hooks directory
    await fs.mkdir(hooksDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${hooksDir} directory`));

    // Copy template files
    const templatesDir = join(__dirname, '..', '..', 'templates', 'hooks');
    const filesToCopy = ['index.ts', 'lib.ts'];

    for (const file of filesToCopy) {
      const sourcePath = join(templatesDir, file);
      const destPath = join(hooksDir, file);

      // Check if file already exists
      if (!options.force) {
        try {
          await fs.access(destPath);
          console.log(chalk.yellow(`⚠ ${destPath} already exists (use --force to overwrite)`));
          continue;
        } catch {
          // File doesn't exist, proceed with copy
        }
      }

      await fsExtra.copy(sourcePath, destPath);
      console.log(chalk.green(`✓ Created ${destPath}`));
    }

    // Update .claude-settings.json
    let settings: ClaudeSettings = {};
    
    try {
      const existingSettings = await fs.readFile(settingsPath, 'utf-8');
      settings = JSON.parse(existingSettings);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty object
    }

    // Add hooks configuration if not present
    if (!settings.hooks || options.force) {
      settings.hooks = {
        command: `bun ${hooksDir}/index.ts`,
        workingDirectory: ".",
        environment: {}
      };

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      console.log(chalk.green(`✓ Updated ${settingsPath} with hooks configuration`));
    } else {
      console.log(chalk.yellow(`⚠ Hooks already configured in ${settingsPath}`));
    }

    // Create sessions directory
    const sessionsDir = join(hooksDir, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    console.log(chalk.green(`✓ Created ${sessionsDir} directory`));

    // Create .gitignore for sessions
    const gitignorePath = join(hooksDir, '.gitignore');
    const gitignoreContent = 'sessions/\n';
    
    try {
      await fs.writeFile(gitignorePath, gitignoreContent);
      console.log(chalk.green(`✓ Created ${gitignorePath}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠ Could not create .gitignore: ${error}`));
    }

    console.log(chalk.blue('\n✨ Claude Code hooks setup complete!'));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('1. Customize the hooks in ' + join(hooksDir, 'index.ts')));
    console.log(chalk.gray('2. Ensure bun is installed: https://bun.sh'));
    console.log(chalk.gray('3. Test your hooks by using Claude Code\n'));

  } catch (error) {
    console.error(chalk.red('Error setting up hooks:'), error);
    process.exit(1);
  }
}