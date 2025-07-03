# Declarative YAML Configuration for Claude Hooks

## Overview
Instead of writing TypeScript/JavaScript code, users define their hook behavior in a simple YAML configuration file. This approach makes hooks accessible to non-programmers and reduces the chance of errors.

## User Experience

Users create a `.claude/hooks.yaml` file:

```yaml
# .claude/hooks.yaml
version: 1.0

# Global settings
settings:
  sessionStorage: json  # json | sqlite | none
  sessionPath: ./sessions
  debug: true

# PreToolUse rules
pre_tool_use:
  - name: "Block dangerous commands"
    tool: Bash
    rules:
      - pattern: "rm -rf /"
        action: block
        reason: "Cannot delete root directory"
      - pattern: "rm -rf ~"
        action: block
        reason: "Cannot delete home directory"
  
  - name: "Protect production"
    tool: Bash
    rules:
      - pattern: "kubectl.*--context=production"
        action: confirm
        message: "This will affect production. Are you sure?"
  
  - name: "Secret detection"
    tool: "*"  # Applies to all tools
    rules:
      - pattern: "(api_key|password|secret)\\s*=\\s*[\"']\\w+[\"']"
        action: block
        reason: "Potential secret exposure detected"

# PostToolUse actions
post_tool_use:
  - name: "Log all commands"
    tool: Bash
    action: log
    format: "[{timestamp}] {tool_name}: {command}"
    
  - name: "Track file modifications"
    tool: [Edit, Write, MultiEdit]
    action: webhook
    url: "http://localhost:3000/file-changed"
    
# Notifications
notifications:
  - name: "Slack alerts"
    filter: "high-risk"
    action: webhook
    url: "${SLACK_WEBHOOK_URL}"
    
# Custom plugins
plugins:
  - name: git-guardian
    source: npm:@claude-hooks/git-guardian
    config:
      protectedBranches: [main, production]
      requireIssueNumber: true
```

## Benefits

1. **Zero Code**: No programming knowledge required
2. **Validation**: YAML schema validation prevents errors
3. **Portable**: Easy to share configurations between projects
4. **Environment Variables**: Support for env vars in configuration
5. **Hot Reload**: Changes take effect immediately

## CLI Commands

```bash
# Initialize with interactive YAML builder
$ npx claude-hooks init --yaml

# Validate configuration
$ npx claude-hooks validate

# Test rules against sample commands
$ npx claude-hooks test "rm -rf /tmp/test"
> Rule "Block dangerous commands" would: ALLOW

# Import community configurations
$ npx claude-hooks import security-strict
```

## Implementation

The system would:
1. Parse YAML on startup
2. Compile rules into efficient matchers
3. Generate TypeScript code behind the scenes
4. Support complex rule combinations with AND/OR logic
5. Provide helpful error messages for invalid patterns

## Advanced Features

```yaml
# Advanced rule with conditions
pre_tool_use:
  - name: "Time-based restrictions"
    tool: Bash
    conditions:
      - time: "00:00-06:00"
        timezone: "America/New_York"
      - days: [Saturday, Sunday]
    rules:
      - pattern: "deploy|migration|update"
        action: block
        reason: "Deployments not allowed during off-hours"

# Rule templates
templates:
  dangerous_file_ops: &dangerous_file_ops
    - pattern: "rm -rf"
    - pattern: "chmod 777"
    - pattern: "chown -R"

pre_tool_use:
  - name: "Server safety"
    tool: Bash
    when:
      environment: production
    rules:
      <<: *dangerous_file_ops
      action: block
```