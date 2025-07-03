# Lesson 3: Advanced Hook Patterns and Validation

## Learning Objectives
By the end of this lesson, you will:
- Build sophisticated validation and security systems
- Master complex matcher patterns and regex
- Create approval workflows with user interaction
- Implement advanced error handling and recovery
- Build reusable hook libraries

## Advanced Validation Strategies

### Multi-Layer Security Model

Instead of simple allow/block decisions, implement defense in depth:

```python
#!/usr/bin/env python3
# ~/.claude/hooks/security_framework.py

import json
import sys
import re
import os
from datetime import datetime
from pathlib import Path

class SecurityValidator:
    def __init__(self):
        self.hook_input = json.loads(sys.stdin.read())
        self.tool_name = self.hook_input['tool_name']
        self.tool_input = self.hook_input['tool_input']
        self.risk_score = 0
        self.warnings = []
        
    def validate(self):
        """Main validation entry point"""
        validators = {
            'Bash': self.validate_bash_command,
            'Edit': self.validate_file_operation,
            'Write': self.validate_file_operation,
            'MultiEdit': self.validate_file_operation
        }
        
        if self.tool_name in validators:
            validators[self.tool_name]()
        
        return self.make_decision()
    
    def validate_bash_command(self):
        """Validate bash commands"""
        command = self.tool_input.get('command', '')
        
        # Check for sudo
        if 'sudo' in command:
            self.risk_score += 50
            self.warnings.append("Command uses sudo privileges")
        
        # Check for system directories
        system_dirs = ['/etc', '/usr', '/bin', '/sbin', '/var']
        for dir in system_dirs:
            if dir in command:
                self.risk_score += 30
                self.warnings.append(f"Command affects system directory: {dir}")
        
        # Check for dangerous commands
        dangerous_patterns = {
            r'rm\s+-rf': (100, "Recursive force deletion detected"),
            r'dd\s+if=': (80, "Direct disk write detected"),
            r'chmod\s+777': (40, "Insecure permissions detected"),
            r'curl.*\|.*sh': (90, "Remote code execution pattern detected"),
            r'wget.*\|.*bash': (90, "Remote code execution pattern detected")
        }
        
        for pattern, (score, warning) in dangerous_patterns.items():
            if re.search(pattern, command):
                self.risk_score += score
                self.warnings.append(warning)
    
    def validate_file_operation(self):
        """Validate file operations"""
        file_path = self.tool_input.get('file_path', '')
        
        # Check file location risk
        if file_path.startswith('/'):
            path_parts = Path(file_path).parts
            
            # System files
            if len(path_parts) > 1 and path_parts[1] in ['etc', 'usr', 'bin']:
                self.risk_score += 70
                self.warnings.append("Modifying system file")
            
            # Home directory configs
            if '/.ssh/' in file_path or '/.aws/' in file_path:
                self.risk_score += 80
                self.warnings.append("Modifying sensitive configuration")
        
        # Check file extensions
        risky_extensions = {
            '.sh': (30, "Modifying shell script"),
            '.py': (20, "Modifying Python script"),
            '.js': (20, "Modifying JavaScript"),
            '.env': (60, "Modifying environment file"),
            '.key': (90, "Modifying key file"),
            '.pem': (90, "Modifying certificate")
        }
        
        ext = Path(file_path).suffix.lower()
        if ext in risky_extensions:
            score, warning = risky_extensions[ext]
            self.risk_score += score
            self.warnings.append(warning)
    
    def make_decision(self):
        """Make final decision based on risk score"""
        decision = {"action": "continue"}
        
        if self.risk_score >= 100:
            decision = {
                "action": "block",
                "stopReason": f"High risk operation blocked (risk score: {self.risk_score}). Warnings: " + "; ".join(self.warnings)
            }
        elif self.risk_score >= 50:
            # Log high-risk operations
            self.log_operation("HIGH_RISK")
            decision["warnings"] = self.warnings
        elif self.risk_score > 0:
            # Log medium-risk operations
            self.log_operation("MEDIUM_RISK")
        
        return decision
    
    def log_operation(self, risk_level):
        """Log operations for audit trail"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "risk_level": risk_level,
            "risk_score": self.risk_score,
            "tool": self.tool_name,
            "input": self.tool_input,
            "warnings": self.warnings
        }
        
        log_file = Path.home() / '.claude' / 'security_audit.jsonl'
        log_file.parent.mkdir(exist_ok=True)
        
        with open(log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')

# Main execution
validator = SecurityValidator()
result = validator.validate()
print(json.dumps(result))
```

## Complex Matcher Patterns

### Regex Mastery for Hooks

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^(?!.*Read).*$",
        "hooks": [{
          "type": "command",
          "command": "echo 'Non-read operation'"
        }]
      },
      {
        "matcher": "Edit|.*Edit$",
        "hooks": [{
          "type": "command",
          "command": "echo 'Any edit operation'"
        }]
      },
      {
        "matcher": "mcp__[^_]+__(?!list_).*",
        "hooks": [{
          "type": "command",
          "command": "echo 'MCP write operation'"
        }]
      }
    ]
  }
}
```

### Matcher Precedence and Ordering

Hooks execute in order, so you can create cascading rules:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "~/.claude/hooks/check_sudo.sh"
        }]
      },
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "~/.claude/hooks/check_network.sh"
        }]
      },
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "~/.claude/hooks/final_approval.sh"
        }]
      }
    ]
  }
}
```

## Interactive Approval Workflows

### Building a Command Approval System

```bash
#!/bin/bash
# ~/.claude/hooks/interactive_approval.sh

HOOK_INPUT=$(cat)
COMMAND=$(echo "$HOOK_INPUT" | jq -r '.tool_input.command')
RISK_LEVEL="LOW"

# Determine risk level
if echo "$COMMAND" | grep -qE "(sudo|rm -rf|chmod 777)"; then
    RISK_LEVEL="HIGH"
elif echo "$COMMAND" | grep -qE "(pip install|npm install|apt-get)"; then
    RISK_LEVEL="MEDIUM"
fi

# For high-risk commands, require approval
if [ "$RISK_LEVEL" = "HIGH" ]; then
    # Create approval request
    APPROVAL_FILE="/tmp/claude_approval_$(date +%s).txt"
    cat > "$APPROVAL_FILE" << EOF
CLAUDE CODE APPROVAL REQUEST
==========================
Risk Level: $RISK_LEVEL
Command: $COMMAND
Timestamp: $(date)

Do you approve this command? (yes/no)
EOF

    # Use platform-specific notification
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "display dialog \"$(cat $APPROVAL_FILE)\" buttons {\"Deny\", \"Approve\"} default button \"Deny\""
        RESULT=$?
    else
        # Linux - use zenity or notify-send
        zenity --question --text="$(cat $APPROVAL_FILE)"
        RESULT=$?
    fi
    
    rm -f "$APPROVAL_FILE"
    
    if [ $RESULT -ne 0 ]; then
        echo '{"action": "block", "stopReason": "User denied high-risk command"}'
        exit 0
    fi
fi

echo '{"action": "continue"}'
```

## Advanced Error Handling

### Resilient Hook Framework

```python
#!/usr/bin/env python3
# ~/.claude/hooks/resilient_hook.py

import json
import sys
import traceback
import logging
from pathlib import Path

# Setup logging
log_dir = Path.home() / '.claude' / 'logs'
log_dir.mkdir(exist_ok=True)
logging.basicConfig(
    filename=log_dir / 'hooks.log',
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class ResilientHook:
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        
    def run(self):
        try:
            # Parse input
            hook_input = self.safe_parse_input()
            if not hook_input:
                return self.safe_continue()
            
            # Process hook logic
            result = self.process(hook_input)
            
            # Ensure valid response
            return self.validate_response(result)
            
        except Exception as e:
            # Log error but don't block Claude
            self.logger.error(f"Hook error: {str(e)}\n{traceback.format_exc()}")
            return self.safe_continue()
    
    def safe_parse_input(self):
        """Safely parse JSON input"""
        try:
            return json.loads(sys.stdin.read())
        except:
            self.logger.error("Failed to parse input")
            return None
    
    def process(self, hook_input):
        """Override this method in subclasses"""
        raise NotImplementedError
    
    def validate_response(self, response):
        """Ensure response is valid JSON"""
        if isinstance(response, dict):
            # Validate required fields
            if 'action' in response:
                return response
        return self.safe_continue()
    
    def safe_continue(self):
        """Default safe response"""
        return {"action": "continue"}

# Example implementation
class FileValidator(ResilientHook):
    def process(self, hook_input):
        file_path = hook_input.get('tool_input', {}).get('file_path', '')
        
        # Your validation logic here
        if self.is_protected_file(file_path):
            return {
                "action": "block",
                "stopReason": f"Protected file: {file_path}"
            }
        
        return {"action": "continue"}
    
    def is_protected_file(self, file_path):
        protected_patterns = [
            '/.ssh/',
            '/.aws/',
            '/etc/passwd',
            '/etc/shadow'
        ]
        return any(pattern in file_path for pattern in protected_patterns)

# Main execution
if __name__ == "__main__":
    hook = FileValidator()
    result = hook.run()
    print(json.dumps(result))
```

## Building Hook Libraries

### Creating Reusable Components

```python
# ~/.claude/hooks/lib/validators.py

import re
from typing import Dict, List, Tuple

class CommandValidator:
    """Reusable command validation patterns"""
    
    DANGEROUS_PATTERNS = [
        (r'rm\s+-rf\s+/', "Dangerous recursive deletion"),
        (r':\(\)\{.*\|\:&\s*\};:', "Fork bomb detected"),
        (r'mkfs', "Filesystem format command"),
        (r'dd\s+if=/dev/(zero|random)', "Disk overwrite pattern")
    ]
    
    SUSPICIOUS_PATTERNS = [
        (r'curl.*\|.*sh', "Remote code execution"),
        (r'eval\s*\(', "Dynamic code evaluation"),
        (r'base64\s+-d.*\|', "Base64 decode pipe")
    ]
    
    @classmethod
    def check_dangerous(cls, command: str) -> List[str]:
        """Check for dangerous patterns"""
        warnings = []
        for pattern, description in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                warnings.append(description)
        return warnings
    
    @classmethod
    def check_suspicious(cls, command: str) -> List[str]:
        """Check for suspicious patterns"""
        warnings = []
        for pattern, description in cls.SUSPICIOUS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                warnings.append(description)
        return warnings

class FileValidator:
    """Reusable file validation patterns"""
    
    PROTECTED_PATHS = [
        '/etc',
        '/usr/bin',
        '/System',
        '/.ssh',
        '/.aws'
    ]
    
    SENSITIVE_EXTENSIONS = {
        '.key': 'Private key file',
        '.pem': 'Certificate file',
        '.env': 'Environment configuration',
        '.crt': 'Certificate file',
        '.p12': 'Certificate bundle'
    }
    
    @classmethod
    def is_protected_path(cls, path: str) -> bool:
        """Check if path is protected"""
        return any(path.startswith(p) for p in cls.PROTECTED_PATHS)
    
    @classmethod
    def get_sensitivity(cls, path: str) -> str:
        """Get file sensitivity description"""
        for ext, description in cls.SENSITIVE_EXTENSIONS.items():
            if path.endswith(ext):
                return description
        return None
```

### Using Hook Libraries

```python
#!/usr/bin/env python3
# ~/.claude/hooks/smart_validator.py

import json
import sys
import os
sys.path.append(os.path.expanduser('~/.claude/hooks/lib'))

from validators import CommandValidator, FileValidator

def main():
    hook_input = json.loads(sys.stdin.read())
    tool_name = hook_input['tool_name']
    tool_input = hook_input['tool_input']
    
    if tool_name == 'Bash':
        command = tool_input.get('command', '')
        
        # Check dangerous patterns
        dangerous = CommandValidator.check_dangerous(command)
        if dangerous:
            return {
                "action": "block",
                "stopReason": f"Dangerous command blocked: {', '.join(dangerous)}"
            }
        
        # Check suspicious patterns
        suspicious = CommandValidator.check_suspicious(command)
        if suspicious:
            # Log but allow with warning
            print(f"Warning: {', '.join(suspicious)}", file=sys.stderr)
    
    elif tool_name in ['Edit', 'Write']:
        file_path = tool_input.get('file_path', '')
        
        if FileValidator.is_protected_path(file_path):
            return {
                "action": "block",
                "stopReason": f"Cannot modify protected path: {file_path}"
            }
        
        sensitivity = FileValidator.get_sensitivity(file_path)
        if sensitivity:
            # Could prompt for confirmation here
            print(f"Warning: Modifying {sensitivity}", file=sys.stderr)
    
    return {"action": "continue"}

if __name__ == "__main__":
    result = main()
    print(json.dumps(result))
```

## State Management Across Hooks

### Session Context Manager

```python
#!/usr/bin/env python3
# ~/.claude/hooks/lib/session.py

import json
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, Optional

class HookSession:
    """Manage state across hook invocations"""
    
    def __init__(self):
        self.db_path = Path.home() / '.claude' / 'hook_state.db'
        self.db_path.parent.mkdir(exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """Initialize the database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS hook_state (
                    conversation_id TEXT,
                    key TEXT,
                    value TEXT,
                    timestamp DATETIME,
                    PRIMARY KEY (conversation_id, key)
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS command_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT,
                    command TEXT,
                    timestamp DATETIME,
                    risk_score INTEGER
                )
            ''')
    
    def set(self, conversation_id: str, key: str, value: Any):
        """Store a value for the conversation"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO hook_state (conversation_id, key, value, timestamp) VALUES (?, ?, ?, ?)",
                (conversation_id, key, json.dumps(value), datetime.utcnow())
            )
    
    def get(self, conversation_id: str, key: str) -> Optional[Any]:
        """Retrieve a value for the conversation"""
        with sqlite3.connect(self.db_path) as conn:
            result = conn.execute(
                "SELECT value FROM hook_state WHERE conversation_id = ? AND key = ?",
                (conversation_id, key)
            ).fetchone()
            
            if result:
                return json.loads(result[0])
            return None
    
    def add_command(self, conversation_id: str, command: str, risk_score: int = 0):
        """Add command to history"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO command_history (conversation_id, command, timestamp, risk_score) VALUES (?, ?, ?, ?)",
                (conversation_id, command, datetime.utcnow(), risk_score)
            )
    
    def get_command_count(self, conversation_id: str) -> int:
        """Get count of commands in this conversation"""
        with sqlite3.connect(self.db_path) as conn:
            result = conn.execute(
                "SELECT COUNT(*) FROM command_history WHERE conversation_id = ?",
                (conversation_id,)
            ).fetchone()
            return result[0] if result else 0

# Example usage in a hook
def stateful_hook():
    hook_input = json.loads(sys.stdin.read())
    conversation_id = hook_input.get('conversation_id', 'default')
    
    session = HookSession()
    
    # Track command frequency
    command_count = session.get_command_count(conversation_id)
    if command_count > 50:
        return {
            "action": "block",
            "stopReason": f"Too many commands in session ({command_count}). Please start a new session."
        }
    
    # Store command
    if hook_input['tool_name'] == 'Bash':
        command = hook_input['tool_input']['command']
        session.add_command(conversation_id, command)
    
    return {"action": "continue"}
```

## Practice Exercise: Build a Complete Validation System

Create a comprehensive validation system that:
1. Implements risk scoring for all operations
2. Maintains audit logs with search capability
3. Provides real-time notifications for high-risk operations
4. Includes a web dashboard for monitoring

<details>
<summary>Solution Framework</summary>

```python
# ~/.claude/hooks/validation_system.py

import json
import sys
import sqlite3
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List
import subprocess

class ValidationSystem:
    def __init__(self):
        self.base_dir = Path.home() / '.claude' / 'validation'
        self.base_dir.mkdir(exist_ok=True)
        self.db_path = self.base_dir / 'audit.db'
        self._init_database()
        
    def _init_database(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS audit_log (
                    id TEXT PRIMARY KEY,
                    timestamp DATETIME,
                    conversation_id TEXT,
                    tool_name TEXT,
                    risk_score INTEGER,
                    action TEXT,
                    details TEXT
                )
            ''')
    
    def validate_operation(self, hook_input: Dict) -> Dict:
        # Calculate risk score
        risk_score = self.calculate_risk(hook_input)
        
        # Log operation
        self.log_operation(hook_input, risk_score)
        
        # Make decision based on risk
        if risk_score >= 80:
            self.send_alert(hook_input, risk_score)
            return {
                "action": "block",
                "stopReason": f"High-risk operation (score: {risk_score})"
            }
        elif risk_score >= 50:
            self.send_notification(hook_input, risk_score)
        
        return {"action": "continue"}
    
    def calculate_risk(self, hook_input: Dict) -> int:
        # Implement comprehensive risk calculation
        risk_score = 0
        tool_name = hook_input['tool_name']
        
        # Tool-specific risk calculation
        if tool_name == 'Bash':
            risk_score += self._bash_risk(hook_input['tool_input'])
        elif tool_name in ['Edit', 'Write']:
            risk_score += self._file_risk(hook_input['tool_input'])
        
        return min(risk_score, 100)
    
    def _bash_risk(self, tool_input: Dict) -> int:
        # Implement bash command risk scoring
        command = tool_input.get('command', '')
        score = 0
        
        # Add your risk patterns here
        risk_patterns = {
            'sudo': 30,
            'rm -rf': 50,
            'chmod 777': 40,
            'curl | sh': 80
        }
        
        for pattern, points in risk_patterns.items():
            if pattern in command:
                score += points
        
        return score
    
    def _file_risk(self, tool_input: Dict) -> int:
        # Implement file operation risk scoring
        file_path = tool_input.get('file_path', '')
        score = 0
        
        if file_path.startswith('/etc'):
            score += 60
        elif '/.ssh/' in file_path:
            score += 80
        
        return score
    
    def log_operation(self, hook_input: Dict, risk_score: int):
        operation_id = hashlib.sha256(
            json.dumps(hook_input).encode()
        ).hexdigest()[:16]
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO audit_log 
                (id, timestamp, conversation_id, tool_name, risk_score, action, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                operation_id,
                datetime.utcnow(),
                hook_input.get('conversation_id', 'unknown'),
                hook_input['tool_name'],
                risk_score,
                'allowed' if risk_score < 80 else 'blocked',
                json.dumps(hook_input)
            ))
    
    def send_notification(self, hook_input: Dict, risk_score: int):
        # Platform-specific notification
        message = f"Claude Code: Medium risk operation (score: {risk_score})"
        
        if sys.platform == 'darwin':
            subprocess.run([
                'osascript', '-e',
                f'display notification "{message}" with title "Claude Code Hook"'
            ])
        elif sys.platform.startswith('linux'):
            subprocess.run([
                'notify-send', 'Claude Code Hook', message
            ])
    
    def send_alert(self, hook_input: Dict, risk_score: int):
        # Send high-priority alert
        self.send_notification(hook_input, risk_score)
        # Could also send to Slack, email, etc.

# Main execution
if __name__ == "__main__":
    validator = ValidationSystem()
    hook_input = json.loads(sys.stdin.read())
    result = validator.validate_operation(hook_input)
    print(json.dumps(result))
```
</details>

## Performance Optimization

### Async Hook Processing

```bash
#!/bin/bash
# ~/.claude/hooks/async_processor.sh

HOOK_INPUT=$(cat)

# Process in background for non-critical operations
{
    echo "$HOOK_INPUT" | python3 ~/.claude/hooks/log_processor.py
    echo "$HOOK_INPUT" | python3 ~/.claude/hooks/metrics_collector.py
} &

# Critical validation runs synchronously
echo "$HOOK_INPUT" | python3 ~/.claude/hooks/security_validator.py
```

## Summary

You've learned:
- ✅ Building sophisticated validation systems
- ✅ Complex pattern matching with regex
- ✅ Interactive approval workflows
- ✅ State management across hooks
- ✅ Creating reusable hook libraries

## Next Steps

In Lesson 4, we'll explore:
- Notification hooks for custom alerts
- Stop hooks for cleanup operations
- Integration with external services
- Building comprehensive monitoring

## Advanced Tips

1. **Use SQLite for state**: Better than flat files for complex queries
2. **Implement circuit breakers**: Prevent hook cascade failures
3. **Version your hooks**: Use git to track hook changes
4. **Test with mock data**: Don't test hooks in production
5. **Monitor hook performance**: Log execution times