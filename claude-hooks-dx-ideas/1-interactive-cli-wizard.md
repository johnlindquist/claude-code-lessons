# Interactive CLI Wizard for Claude Hooks

## Overview
Instead of a simple `npx claude-hooks` that generates all files at once, create an interactive CLI wizard that guides users through customizing their hooks setup based on their specific needs.

## User Experience

```bash
$ npx claude-hooks init

🪝 Welcome to Claude Hooks Setup Wizard!

? What type of project is this? (Use arrow keys)
❯ Node.js/JavaScript
  Python
  Ruby
  Go
  Other

? Which hooks would you like to enable? (Press <space> to select, <a> to toggle all)
❯◉ PreToolUse - Validate commands before execution
 ◯ PostToolUse - Process results after execution
 ◯ Notification - Handle Claude notifications
 ◯ Stop - Cleanup on session end

? What security features would you like? (Press <space> to select)
❯◉ Block dangerous file operations (rm -rf, etc.)
 ◉ Prevent secrets exposure in commands
 ◯ Require confirmation for production deployments
 ◯ Block network requests to unknown domains
 ◯ Custom regex patterns for blocking

? Where should session data be stored?
❯ Local JSON files (./sessions)
  SQLite database
  PostgreSQL
  Don't store session data

? Would you like to add any plugins? (Press <space> to select)
❯◯ Git commit guard - Enforce commit message standards
 ◯ Test runner - Automatically run tests after file changes
 ◯ Linting integration - Run linters before file saves
 ◯ Performance monitor - Track command execution times
```

## Benefits

1. **Personalized Setup**: Users only get the code they need
2. **Educational**: Helps users understand what each hook does
3. **Plugin Ecosystem**: Easy to discover and add community plugins
4. **Language-Specific**: Can generate idiomatic code for different languages
5. **Progressive Disclosure**: Advanced options only shown when needed

## Implementation Ideas

- Use `inquirer` or `prompts` for the interactive CLI
- Generate minimal, focused code based on selections
- Include inline documentation specific to chosen features
- Offer templates for common use cases (security-focused, logging-focused, etc.)
- Save preferences for future runs in the same project

## Example Generated Code

Based on selections, generate a minimal `index.ts`:

```typescript
// Generated for: Node.js project with PreToolUse security features

import { runHook, type PreToolUsePayload, type HookResponse } from './lib';

// Security patterns based on your selections
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/,
  /curl.*(-d|--data).*password/i,
  // ... other patterns based on selections
];

async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
  if (payload.tool_name === 'Bash') {
    const command = payload.tool_input.command;
    
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return {
          action: 'block',
          stopReason: `Security policy violation: ${pattern}`
        };
      }
    }
  }
  
  return { action: 'continue' };
}

runHook({ preToolUse });
```