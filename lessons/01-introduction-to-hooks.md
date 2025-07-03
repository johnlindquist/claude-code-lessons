# Lesson 1: Introduction to Claude Code Hooks

## Learning Objectives
By the end of this lesson, you will:
- Understand what Claude Code hooks are and why they're valuable
- Learn the core concepts: events, matchers, and commands
- Understand the hook lifecycle
- Configure your first hook in `~/.claude/settings.json`
- Create a simple logging hook

## What Are Claude Code Hooks?

Claude Code hooks are user-defined shell commands that execute automatically at specific points during Claude's operation. Think of them as "triggers" that fire when Claude performs certain actions.

### Why Use Hooks?

Without hooks, you might ask Claude to:
- "Please format this file after editing"
- "Remember to log this command"
- "Check if this is safe before running"

With hooks, these actions happen automatically—no reminders needed!

## Core Concepts

### 1. **Events** (When hooks run)
- `PreToolUse`: Before Claude uses a tool
- `PostToolUse`: After a tool completes successfully
- `Notification`: When Claude needs your attention
- `Stop`: When Claude finishes responding

### 2. **Matchers** (Which tools trigger hooks)
- Simple strings: `"Bash"` matches only the Bash tool
- Multiple tools: `"Edit|Write"` matches Edit OR Write
- Wildcards: `".*"` matches all tools
- MCP patterns: `"mcp__.*"` matches all MCP tools

### 3. **Commands** (What hooks do)
- Any shell command or script
- Receives JSON input via stdin
- Can output JSON to control Claude's behavior

## Hook Lifecycle

```
User Request → Claude Plans Action → PreToolUse Hook → Tool Executes → PostToolUse Hook → Claude Continues
```

## Configuration Basics

Hooks are configured in your Claude Code settings file:
- **macOS/Linux**: `~/.claude/settings.json`
- **Windows**: `%USERPROFILE%\.claude\settings.json`

### Basic Structure
```json
{
  "hooks": {
    "HookType": [
      {
        "matcher": "ToolName",
        "hooks": [
          {
            "type": "command",
            "command": "your-shell-command"
          }
        ]
      }
    ]
  }
}
```

## Your First Hook: Command Logger

Let's create a simple hook that logs every Bash command Claude runs.

### Step 1: Create the settings file
```bash
mkdir -p ~/.claude
touch ~/.claude/settings.json
```

### Step 2: Add the logging hook
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date)] Claude is running a bash command\" >> ~/.claude/command.log"
          }
        ]
      }
    ]
  }
}
```

### Step 3: Test the hook
1. Restart Claude Code (hooks require a restart)
2. Ask Claude to run any bash command
3. Check your log file: `cat ~/.claude/command.log`

## Understanding Hook Input

Hooks receive JSON input with context about the tool being used:

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "ls -la",
    "description": "List files with details"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Accessing Hook Input
You can use `jq` to parse this input:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '\"[\\(.timestamp)] Command: \\(.tool_input.command)\"' >> ~/.claude/commands.log"
          }
        ]
      }
    ]
  }
}
```

## Safety Considerations

⚠️ **Important**: Hooks run with your full system permissions!

- Test hooks carefully before using them
- Never run untrusted code in hooks
- Use absolute paths in commands
- Handle errors gracefully with `|| true`

## Practice Exercise

Create a hook that:
1. Logs every file Claude edits
2. Includes the timestamp and file path
3. Stores the log in `~/.claude/edited-files.log`

<details>
<summary>Solution</summary>

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '\"[\\(.timestamp)] Edited: \\(.tool_input.file_path)\"' >> ~/.claude/edited-files.log"
          }
        ]
      }
    ]
  }
}
```
</details>

## Common Patterns

### Pattern 1: Multiple Matchers
```json
{
  "matcher": "Edit|Write|MultiEdit",
  "hooks": [{"type": "command", "command": "echo 'File operation'"}]
}
```

### Pattern 2: All Tools
```json
{
  "matcher": ".*",
  "hooks": [{"type": "command", "command": "echo 'Any tool used'"}]
}
```

### Pattern 3: Error Handling
```json
{
  "command": "my-script.sh || echo 'Script failed' >> error.log"
}
```

## Troubleshooting

### Hook Not Triggering?
1. Did you restart Claude Code?
2. Check JSON syntax: `jq . ~/.claude/settings.json`
3. Verify matcher spelling matches tool name exactly

### Permission Errors?
- Make scripts executable: `chmod +x script.sh`
- Use full paths or ensure commands are in PATH

### Debug Mode
Add a universal logger to see all tool calls:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"Tool called: $(jq -r .tool_name)\" >> ~/.claude/debug.log"
          }
        ]
      }
    ]
  }
}
```

## Summary

You've learned:
- ✅ What Claude Code hooks are
- ✅ The four types of hook events
- ✅ How to configure hooks in settings.json
- ✅ How to create a simple logging hook
- ✅ Safety considerations when using hooks

## Next Steps

In Lesson 2, we'll dive deep into PreToolUse and PostToolUse hooks, learning how to:
- Format code automatically after edits
- Validate commands before execution
- Build more complex hook chains

## Additional Resources

- [Official Claude Code Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [Claude Code Settings Reference](https://docs.anthropic.com/en/docs/claude-code/settings)
- [Community Hook Examples](https://github.com/anthropics/claude-code/discussions)