# Natural Language Hook Configuration

## Overview
Configure Claude hooks using natural language instructions instead of code or configuration files. Claude itself helps you set up the hooks by understanding your requirements in plain English.

## User Experience

```bash
$ npx claude-hooks chat

🤖 Claude Hooks Assistant: Hi! I'll help you set up your hooks. 
   What would you like me to help you with?

You: I want to prevent any dangerous file deletions and also log all 
     database queries for debugging

🤖 Got it! I'll set up two things for you:
   1. Block dangerous file deletion commands
   2. Log all database-related commands
   
   Here's what I'm thinking:
   
   For dangerous deletions, I'll block:
   - rm -rf on system directories (/, /etc, /usr, etc.)
   - Recursive deletions in home directory
   - Any file operations with sudo rm
   
   For database logging, I'll capture:
   - SQL queries (SELECT, INSERT, UPDATE, DELETE)
   - Database CLI commands (mysql, psql, mongo)
   - Migration commands
   
   Does this sound good? Any specific patterns you want to add?

You: Also block any commands that might expose AWS credentials

🤖 Perfect! I'll add protection for AWS credentials. I'll block:
   - Commands containing AWS access keys or secret keys
   - Echo/cat commands on ~/.aws/credentials
   - Environment variable exports with AWS_* patterns
   - curl/wget commands that might leak credentials
   
   I'm generating your hooks now... Done! ✅
   
   Your hooks are configured and active. Here's a summary:
   
   📁 .claude/hooks/
   ├── index.ts (3 protection rules)
   ├── lib.ts (core functionality)
   └── rules/
       ├── dangerous-deletions.json
       ├── database-logging.json
       └── aws-credential-protection.json
   
   Would you like to test any of these rules?

You: test rm -rf /home/user/documents

🤖 Testing command: "rm -rf /home/user/documents"
   
   ❌ BLOCKED by rule: "Prevent home directory deletion"
   Reason: "Recursive deletion in home directory detected"
   
   This command would be prevented from executing.
```

## Advanced Interactions

### Learning from Examples

```
You: Here are some commands I want to allow and block:

ALLOW:
- rm single-file.txt
- rm -rf node_modules
- rm -rf .cache

BLOCK:
- rm -rf ~/important
- sudo rm -rf anything
- rm -rf ../

🤖 I understand the pattern! You want to:
   ✅ Allow removal of temporary/generated files
   ✅ Allow removal of specific known directories
   ❌ Block removal of important user directories
   ❌ Block any sudo deletions
   ❌ Block parent directory deletions
   
   I've updated your rules accordingly.
```

### Contextual Understanding

```
You: We're working on a medical app, so we need HIPAA compliance

🤖 I'll configure HIPAA-compliant hooks for your medical app:
   
   1. PHI Protection:
      - Block commands that might output patient data
      - Prevent unencrypted file transfers
      - Log all data access for audit trails
   
   2. Access Controls:
      - Require confirmation for database queries
      - Block direct production database access
      - Alert on bulk data exports
   
   3. Audit Logging:
      - Log all file access with timestamps
      - Track user actions for compliance
      - Generate daily audit reports
   
   I've also added these compliance features:
   - Automatic session encryption
   - 30-day audit log retention
   - HIPAA-compliant logging format
```

## Implementation Features

### 1. Intent Recognition
The system understands various ways to express the same need:
- "Don't let me delete important files"
- "Prevent accidental file removal"  
- "Stop rm -rf accidents"
- "Protect against dangerous deletions"

All map to the same protection rules.

### 2. Smart Suggestions

```
You: I want to improve security

🤖 Based on your project (Node.js + PostgreSQL), here are my suggestions:

   🛡️ Security Recommendations:
   1. Block SQL injection patterns in queries
   2. Prevent npm package installation from unknown registries  
   3. Alert on suspicious network requests
   4. Protect .env file access
   5. Monitor for hardcoded secrets
   
   Would you like me to enable all of these? [Y/n]
```

### 3. Rule Explanation

```
You: Why was my command blocked?

🤖 Your command "psql -c 'DROP DATABASE prod'" was blocked because:
   
   📏 Rule: "Protect production databases"
   🎯 Pattern: /DROP\s+DATABASE.*prod/i
   💡 Reason: Prevents accidental production data loss
   
   This rule was added when you said "protect production data"
   
   To allow this specific command, you can:
   1. Add an exception for this pattern
   2. Require confirmation instead of blocking
   3. Temporarily disable the rule
   
   What would you prefer?
```

## Benefits

1. **No Learning Curve**: Explain needs in plain English
2. **Intelligent Defaults**: AI suggests relevant protections
3. **Context Aware**: Understands your project type and needs
4. **Interactive Refinement**: Clarify and adjust in real-time
5. **Self-Documenting**: Natural language becomes documentation

## Future Possibilities

- **Voice Configuration**: "Hey Claude, block any command that touches production"
- **Team Knowledge**: Learn from team's historical patterns
- **Proactive Suggestions**: "I noticed you're using Docker, want container protections?"
- **Integration with Claude Code**: "Claude, update my hooks to prevent the issue we just discussed"