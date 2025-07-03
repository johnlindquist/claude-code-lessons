# Claude Settings Configuration

## Overview

The `.claude/settings.json` file contains configuration for Claude Code's hook system. This file defines commands that execute in response to various Claude Code events.

## Structure

The settings file uses a hooks-based system with the following structure:

```json
{
  "hooks": {
    "<EventType>": [
      {
        "matcher": "<pattern>",
        "hooks": [
          {
            "type": "command",
            "command": "<shell command>"
          }
        ]
      }
    ]
  }
}
```

## Configured Hooks

Your current configuration logs all major Claude Code events to a `sessions.log` file:

### 1. Notification Hook
- Event: `Notification`
- Action: Logs "Notification" to `./sessions.log`
- Purpose: Tracks when Claude Code sends notifications

### 2. Stop Hook
- Event: `Stop`
- Action: Logs "Stop" to `./sessions.log`
- Purpose: Tracks when Claude Code operations are stopped

### 3. PreToolUse Hook
- Event: `PreToolUse`
- Action: Logs "PreToolUse" to `./sessions.log`
- Purpose: Tracks when Claude Code is about to use a tool

### 4. PostToolUse Hook
- Event: `PostToolUse`
- Action: Logs "PostToolUse" to `./sessions.log`
- Purpose: Tracks when Claude Code has finished using a tool

## Implementation Details

- All hooks use empty matchers (`""`), meaning they trigger for all events of their type
- Each hook executes a simple echo command that appends the event name to `sessions.log`
- The log file path is relative to the current working directory

## Use Case

This configuration creates a simple event log that tracks Claude Code's activity, useful for:
- Debugging Claude Code behavior
- Understanding the sequence of operations
- Monitoring tool usage patterns
- Creating audit trails of Claude Code sessions