# VSCode Extension for Claude Hooks

## Overview
A VSCode extension that provides a visual interface for managing Claude hooks, eliminating the need for manual file editing and command-line tools.

## Features

### 1. Visual Hook Editor
- **Sidebar Panel**: Dedicated Claude Hooks panel in VSCode
- **Drag-and-Drop Rules**: Visual rule builder with dropdowns and text fields
- **Live Preview**: See how rules affect sample commands in real-time
- **Syntax Highlighting**: Custom syntax highlighting for hook files

### 2. Hook Management UI

```
CLAUDE HOOKS                                    [+ Add Rule]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 PreToolUse                                          ▼
  ├─ 🛡️ Block dangerous commands               [✓] [✏️] [🗑️]
  ├─ 🔒 Prevent secrets exposure               [✓] [✏️] [🗑️]
  └─ ⚠️  Warn on production access             [ ] [✏️] [🗑️]
  
📁 PostToolUse                                         ▼
  └─ 📊 Log to analytics                       [✓] [✏️] [🗑️]

📁 Session History                                     ▼
  └─ 📄 View last 50 commands...
```

### 3. IntelliSense and Autocomplete
```typescript
// When typing in a hook file:
payload.tool_name === "B|"
                      ↓
                  [Bash    ]
                  [Build   ]
```

### 4. Testing and Debugging

- **Test Panel**: Input test commands and see which rules trigger
- **Debug Breakpoints**: Set breakpoints in hook code
- **Step Through**: Debug hook execution step-by-step
- **Mock Payloads**: Generate test payloads from actual Claude sessions

### 5. Session Viewer

```
SESSION VIEWER                         [🔍 Search] [📊 Stats]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2024-01-15 14:32:15 | PreToolUse  | Bash: npm install    ✅
2024-01-15 14:32:18 | PostToolUse | Bash: (success)      
2024-01-15 14:33:01 | PreToolUse  | Bash: rm -rf /       ❌
  └─ Blocked: "Dangerous command detected"
2024-01-15 14:33:45 | PreToolUse  | Edit: src/index.ts   ✅
```

## User Workflow

1. **Install Extension**: 
   ```
   ext install claude-hooks-manager
   ```

2. **Initialize via Command Palette**:
   - `Cmd+Shift+P` → "Claude: Initialize Hooks"
   - Visual wizard guides through setup

3. **Add Rules Visually**:
   - Click "+" button in sidebar
   - Select rule type from dropdown
   - Fill in pattern and action
   - Test immediately with sample data

4. **Monitor in Real-Time**:
   - See hooks trigger as you work with Claude
   - Get notifications for blocked commands
   - View session statistics

## Code Snippets and Templates

The extension includes snippets for common patterns:

```typescript
// Type "claude-hook-block" + Tab
${1:functionName}(payload: PreToolUsePayload): HookResponse {
  if (payload.tool_name === '${2:Bash}' && 
      payload.tool_input.command.includes('${3:pattern}')) {
    return {
      action: 'block',
      stopReason: '${4:reason}'
    };
  }
  return { action: 'continue' };
}
```

## Integration Features

- **Workspace Settings**: Store hook preferences in `.vscode/settings.json`
- **Multi-root Support**: Different hooks for different workspace folders
- **Source Control**: Visualize hook changes in git
- **Task Runner**: Run hook tests as VSCode tasks
- **Problem Matcher**: Show hook errors in Problems panel

## Benefits

1. **Visual Learning**: See hooks in action without reading docs
2. **Reduced Errors**: GUI prevents syntax errors
3. **Immediate Feedback**: Test changes without leaving VSCode
4. **Team Sharing**: Export/import hook configurations
5. **Discoverability**: Browse community hooks from extension