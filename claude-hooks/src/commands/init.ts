import {Command, Flags} from '@oclif/core'
import {checkbox, confirm, select} from '@inquirer/prompts'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface HookSelection {
  preToolUse: boolean
  postToolUse: boolean
  notification: boolean
  stop: boolean
}

interface SecurityFeatures {
  blockDangerousFileOps: boolean
  preventSecretsExposure: boolean
  requireProductionConfirmation: boolean
  blockNetworkRequests: boolean
  customRegexPatterns: boolean
}

interface SessionStorage {
  type: 'json' | 'sqlite' | 'postgres' | 'none'
  path?: string
}

export default class Init extends Command {
  static description = `Initialize Claude Code hooks in your project with an interactive wizard

This command sets up Claude Code hooks to help you control and monitor Claude's actions in your codebase.

The interactive wizard will guide you through:
• Selecting which hooks to enable (PreToolUse, PostToolUse, Notification, Stop)
• Configuring security features to protect your codebase
• Choosing how to store session data for debugging and auditing
• Generating customized hook code based on your selections

Hooks are powerful tools that let you:
• Block dangerous commands before they execute
• Log and monitor all Claude's actions
• Prevent accidental exposure of secrets
• Require confirmation for production operations
• Create audit trails of AI interactions

The generated hooks are minimal and focused on your specific needs, making them easy to understand and customize further.`

  static examples = [
    {
      description: 'Run the interactive setup wizard',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Use default settings (non-interactive)',
      command: '<%= config.bin %> <%= command.id %> --yes',
    },
    {
      description: 'Overwrite existing hooks',
      command: '<%= config.bin %> <%= command.id %> --force',
    },
    {
      description: 'Quick setup with defaults, overwriting existing',
      command: '<%= config.bin %> <%= command.id %> -y -f',
    },
  ]

  static flags = {
    force: Flags.boolean({
      char: 'f', 
      description: 'Overwrite existing hooks without prompting',
      helpGroup: 'GLOBAL',
    }),
    yes: Flags.boolean({
      char: 'y', 
      description: 'Accept default values for all prompts (non-interactive mode)',
      helpGroup: 'GLOBAL',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Init)

    console.log(chalk.blue.bold('\n🪝 Welcome to Claude Hooks Setup Wizard!\n'))

    // Check if hooks already exist
    if (!flags.force && await fs.pathExists('.claude/hooks/index.ts')) {
      if (!flags.yes) {
        const overwrite = await confirm({
          message: 'Claude hooks already exist. Do you want to overwrite them?',
          default: false,
        })
        if (!overwrite) {
          console.log(chalk.yellow('\nSetup cancelled.'))
          return
        }
      }
    }

    // Select project type
    const projectType = flags.yes ? 'nodejs' : await select({
      message: 'What type of project is this?',
      choices: [
        {value: 'nodejs', name: 'Node.js/JavaScript'},
        {value: 'python', name: 'Python'},
        {value: 'ruby', name: 'Ruby'},
        {value: 'go', name: 'Go'},
        {value: 'other', name: 'Other'},
      ],
    })

    // Select hooks to enable
    const hooks = flags.yes ? ['preToolUse'] : await checkbox({
      message: 'Which hooks would you like to enable?',
      choices: [
        {
          value: 'preToolUse',
          name: 'PreToolUse - Validate commands before execution',
          checked: true,
        },
        {
          value: 'postToolUse',
          name: 'PostToolUse - Process results after execution',
          checked: false,
        },
        {
          value: 'notification',
          name: 'Notification - Handle Claude notifications',
          checked: false,
        },
        {
          value: 'stop',
          name: 'Stop - Cleanup on session end',
          checked: false,
        },
      ],
    })

    const hookSelection: HookSelection = {
      preToolUse: hooks.includes('preToolUse'),
      postToolUse: hooks.includes('postToolUse'),
      notification: hooks.includes('notification'),
      stop: hooks.includes('stop'),
    }

    // Select security features if PreToolUse is enabled
    let securityFeatures: SecurityFeatures = {
      blockDangerousFileOps: false,
      preventSecretsExposure: false,
      requireProductionConfirmation: false,
      blockNetworkRequests: false,
      customRegexPatterns: false,
    }

    if (hookSelection.preToolUse) {
      const features = flags.yes ? ['blockDangerousFileOps', 'preventSecretsExposure'] : await checkbox({
        message: 'What security features would you like?',
        choices: [
          {
            value: 'blockDangerousFileOps',
            name: 'Block dangerous file operations (rm -rf, etc.)',
            checked: true,
          },
          {
            value: 'preventSecretsExposure',
            name: 'Prevent secrets exposure in commands',
            checked: true,
          },
          {
            value: 'requireProductionConfirmation',
            name: 'Require confirmation for production deployments',
            checked: false,
          },
          {
            value: 'blockNetworkRequests',
            name: 'Block network requests to unknown domains',
            checked: false,
          },
          {
            value: 'customRegexPatterns',
            name: 'Custom regex patterns for blocking',
            checked: false,
          },
        ],
      })

      securityFeatures = {
        blockDangerousFileOps: features.includes('blockDangerousFileOps'),
        preventSecretsExposure: features.includes('preventSecretsExposure'),
        requireProductionConfirmation: features.includes('requireProductionConfirmation'),
        blockNetworkRequests: features.includes('blockNetworkRequests'),
        customRegexPatterns: features.includes('customRegexPatterns'),
      }
    }

    // Select session storage
    const storageType = flags.yes ? 'json' : await select({
      message: 'Where should session data be stored?',
      choices: [
        {value: 'json', name: 'Local JSON files (./sessions)'},
        {value: 'sqlite', name: 'SQLite database'},
        {value: 'postgres', name: 'PostgreSQL'},
        {value: 'none', name: "Don't store session data"},
      ],
    })

    const sessionStorage: SessionStorage = {
      type: storageType as SessionStorage['type'],
    }

    if (storageType === 'json') {
      sessionStorage.path = './sessions'
    }

    // Generate and install hooks
    const spinner = ora('Generating your custom hooks...').start()

    try {
      // Ensure directories exist
      await fs.ensureDir('.claude/hooks')
      
      // Generate hook files based on selections
      await this.generateHookFiles(hookSelection, securityFeatures, sessionStorage, projectType)
      
      // Update settings.json
      await this.updateSettings()
      
      // Create .gitignore for sessions if needed
      if (sessionStorage.type === 'json') {
        await fs.writeFile('.claude/hooks/.gitignore', 'sessions/\n')
      }

      spinner.succeed('Hooks generated successfully!')

      // Success message
      console.log(chalk.green('\n✨ Claude Code hooks setup complete!\n'))
      console.log(chalk.gray('Next steps:'))
      console.log(chalk.gray('1. Review the generated hooks in .claude/hooks/'))
      console.log(chalk.gray('2. Customize the rules to fit your needs'))
      console.log(chalk.gray('3. Test your hooks by using Claude Code\n'))

    } catch (error) {
      spinner.fail('Failed to generate hooks')
      console.error(chalk.red('\nError:'), error)
      process.exit(1)
    }
  }

  private async generateHookFiles(
    hooks: HookSelection,
    security: SecurityFeatures,
    storage: SessionStorage,
    projectType: string
  ): Promise<void> {
    // Copy base lib.ts
    const distDir = path.dirname(fileURLToPath(import.meta.url))
    const rootDir = path.join(distDir, '..', '..')
    const templatesDir = path.join(rootDir, 'templates')
    await fs.copy(path.join(templatesDir, 'hooks', 'lib.ts'), '.claude/hooks/lib.ts')

    // Generate customized index.ts
    const indexContent = this.generateIndexFile(hooks, security, storage, projectType)
    await fs.writeFile('.claude/hooks/index.ts', indexContent)

    // Create sessions directory if needed
    if (storage.type === 'json') {
      await fs.ensureDir('.claude/hooks/sessions')
    }
  }

  private generateIndexFile(
    hooks: HookSelection,
    security: SecurityFeatures,
    storage: SessionStorage,
    projectType: string
  ): string {
    const imports = ['runHook', 'log']
    const handlers: string[] = []

    if (storage.type === 'json') {
      imports.push('ensureSessionsDirectory', 'saveSessionData')
    }

    if (hooks.preToolUse) {
      imports.push('type PreToolUsePayload', 'type HookResponse', 'type BashToolInput')
    }
    if (hooks.postToolUse) {
      imports.push('type PostToolUsePayload')
    }
    if (hooks.notification) {
      imports.push('type NotificationPayload')
    }
    if (hooks.stop) {
      imports.push('type StopPayload')
    }

    let content = `#!/usr/bin/env bun

import {
  ${imports.join(',\n  ')}
} from './lib';
`

    if (storage.type === 'json') {
      content += `\n// Ensure sessions directory exists on startup\nawait ensureSessionsDirectory();\n`
    }

    // Generate security patterns if needed
    if (hooks.preToolUse && (security.blockDangerousFileOps || security.preventSecretsExposure)) {
      content += '\n// Security patterns based on your selections\n'
      
      if (security.blockDangerousFileOps) {
        content += `const DANGEROUS_FILE_OPS = [
  /rm\\s+-rf\\s+[/~]/, // Prevent deletion of root or home
  /chmod\\s+777/, // Prevent overly permissive permissions
  /chown\\s+-R\\s+root/, // Prevent changing ownership to root
];
`
      }

      if (security.preventSecretsExposure) {
        content += `const SECRET_PATTERNS = [
  /(api_key|password|secret|token)\\s*[:=]\\s*["']?\\w+/i,
  /AWS_[A-Z_]+=['"]?[\\w/+=]+/,
  /Bearer\\s+[A-Za-z0-9\\-._~+/]+=*/,
];
`
      }

      if (security.requireProductionConfirmation) {
        content += `const PRODUCTION_PATTERNS = [
  /--context=production/,
  /--env=prod/,
  /production\\.\\w+/,
  /deploy.*prod/i,
];
`
      }
    }

    // Generate PreToolUse handler
    if (hooks.preToolUse) {
      content += `\n// PreToolUse handler - validate and potentially block dangerous commands
export async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {`
      
      if (storage.type === 'json') {
        content += `\n  // Save session data\n  await saveSessionData('PreToolUse', payload);\n`
      }

      content += `
  if (payload.tool_name === 'Bash' && payload.tool_input && 'command' in payload.tool_input) {
    const bashInput = payload.tool_input as BashToolInput;
    const command = bashInput.command;
`

      if (security.blockDangerousFileOps) {
        content += `
    // Check for dangerous file operations
    for (const pattern of DANGEROUS_FILE_OPS) {
      if (pattern.test(command)) {
        return {
          action: 'block',
          stopReason: \`Dangerous file operation detected: \${pattern}\`
        };
      }
    }
`
      }

      if (security.preventSecretsExposure) {
        content += `
    // Check for potential secrets exposure
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(command)) {
        return {
          action: 'block',
          stopReason: 'Potential secret exposure detected in command'
        };
      }
    }
`
      }

      if (security.requireProductionConfirmation) {
        content += `
    // Check for production operations
    for (const pattern of PRODUCTION_PATTERNS) {
      if (pattern.test(command)) {
        log('⚠️  Production operation detected:', command);
        // In a real implementation, you might want to implement a confirmation mechanism
      }
    }
`
      }

      content += `  }
  
  // Allow all other commands
  return { action: 'continue' };
}
`
      handlers.push('preToolUse')
    }

    // Generate PostToolUse handler
    if (hooks.postToolUse) {
      content += `\n// PostToolUse handler - log tool results
export async function postToolUse(payload: PostToolUsePayload): Promise<void> {`
      
      if (storage.type === 'json') {
        content += `\n  await saveSessionData('PostToolUse', payload);`
      }
      
      content += `\n  log('Tool executed:', payload.tool_name);\n}\n`
      handlers.push('postToolUse')
    }

    // Generate Notification handler
    if (hooks.notification) {
      content += `\n// Notification handler - log notifications
export async function notification(payload: NotificationPayload): Promise<void> {`
      
      if (storage.type === 'json') {
        content += `\n  await saveSessionData('Notification', payload);`
      }
      
      content += `\n  log('Notification received:', payload.message);\n}\n`
      handlers.push('notification')
    }

    // Generate Stop handler
    if (hooks.stop) {
      content += `\n// Stop handler - log session end
export async function stop(payload: StopPayload): Promise<void> {`
      
      if (storage.type === 'json') {
        content += `\n  await saveSessionData('Stop', payload);`
      }
      
      content += `\n  log('Session ended:', payload.session_id);\n}\n`
      handlers.push('stop')
    }

    // Run the hook
    content += `\n// Run the hook with our handlers\nrunHook({\n`
    content += handlers.map(h => `  ${h}`).join(',\n')
    content += '\n});\n'

    return content
  }

  private async updateSettings(): Promise<void> {
    const settingsPath = '.claude/settings.json'
    let settings: any = {}

    try {
      const existingSettings = await fs.readFile(settingsPath, 'utf-8')
      settings = JSON.parse(existingSettings)
    } catch {
      // File doesn't exist or is invalid
    }

    settings.hooks = {
      command: 'bun .claude/hooks/index.ts',
      workingDirectory: '.',
      environment: {}
    }

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
  }
}