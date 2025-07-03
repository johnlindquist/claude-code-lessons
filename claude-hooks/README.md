# claude-hooks

Set up Claude Code hooks in your project with a single command.

## Quick Start

```bash
npx claude-hooks
```

This will:
1. Create a `.claude/hooks` directory with `index.ts` and `lib.ts` files
2. Configure your `.claude/settings.json` file to use the hooks
3. Set up a sessions directory for storing hook data

## What are Claude Code Hooks?

Claude Code hooks allow you to intercept and control Claude's tool usage in your project. You can:

- **PreToolUse**: Validate or block dangerous commands before they execute
- **PostToolUse**: Log or process results after tools run
- **Notification**: Handle notifications from Claude
- **Stop**: Perform cleanup when sessions end

## Usage

### Basic Setup

```bash
# Run in your project root
npx claude-hooks
```

### Options

```bash
# Force overwrite existing files
npx claude-hooks init --force

# Use a custom directory
npx claude-hooks init --directory custom/hooks
```

## Customizing Hooks

After setup, edit `.claude/hooks/index.ts` to customize the behavior:

```typescript
// Example: Block dangerous commands
async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
  if (payload.tool_name === 'Bash' && payload.tool_input.command.includes('rm -rf')) {
    return {
      action: 'block',
      stopReason: 'Dangerous command blocked'
    };
  }
  return { action: 'continue' };
}
```

## Requirements

- Node.js 14 or higher
- [Bun](https://bun.sh) runtime (for running the hooks)

## File Structure

After running `claude-hooks`, your project will have:

```
.claude/
├── hooks/
│   ├── index.ts    # Main hooks implementation
│   ├── lib.ts      # Hook utilities and types
│   └── sessions/   # Session data storage
└── settings.json   # Claude Code configuration
```

## License

MIT