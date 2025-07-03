# Claude Settings Summary

## Quick Reference

The `.claude/settings.json` file configures Claude Code's hook system to execute commands on specific events.

## Current Configuration

All events are logged to `sessions.log`:

| Event | Purpose |
|-------|---------|
| **Notification** | When Claude sends notifications |
| **Stop** | When operations are stopped |
| **PreToolUse** | Before tool execution |
| **PostToolUse** | After tool execution |

## Structure

```json
{
  "hooks": {
    "<EventType>": [{
      "matcher": "<pattern>",
      "hooks": [{
        "type": "command",
        "command": "<shell command>"
      }]
    }]
  }
}
```

## Benefits
- Debug Claude behavior
- Track operation sequences  
- Monitor tool usage
- Create audit trails