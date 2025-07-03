# Lesson 2: PreToolUse and PostToolUse Hooks

## Learning Objectives
By the end of this lesson, you will:
- Master PreToolUse hooks for validation and pre-processing
- Understand PostToolUse hooks for automation and cleanup
- Learn advanced matcher patterns
- Build practical automation workflows
- Understand hook input/output JSON structure

## PreToolUse Hooks: Your First Line of Defense

PreToolUse hooks run **before** Claude executes a tool. They can:
- ✅ Validate inputs
- ✅ Block dangerous operations
- ✅ Log actions for audit trails
- ✅ Modify Claude's behavior

### Anatomy of a PreToolUse Hook

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/validate_bash.py"
          }
        ]
      }
    ]
  }
}
```

### Hook Input Structure

PreToolUse hooks receive detailed JSON input:

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/src/app.js",
    "old_string": "console.log",
    "new_string": "logger.info"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_123",
  "conversation_id": "conv_456"
}
```

### Controlling Claude's Behavior

PreToolUse hooks can return JSON to control execution:

```json
{
  "action": "continue" | "block",
  "stopReason": "Explanation for Claude",
  "suppressOutput": true | false
}
```

## PostToolUse Hooks: Automate Your Workflow

PostToolUse hooks run **after** a tool completes successfully. Perfect for:
- 🎨 Auto-formatting code
- 📊 Updating documentation
- 🔍 Running linters
- 📧 Sending notifications

### Example: Auto-Format on Save

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/auto_format.sh"
          }
        ]
      }
    ]
  }
}
```

**auto_format.sh:**
```bash
#!/bin/bash
# Read hook input
HOOK_INPUT=$(cat)
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path')

# Format based on file extension
case "$FILE_PATH" in
  *.js|*.jsx|*.ts|*.tsx)
    prettier --write "$FILE_PATH" 2>/dev/null || true
    ;;
  *.py)
    black "$FILE_PATH" 2>/dev/null || true
    ;;
  *.go)
    gofmt -w "$FILE_PATH" 2>/dev/null || true
    ;;
  *.rs)
    rustfmt "$FILE_PATH" 2>/dev/null || true
    ;;
esac

echo "Formatted: $FILE_PATH" >> ~/.claude/format.log
```

## Advanced Matcher Patterns

### Pattern Types

1. **Exact Match**: `"Bash"`
2. **Multiple Tools**: `"Edit|Write"`
3. **Wildcards**: `".*"` (matches all)
4. **Regex Patterns**: `"Notebook.*"` (NotebookEdit, NotebookRead)
5. **MCP Tools**: `"mcp__.*__.*"`

### Complex Matcher Examples

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{"type": "command", "command": "echo 'File operation'"}]
      },
      {
        "matcher": "Bash|WebSearch",
        "hooks": [{"type": "command", "command": "echo 'External operation'"}]
      },
      {
        "matcher": "mcp__github__.*",
        "hooks": [{"type": "command", "command": "echo 'GitHub MCP action'"}]
      }
    ]
  }
}
```

## Practical Examples

### Example 1: Command Security Scanner

**settings.json:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/security_check.py"
          }
        ]
      }
    ]
  }
}
```

**security_check.py:**
```python
#!/usr/bin/env python3
import json
import sys
import re

# Read hook input
hook_input = json.loads(sys.stdin.read())
command = hook_input['tool_input']['command']

# Define dangerous patterns
dangerous_patterns = [
    r'rm\s+-rf\s+/',           # rm -rf /
    r':(){ :|:& };:',          # Fork bomb
    r'>\s*/dev/sda',           # Overwrite disk
    r'mv\s+.+\s+/dev/null',    # Move to null
    r'chmod\s+777\s+/',        # Unsafe permissions on root
]

# Check each pattern
for pattern in dangerous_patterns:
    if re.search(pattern, command):
        print(json.dumps({
            "action": "block",
            "stopReason": f"Security: Potentially dangerous command pattern detected: {pattern}"
        }))
        sys.exit(0)

# Log the command
with open('/home/user/.claude/command_log.txt', 'a') as f:
    f.write(f"[APPROVED] {command}\n")

# Allow execution
print(json.dumps({"action": "continue"}))
```

### Example 2: Git Auto-Commit Hook

**settings.json:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/auto_git_add.sh"
          }
        ]
      }
    ]
  }
}
```

**auto_git_add.sh:**
```bash
#!/bin/bash
HOOK_INPUT=$(cat)
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path')

# Check if file is in a git repository
if git -C "$(dirname "$FILE_PATH")" rev-parse --git-dir > /dev/null 2>&1; then
    # Stage the file
    git -C "$(dirname "$FILE_PATH")" add "$FILE_PATH"
    echo "[Git] Staged: $FILE_PATH" >> ~/.claude/git_activity.log
fi
```

### Example 3: Code Quality Enforcer

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/lint_check.sh"
          }
        ]
      }
    ]
  }
}
```

**lint_check.sh:**
```bash
#!/bin/bash
HOOK_INPUT=$(cat)
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path')
FEEDBACK=""

case "$FILE_PATH" in
  *.py)
    # Run pylint and capture output
    LINT_OUTPUT=$(pylint "$FILE_PATH" 2>&1)
    if [ $? -ne 0 ]; then
      FEEDBACK="Python linting issues found. Consider running: pylint $FILE_PATH"
    fi
    ;;
  *.js|*.jsx)
    # Run eslint
    LINT_OUTPUT=$(eslint "$FILE_PATH" 2>&1)
    if [ $? -ne 0 ]; then
      FEEDBACK="JavaScript linting issues found. Consider running: eslint --fix $FILE_PATH"
    fi
    ;;
esac

# Provide feedback to Claude
if [ -n "$FEEDBACK" ]; then
  echo "$FEEDBACK" >> ~/.claude/lint_feedback.log
  # Optionally, you could block here and provide feedback
fi
```

## Environment Variables in Hooks

Claude provides useful environment variables:

- `CLAUDE_TOOL_NAME`: The tool being used
- `CLAUDE_TOOL_INPUT_FILE_PATH`: File path for file operations
- `CLAUDE_CONVERSATION_ID`: Current conversation ID
- `CLAUDE_REQUEST_ID`: Unique request identifier

### Using Environment Variables

```bash
#!/bin/bash
echo "Tool: $CLAUDE_TOOL_NAME" >> ~/.claude/activity.log
echo "File: $CLAUDE_TOOL_INPUT_FILE_PATH" >> ~/.claude/activity.log
```

## Hook Chains and Workflows

You can chain multiple hooks for complex workflows:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/format_code.sh"
          },
          {
            "type": "command",
            "command": "~/.claude/hooks/run_tests.sh"
          },
          {
            "type": "command",
            "command": "~/.claude/hooks/update_docs.sh"
          }
        ]
      }
    ]
  }
}
```

## Error Handling Best Practices

### 1. Always Handle Failures Gracefully
```bash
prettier --write "$FILE" 2>/dev/null || echo "Format failed: $FILE" >> error.log
```

### 2. Validate Input
```python
try:
    hook_input = json.loads(sys.stdin.read())
except json.JSONDecodeError:
    print(json.dumps({"action": "continue"}))
    sys.exit(0)
```

### 3. Provide Clear Feedback
```python
if error_found:
    print(json.dumps({
        "action": "block",
        "stopReason": f"Validation failed: {specific_error_message}"
    }))
```

## Practice Exercise: Build a Comprehensive File Guard

Create a hook system that:
1. **Pre-hook**: Checks if files are in protected directories
2. **Pre-hook**: Validates file extensions are allowed
3. **Post-hook**: Backs up files after modification
4. **Post-hook**: Logs all changes with timestamps

<details>
<summary>Solution</summary>

**settings.json:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/file_guard.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/backup_files.sh"
          }
        ]
      }
    ]
  }
}
```

**file_guard.py:**
```python
#!/usr/bin/env python3
import json
import sys
import os

hook_input = json.loads(sys.stdin.read())
file_path = hook_input['tool_input']['file_path']

# Protected directories
protected_dirs = ['/etc', '/usr/bin', '/System']
blocked_extensions = ['.exe', '.dll', '.so']

# Check protected directories
for protected in protected_dirs:
    if file_path.startswith(protected):
        print(json.dumps({
            "action": "block",
            "stopReason": f"Cannot modify files in protected directory: {protected}"
        }))
        sys.exit(0)

# Check file extensions
_, ext = os.path.splitext(file_path)
if ext in blocked_extensions:
    print(json.dumps({
        "action": "block",
        "stopReason": f"Cannot modify {ext} files"
    }))
    sys.exit(0)

print(json.dumps({"action": "continue"}))
```

**backup_files.sh:**
```bash
#!/bin/bash
HOOK_INPUT=$(cat)
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path')
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/.claude/backups"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Copy file with timestamp
if [ -f "$FILE_PATH" ]; then
    BASENAME=$(basename "$FILE_PATH")
    cp "$FILE_PATH" "$BACKUP_DIR/${BASENAME}.${TIMESTAMP}.bak"
    echo "[$(date)] Backed up: $FILE_PATH" >> ~/.claude/backup.log
fi
```
</details>

## Performance Considerations

1. **Keep hooks fast**: Slow hooks delay Claude's responses
2. **Use async operations** when possible
3. **Cache expensive operations**
4. **Avoid network calls** in PreToolUse hooks

## Debugging Hooks

### Enable Debug Logging
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "tee ~/.claude/debug/$(date +%s).json | cat > /dev/null"
          }
        ]
      }
    ]
  }
}
```

### Test Hooks Independently
```bash
# Test your hook script with sample input
echo '{"tool_name":"Edit","tool_input":{"file_path":"/test.py"}}' | python3 ~/.claude/hooks/my_hook.py
```

## Summary

You've mastered:
- ✅ PreToolUse hooks for validation and control
- ✅ PostToolUse hooks for automation
- ✅ Advanced matcher patterns
- ✅ Hook input/output JSON structure
- ✅ Error handling and debugging

## Next Steps

In Lesson 3, we'll explore:
- Building sophisticated validation systems
- Creating approval workflows
- Advanced pattern matching
- Integration with external services

## Quick Reference

### PreToolUse Response Options
```json
{
  "action": "continue",      // Allow tool execution
  "action": "block",         // Block execution
  "stopReason": "message",   // Explain why blocked
  "suppressOutput": true     // Hide output from user
}
```

### Common Patterns
```bash
# Format after edit
"matcher": "Edit|Write|MultiEdit"

# Monitor all bash commands
"matcher": "Bash"

# Track all MCP operations
"matcher": "mcp__.*"

# Everything except reads
"matcher": "^(?!.*Read).*$"
```