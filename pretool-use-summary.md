# PreToolUse Hooks Summary

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

PreToolUse hooks provide powerful control over Claude's tool usage, enabling security, compliance, and workflow automation while maintaining system safety.