# claude-hooks

[![Version](https://img.shields.io/npm/v/claude-hooks.svg)](https://npmjs.org/package/claude-hooks)
[![License](https://img.shields.io/npm/l/claude-hooks.svg)](https://github.com/anthropics/claude-hooks/blob/main/LICENSE)
[![Downloads/week](https://img.shields.io/npm/dw/claude-hooks.svg)](https://npmjs.org/package/claude-hooks)

> Interactive CLI to set up Claude Code hooks with customizable security rules and features

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Hook Types](#hook-types)
- [Security Features](#security-features)
- [Generated Files](#generated-files)
- [Examples](#examples)
- [Customization](#customization)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

`claude-hooks` is an interactive CLI wizard that helps you set up and customize Claude Code hooks in your project. Hooks allow you to control, monitor, and secure Claude's interactions with your codebase by intercepting tool calls before and after execution.

### Why Use Claude Hooks?

- **Security**: Prevent accidental deletion of important files or exposure of secrets
- **Compliance**: Create audit trails and enforce organizational policies
- **Safety**: Block dangerous commands and require confirmation for critical operations
- **Monitoring**: Track all AI actions for debugging and analysis
- **Customization**: Tailor Claude's behavior to your specific project needs

## Features

- 🎯 **Interactive Setup Wizard** - Guided setup process with intelligent defaults
- 🛡️ **Pre-configured Security Rules** - Block dangerous commands, prevent secrets exposure
- 📝 **Multiple Hook Types** - PreToolUse, PostToolUse, Notification, and Stop hooks
- 💾 **Flexible Storage Options** - JSON files, SQLite, PostgreSQL, or no storage
- 🎨 **Customizable Templates** - Generated code based on your specific needs
- 🚀 **Zero Configuration** - Works out of the box with sensible defaults
- 📦 **Language Support** - Optimized for different project types (Node.js, Python, Ruby, Go)

## Quick Start

Run the interactive setup wizard in your project:

```bash
npx claude-hooks
```

This will guide you through setting up hooks tailored to your needs.

## Installation

### Using npx (Recommended)

No installation needed! Just run:

```bash
npx claude-hooks
```

### Global Installation

```bash
npm install -g claude-hooks
claude-hooks
```

### Local Installation

```bash
npm install --save-dev claude-hooks
```

Then add to your `package.json` scripts:

```json
{
  "scripts": {
    "setup-hooks": "claude-hooks"
  }
}
```

## Usage

### Interactive Mode (Default)

Simply run the command without arguments to start the interactive wizard:

```bash
npx claude-hooks
```

The wizard will guide you through:

1. **Project Type Selection**
   - Node.js/JavaScript
   - Python
   - Ruby
   - Go
   - Other

2. **Hook Selection**
   - **PreToolUse**: Validate and potentially block commands before execution
   - **PostToolUse**: Process results after tool execution
   - **Notification**: Handle Claude notifications
   - **Stop**: Cleanup when session ends

3. **Security Features** (if PreToolUse is enabled)
   - Block dangerous file operations (rm -rf, chmod 777, etc.)
   - Prevent secrets exposure in commands
   - Require confirmation for production deployments
   - Block network requests to unknown domains
   - Custom regex patterns for blocking

4. **Session Storage**
   - Local JSON files (./sessions)
   - SQLite database
   - PostgreSQL
   - No storage

### Command Line Options

```bash
claude-hooks init [OPTIONS]

OPTIONS:
  -f, --force    Overwrite existing hooks without prompting
  -y, --yes      Accept defaults for all prompts (non-interactive)
  -h, --help     Show help

EXAMPLES:
  # Interactive setup
  $ npx claude-hooks

  # Quick setup with defaults
  $ npx claude-hooks init --yes

  # Overwrite existing hooks
  $ npx claude-hooks init --force

  # Non-interactive with overwrite
  $ npx claude-hooks init -y -f
```

## Hook Types

### PreToolUse

Executes before Claude runs any tool. Use this to:
- Validate and sanitize inputs
- Block dangerous operations
- Require confirmations
- Log intended actions

```typescript
export async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
  if (isDangerous(payload)) {
    return {
      action: 'block',
      stopReason: 'Dangerous operation detected'
    };
  }
  return { action: 'continue' };
}
```

### PostToolUse

Executes after a tool completes. Use this to:
- Log results and errors
- Send notifications
- Update external systems
- Analyze tool usage patterns

```typescript
export async function postToolUse(payload: PostToolUsePayload): Promise<void> {
  console.log(`Tool ${payload.tool_name} completed`);
  await saveToDatabase(payload);
}
```

### Notification

Handles Claude's notification events. Use this to:
- Display user alerts
- Send messages to chat systems
- Log important events

```typescript
export async function notification(payload: NotificationPayload): Promise<void> {
  if (payload.level === 'error') {
    await sendAlert(payload.message);
  }
}
```

### Stop

Executes when a Claude session ends. Use this to:
- Clean up resources
- Generate session reports
- Archive logs
- Send completion notifications

```typescript
export async function stop(payload: StopPayload): Promise<void> {
  await generateSessionReport(payload.session_id);
  await cleanupTempFiles();
}
```

## Security Features

### Block Dangerous File Operations

Prevents accidental system damage:
- `rm -rf /` or `rm -rf ~`
- `chmod 777` on system files
- `chown -R root` operations

### Prevent Secrets Exposure

Detects and blocks commands containing:
- API keys and passwords
- AWS credentials
- Bearer tokens
- Environment variables with secrets

### Production Safeguards

- Detect production environment indicators
- Require confirmation for deployments
- Block direct database modifications
- Prevent accidental data deletion

### Network Security

- Whitelist allowed domains
- Block requests to unknown endpoints
- Prevent data exfiltration
- Monitor API usage

## Generated Files

The CLI creates the following structure:

```
.claude/
├── settings.json          # Claude Code configuration
└── hooks/
    ├── index.ts          # Main hooks file (customized)
    ├── lib.ts            # Hook utilities and types
    ├── .gitignore        # Ignores session data
    └── sessions/         # Session logs (if enabled)
```

### settings.json

```json
{
  "hooks": {
    "command": "bun .claude/hooks/index.ts",
    "workingDirectory": ".",
    "environment": {}
  }
}
```

### Example Generated Hook

```typescript
#!/usr/bin/env bun

import {
  runHook,
  log,
  type PreToolUsePayload,
  type HookResponse,
  type BashToolInput
} from './lib';

// Security patterns based on your selections
const DANGEROUS_FILE_OPS = [
  /rm\s+-rf\s+[\/~]/,
  /chmod\s+777/,
  /chown\s+-R\s+root/,
];

const SECRET_PATTERNS = [
  /(api_key|password|secret|token)\s*[:=]\s*["']?\w+/i,
  /AWS_[A-Z_]+=['"]?[\w/+=]+/,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/,
];

export async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
  if (payload.tool_name === 'Bash' && payload.tool_input && 'command' in payload.tool_input) {
    const bashInput = payload.tool_input as BashToolInput;
    const command = bashInput.command;

    // Check for dangerous file operations
    for (const pattern of DANGEROUS_FILE_OPS) {
      if (pattern.test(command)) {
        return {
          action: 'block',
          stopReason: `Dangerous file operation detected: ${pattern}`
        };
      }
    }

    // Check for potential secrets exposure
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(command)) {
        return {
          action: 'block',
          stopReason: 'Potential secret exposure detected in command'
        };
      }
    }
  }
  
  return { action: 'continue' };
}

runHook({ preToolUse });
```

## Examples

### Basic Setup with Defaults

```bash
# Quick setup with sensible defaults
npx claude-hooks --yes
```

### High-Security Setup

Choose all security features during interactive setup:
- ✅ Block dangerous file operations
- ✅ Prevent secrets exposure
- ✅ Require production confirmations
- ✅ Block network requests
- ✅ Custom regex patterns

### Custom Patterns

After setup, edit `.claude/hooks/index.ts` to add custom patterns:

```typescript
const CUSTOM_PATTERNS = [
  /DROP\s+DATABASE/i,        // Block database drops
  /DELETE\s+FROM\s+users/i,  // Protect user data
  /api\.internal\./,         // Block internal API access
];
```

### Integration with CI/CD

Add to your CI setup:

```yaml
# .github/workflows/setup.yml
- name: Setup Claude Hooks
  run: npx claude-hooks --yes --force
```

## Customization

### Adding Custom Rules

Edit `.claude/hooks/index.ts` after generation:

```typescript
// Add your custom validation
function isCompanyPolicyViolation(command: string): boolean {
  // Your logic here
  return false;
}

// Use in preToolUse
if (isCompanyPolicyViolation(command)) {
  return {
    action: 'block',
    stopReason: 'Violates company policy'
  };
}
```

### Custom Storage

Implement your own storage adapter:

```typescript
// Custom storage implementation
async function saveToCustomStorage(hookType: string, payload: any) {
  // Send to your database, S3, etc.
}

// Replace the default saveSessionData calls
await saveToCustomStorage('PreToolUse', payload);
```

### Environment-Specific Rules

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && command.includes('DROP')) {
  return {
    action: 'block',
    stopReason: 'Database operations blocked in production'
  };
}
```

## Best Practices

1. **Start Simple**: Begin with basic security rules and add more as needed
2. **Test Thoroughly**: Test your hooks with safe commands before relying on them
3. **Log Everything**: Use PostToolUse to create comprehensive audit trails
4. **Regular Updates**: Review and update patterns as your project evolves
5. **Team Alignment**: Share hook configurations with your team
6. **Version Control**: Commit your `.claude` directory to track changes

## Troubleshooting

### Common Issues

**Hooks not executing**
- Ensure Bun is installed: `curl -fsSL https://bun.sh/install | bash`
- Check `.claude/settings.json` has correct paths
- Verify file permissions on hook files

**Commands being blocked incorrectly**
- Review patterns in `.claude/hooks/index.ts`
- Test patterns with sample commands
- Use more specific regex patterns

**Session data not saving**
- Check write permissions on `.claude/hooks/sessions`
- Ensure the directory exists
- Verify storage configuration

### Debug Mode

Add debug logging to your hooks:

```typescript
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('Checking command:', command);
  console.log('Patterns:', DANGEROUS_FILE_OPS);
}
```

Run with debug:
```bash
DEBUG=true bun .claude/hooks/index.ts
```

## Requirements

- Node.js >= 18.0.0
- [Bun](https://bun.sh) runtime (for running hooks)
- Claude Code CLI

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/anthropics/claude-hooks.git
cd claude-hooks

# Install dependencies
npm install

# Build the project
npm run build

# Run locally
./bin/run.js

# Run tests
npm test
```

## License

MIT © Anthropic

## Support

- 📚 [Documentation](https://docs.anthropic.com/claude-code/hooks)
- 🐛 [Issue Tracker](https://github.com/anthropics/claude-hooks/issues)
- 💬 [Discussions](https://github.com/anthropics/claude-hooks/discussions)
- 📧 [Email Support](mailto:support@anthropic.com)

---

Built with ❤️ by the Claude team to help developers work safely and efficiently with AI.
