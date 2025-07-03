# Claude Code Hooks Summary: PreToolUse & PostToolUse

This document provides a comprehensive overview of both PreToolUse and PostToolUse hooks in Claude Code, which together form a powerful system for controlling and monitoring tool usage.

---

# PreToolUse Hooks

PreToolUse hooks are user-defined commands that execute before Claude uses any tool, acting as gatekeepers for tool execution.

## Core Functionality

PreToolUse hooks:
- Execute **before** any tool is used (Bash, Edit, Write, Read, etc.)
- Receive JSON input via stdin containing tool name and parameters
- Can allow, block, or modify tool execution through JSON responses
- Run with full system permissions

## Hook Response Format

```json
{
  "action": "continue" | "block",
  "stopReason": "Explanation why blocked",
  "suppressOutput": true | false
}
```

- `action`: Controls whether tool executes
- `stopReason`: Message shown to Claude when blocked
- `suppressOutput`: Hides output from user

## Common Use Cases

1. **Security Validation**
   - Block dangerous commands (rm -rf /, fork bombs)
   - Protect system directories
   - Validate file paths and permissions

2. **Compliance & Control**
   - Enforce rate limits
   - Require approval for sensitive operations
   - Audit trail logging

3. **Workflow Integration**
   - Trigger notifications
   - Update external systems
   - Track metrics and usage

## Configuration Example

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/validate.py"
          }
        ]
      }
    ]
  }
}
```

## Matcher Patterns

- Exact: `"Bash"` - matches only Bash tool
- Multiple: `"Edit|Write"` - matches either tool
- Wildcard: `".*"` - matches all tools
- Regex: `"Notebook.*"` - matches NotebookEdit, NotebookRead
- Negative: `"^(?!.*Read).*$"` - everything except Read tools

## Best Practices

1. Keep hooks fast to avoid delays
2. Always return valid JSON
3. Provide clear stopReason messages
4. Handle errors gracefully (default to continue)
5. Test hooks independently before deployment
6. Log decisions for security audits

## Example: Dangerous Command Blocker

```python
#!/usr/bin/env python3
import json
import sys
import re

hook_input = json.loads(sys.stdin.read())

if hook_input['tool_name'] == 'Bash':
    command = hook_input['tool_input']['command']
    
    if re.search(r'rm\s+-rf\s+/', command):
        print(json.dumps({
            "action": "block",
            "stopReason": "Dangerous command: rm -rf / detected"
        }))
        sys.exit(0)

print(json.dumps({"action": "continue"}))
```

---

# PostToolUse Hooks

PostToolUse hooks are user-defined commands that execute after Claude completes any tool operation, enabling response processing and workflow automation.

## Core Functionality

PostToolUse hooks:
- Execute **after** any tool completes (Bash, Edit, Write, Read, etc.)
- Receive JSON input via stdin containing tool name, parameters, and results
- Can process, log, or trigger actions based on tool outcomes
- Cannot modify the tool's result shown to Claude

## Hook Input Format

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  },
  "tool_output": {
    "stdout": "All tests passed",
    "exit_code": 0
  }
}
```

## Common Use Cases

1. **Logging & Auditing**
   - Track all file modifications
   - Log command executions with results
   - Create audit trails for compliance

2. **Notifications & Alerts**
   - Send alerts on test failures
   - Notify on file changes
   - Report errors to monitoring systems

3. **Workflow Automation**
   - Auto-commit after file edits
   - Trigger CI/CD on code changes
   - Update project documentation

## Configuration Example

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/log-changes.py"
          }
        ]
      }
    ]
  }
}
```

## Key Differences from PreToolUse

| PreToolUse | PostToolUse |
|------------|-------------|
| Can block execution | Cannot affect result |
| No access to results | Full access to output |
| Security gatekeeper | Process automation |
| Validation focus | Logging/workflow focus |

## Best Practices

1. Never block or delay Claude's workflow
2. Handle errors silently (log, don't crash)
3. Keep processing asynchronous when possible
4. Don't modify files Claude just edited
5. Use for non-critical automation only
6. Consider system load when triggering actions

## Example: Test Result Logger

```python
#!/usr/bin/env python3
import json
import sys
from datetime import datetime

hook_input = json.loads(sys.stdin.read())

if hook_input['tool_name'] == 'Bash':
    command = hook_input['tool_input']['command']
    if 'test' in command or 'spec' in command:
        result = hook_input['tool_output']
        with open('test-results.log', 'a') as f:
            f.write(f"{datetime.now()}: {command} - Exit: {result.get('exit_code', 'N/A')}\n")
```

PostToolUse hooks complement PreToolUse hooks by providing post-execution processing capabilities, enabling comprehensive workflow automation while maintaining system stability.

---

# Complete Hook Ecosystem

## Working Together

PreToolUse and PostToolUse hooks work in tandem:
1. **PreToolUse**: Validates and controls tool execution
2. **Tool Execution**: Claude performs the requested operation
3. **PostToolUse**: Processes results and triggers automation

## Combined Example: File Edit Workflow

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/validate-edit.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/log-and-backup.py"
          }
        ]
      }
    ]
  }
}
```

This configuration:
- **PreToolUse**: Validates file edits before they happen
- **PostToolUse**: Creates backups and logs changes after completion

## Summary

Claude Code's hook system provides a flexible, powerful way to:
- **Secure** your system with PreToolUse validation
- **Automate** workflows with PostToolUse processing
- **Monitor** all tool usage for compliance and debugging
- **Integrate** with existing tools and processes

By combining both hook types, you can create sophisticated workflows that maintain security while enabling automation.