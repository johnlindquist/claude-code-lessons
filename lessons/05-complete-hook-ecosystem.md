# Lesson 5: Building a Complete Hook Ecosystem

## Learning Objectives
By the end of this lesson, you will:
- Design and implement production-ready hook configurations
- Build modular, maintainable hook systems
- Create team-friendly hook environments
- Implement advanced monitoring and analytics
- Master troubleshooting and performance optimization

## Architecting a Production Hook System

### Directory Structure

```bash
~/.claude/
├── settings.json          # Main configuration
├── hooks/                 # Hook scripts
│   ├── lib/              # Shared libraries
│   │   ├── validators.py
│   │   ├── notifiers.py
│   │   ├── database.py
│   │   └── utils.py
│   ├── pre/              # PreToolUse hooks
│   │   ├── security.py
│   │   ├── validation.py
│   │   └── logging.sh
│   ├── post/             # PostToolUse hooks
│   │   ├── formatter.py
│   │   ├── linter.sh
│   │   └── git_auto.py
│   ├── notification/     # Notification hooks
│   │   └── multi_channel.py
│   └── stop/            # Stop hooks
│       ├── reporter.py
│       └── cleanup.sh
├── config/              # Additional configurations
│   ├── security_rules.yaml
│   ├── format_rules.json
│   └── notification_prefs.ini
├── logs/                # Centralized logging
├── reports/             # Generated reports
└── data/               # Persistent data storage
```

## Complete Hook Configuration

### Master settings.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/lib/rate_limiter.py"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/pre/security.py"
          },
          {
            "type": "command",
            "command": "~/.claude/hooks/pre/logging.sh"
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/pre/validation.py"
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
            "command": "python3 ~/.claude/hooks/post/formatter.py"
          },
          {
            "type": "command",
            "command": "~/.claude/hooks/post/linter.sh"
          }
        ]
      },
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/lib/metrics_collector.py"
          }
        ]
      }
    ],
    "Notification": [
      {
        "type": "command",
        "command": "python3 ~/.claude/hooks/notification/multi_channel.py"
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "python3 ~/.claude/hooks/stop/reporter.py"
      },
      {
        "type": "command",
        "command": "~/.claude/hooks/stop/cleanup.sh"
      }
    ]
  }
}
```

## Core Library Components

### Database Manager

```python
# ~/.claude/hooks/lib/database.py

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager
from typing import Any, Dict, List, Optional
import threading

class HookDatabase:
    """Thread-safe database manager for hooks"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.db_path = Path.home() / '.claude' / 'data' / 'hooks.db'
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self._init_schema()
            self.initialized = True
    
    def _init_schema(self):
        """Initialize database schema"""
        with self.connection() as conn:
            # Operations log
            conn.execute('''
                CREATE TABLE IF NOT EXISTS operations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    conversation_id TEXT,
                    request_id TEXT,
                    tool_name TEXT,
                    tool_input TEXT,
                    risk_score INTEGER,
                    action TEXT,
                    details TEXT
                )
            ''')
            
            # Metrics
            conn.execute('''
                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metric_name TEXT,
                    metric_value REAL,
                    tags TEXT
                )
            ''')
            
            # Session state
            conn.execute('''
                CREATE TABLE IF NOT EXISTS session_state (
                    conversation_id TEXT PRIMARY KEY,
                    state TEXT,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create indexes
            conn.execute('CREATE INDEX IF NOT EXISTS idx_operations_conversation ON operations(conversation_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_operations_timestamp ON operations(timestamp)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name)')
    
    @contextmanager
    def connection(self):
        """Thread-safe database connection"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def log_operation(self, operation_data: Dict[str, Any]):
        """Log an operation"""
        with self.connection() as conn:
            conn.execute('''
                INSERT INTO operations 
                (conversation_id, request_id, tool_name, tool_input, risk_score, action, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                operation_data.get('conversation_id'),
                operation_data.get('request_id'),
                operation_data.get('tool_name'),
                json.dumps(operation_data.get('tool_input', {})),
                operation_data.get('risk_score', 0),
                operation_data.get('action', 'continue'),
                json.dumps(operation_data.get('details', {}))
            ))
    
    def record_metric(self, name: str, value: float, tags: Dict[str, str] = None):
        """Record a metric"""
        with self.connection() as conn:
            conn.execute(
                "INSERT INTO metrics (metric_name, metric_value, tags) VALUES (?, ?, ?)",
                (name, value, json.dumps(tags or {}))
            )
    
    def get_session_state(self, conversation_id: str) -> Optional[Dict]:
        """Get session state"""
        with self.connection() as conn:
            result = conn.execute(
                "SELECT state FROM session_state WHERE conversation_id = ?",
                (conversation_id,)
            ).fetchone()
            
            if result:
                return json.loads(result['state'])
            return None
    
    def set_session_state(self, conversation_id: str, state: Dict):
        """Set session state"""
        with self.connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO session_state (conversation_id, state) VALUES (?, ?)",
                (conversation_id, json.dumps(state))
            )
```

### Configuration Manager

```python
# ~/.claude/hooks/lib/config_manager.py

import json
import yaml
from pathlib import Path
from typing import Any, Dict, Optional
import os
from datetime import datetime

class ConfigManager:
    """Centralized configuration management"""
    
    def __init__(self):
        self.config_dir = Path.home() / '.claude' / 'config'
        self.config_dir.mkdir(exist_ok=True)
        self._cache = {}
        self._load_all_configs()
    
    def _load_all_configs(self):
        """Load all configuration files"""
        # Load JSON configs
        for json_file in self.config_dir.glob('*.json'):
            key = json_file.stem
            with open(json_file) as f:
                self._cache[key] = json.load(f)
        
        # Load YAML configs
        for yaml_file in self.config_dir.glob('*.yaml'):
            key = yaml_file.stem
            with open(yaml_file) as f:
                self._cache[key] = yaml.safe_load(f)
        
        # Load environment variables
        self._load_env_overrides()
    
    def _load_env_overrides(self):
        """Override configs with environment variables"""
        # Example: CLAUDE_HOOK_SECURITY_LEVEL=high
        for key, value in os.environ.items():
            if key.startswith('CLAUDE_HOOK_'):
                config_path = key[12:].lower().split('_')
                self._set_nested(self._cache, config_path, value)
    
    def _set_nested(self, d: Dict, path: List[str], value: Any):
        """Set nested dictionary value"""
        for key in path[:-1]:
            d = d.setdefault(key, {})
        d[path[-1]] = value
    
    def get(self, path: str, default: Any = None) -> Any:
        """Get configuration value by path"""
        parts = path.split('.')
        value = self._cache
        
        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return default
        
        return value
    
    def reload(self):
        """Reload all configurations"""
        self._cache.clear()
        self._load_all_configs()

# Example configuration files:

# ~/.claude/config/security_rules.yaml
security_rules_yaml = """
rules:
  bash_commands:
    blocked_patterns:
      - pattern: "rm -rf /"
        severity: critical
        message: "Dangerous recursive deletion of root"
      - pattern: ":(){ :|:& };:"
        severity: critical
        message: "Fork bomb detected"
    
    suspicious_patterns:
      - pattern: "curl .* | sh"
        severity: high
        message: "Remote code execution pattern"
    
    require_approval:
      - "sudo"
      - "chmod 777"
      - "chown"
  
  file_operations:
    protected_paths:
      - /etc
      - /usr/bin
      - ~/.ssh
      - ~/.aws
    
    sensitive_extensions:
      - .key
      - .pem
      - .env
      - .crt

  rate_limits:
    operations_per_minute: 60
    high_risk_per_hour: 10
"""

# ~/.claude/config/format_rules.json
format_rules_json = """
{
  "formatters": {
    "javascript": {
      "extensions": [".js", ".jsx", ".ts", ".tsx"],
      "command": "prettier --write",
      "config_file": ".prettierrc"
    },
    "python": {
      "extensions": [".py"],
      "command": "black",
      "args": ["--line-length", "100"]
    },
    "go": {
      "extensions": [".go"],
      "command": "gofmt -w"
    },
    "rust": {
      "extensions": [".rs"],
      "command": "rustfmt"
    }
  },
  "linters": {
    "javascript": {
      "command": "eslint",
      "fix_flag": "--fix"
    },
    "python": {
      "command": "pylint",
      "config": ".pylintrc"
    }
  }
}
"""
```

### Advanced Security Validator

```python
# ~/.claude/hooks/pre/security.py

import json
import sys
import re
from pathlib import Path
from typing import Dict, List, Tuple
import hashlib
import time

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent / 'lib'))

from database import HookDatabase
from config_manager import ConfigManager

class SecurityValidator:
    """Advanced security validation with ML-inspired risk scoring"""
    
    def __init__(self):
        self.db = HookDatabase()
        self.config = ConfigManager()
        self.hook_input = json.loads(sys.stdin.read())
        self.risk_factors = []
        
    def validate(self) -> Dict:
        """Main validation entry point"""
        tool_name = self.hook_input['tool_name']
        
        # Check rate limits first
        if not self._check_rate_limits():
            return {
                "action": "block",
                "stopReason": "Rate limit exceeded. Please slow down."
            }
        
        # Tool-specific validation
        if tool_name == 'Bash':
            return self._validate_bash_command()
        elif tool_name in ['Edit', 'Write', 'MultiEdit']:
            return self._validate_file_operation()
        
        return {"action": "continue"}
    
    def _check_rate_limits(self) -> bool:
        """Check operation rate limits"""
        conversation_id = self.hook_input.get('conversation_id', 'unknown')
        
        with self.db.connection() as conn:
            # Check operations per minute
            recent_ops = conn.execute('''
                SELECT COUNT(*) as count FROM operations 
                WHERE conversation_id = ? 
                AND timestamp > datetime('now', '-1 minute')
            ''', (conversation_id,)).fetchone()
            
            ops_limit = self.config.get('security_rules.rate_limits.operations_per_minute', 60)
            if recent_ops['count'] > ops_limit:
                return False
            
            # Check high-risk operations per hour
            high_risk_ops = conn.execute('''
                SELECT COUNT(*) as count FROM operations 
                WHERE conversation_id = ? 
                AND risk_score >= 70
                AND timestamp > datetime('now', '-1 hour')
            ''', (conversation_id,)).fetchone()
            
            risk_limit = self.config.get('security_rules.rate_limits.high_risk_per_hour', 10)
            if high_risk_ops['count'] > risk_limit:
                self.risk_factors.append("Too many high-risk operations")
                return False
        
        return True
    
    def _validate_bash_command(self) -> Dict:
        """Validate bash commands"""
        command = self.hook_input['tool_input'].get('command', '')
        risk_score = 0
        
        # Check blocked patterns
        blocked = self.config.get('security_rules.bash_commands.blocked_patterns', [])
        for rule in blocked:
            if re.search(rule['pattern'], command, re.IGNORECASE):
                self._log_blocked_operation(rule['severity'], rule['message'])
                return {
                    "action": "block",
                    "stopReason": f"Security: {rule['message']}"
                }
        
        # Check suspicious patterns
        suspicious = self.config.get('security_rules.bash_commands.suspicious_patterns', [])
        for rule in suspicious:
            if re.search(rule['pattern'], command, re.IGNORECASE):
                risk_score += {'low': 20, 'medium': 40, 'high': 60, 'critical': 80}[rule['severity']]
                self.risk_factors.append(rule['message'])
        
        # Check for sudo and privileged operations
        if any(cmd in command for cmd in self.config.get('security_rules.bash_commands.require_approval', [])):
            risk_score += 30
            self.risk_factors.append("Privileged operation")
        
        # Context-based risk assessment
        risk_score += self._assess_contextual_risk(command)
        
        # Log operation
        self._log_operation(risk_score)
        
        # Make decision
        if risk_score >= 80:
            return {
                "action": "block",
                "stopReason": f"High risk command (score: {risk_score}). Factors: {', '.join(self.risk_factors)}"
            }
        elif risk_score >= 50:
            # Could implement approval workflow here
            self.db.record_metric('high_risk_operations', 1, {'tool': 'Bash'})
        
        return {"action": "continue"}
    
    def _validate_file_operation(self) -> Dict:
        """Validate file operations"""
        file_path = self.hook_input['tool_input'].get('file_path', '')
        risk_score = 0
        
        # Check protected paths
        protected_paths = self.config.get('security_rules.file_operations.protected_paths', [])
        for protected in protected_paths:
            if file_path.startswith(protected):
                risk_score += 70
                self.risk_factors.append(f"Protected path: {protected}")
        
        # Check sensitive extensions
        sensitive_exts = self.config.get('security_rules.file_operations.sensitive_extensions', [])
        if any(file_path.endswith(ext) for ext in sensitive_exts):
            risk_score += 50
            self.risk_factors.append("Sensitive file type")
        
        # Check file size and permissions
        try:
            path_obj = Path(file_path)
            if path_obj.exists():
                # Large file warning
                if path_obj.stat().st_size > 10 * 1024 * 1024:  # 10MB
                    risk_score += 20
                    self.risk_factors.append("Large file")
                
                # Check if executable
                if path_obj.stat().st_mode & 0o111:
                    risk_score += 30
                    self.risk_factors.append("Executable file")
        except:
            pass
        
        # Log operation
        self._log_operation(risk_score)
        
        if risk_score >= 80:
            return {
                "action": "block",
                "stopReason": f"Cannot modify sensitive file. Factors: {', '.join(self.risk_factors)}"
            }
        
        return {"action": "continue"}
    
    def _assess_contextual_risk(self, command: str) -> int:
        """Assess risk based on command context"""
        risk = 0
        
        # Network operations
        if any(net_cmd in command for net_cmd in ['curl', 'wget', 'nc', 'telnet']):
            risk += 20
            self.risk_factors.append("Network operation")
        
        # System modification
        if any(sys_cmd in command for sys_cmd in ['systemctl', 'service', 'kill', 'pkill']):
            risk += 30
            self.risk_factors.append("System modification")
        
        # Package management
        if any(pkg_cmd in command for pkg_cmd in ['apt', 'yum', 'brew', 'npm install', 'pip install']):
            risk += 25
            self.risk_factors.append("Package installation")
        
        return risk
    
    def _log_operation(self, risk_score: int):
        """Log operation to database"""
        self.db.log_operation({
            'conversation_id': self.hook_input.get('conversation_id'),
            'request_id': self.hook_input.get('request_id'),
            'tool_name': self.hook_input['tool_name'],
            'tool_input': self.hook_input['tool_input'],
            'risk_score': risk_score,
            'action': 'continue' if risk_score < 80 else 'block',
            'details': {
                'risk_factors': self.risk_factors,
                'timestamp': time.time()
            }
        })
    
    def _log_blocked_operation(self, severity: str, reason: str):
        """Log blocked operation"""
        self.db.log_operation({
            'conversation_id': self.hook_input.get('conversation_id'),
            'request_id': self.hook_input.get('request_id'),
            'tool_name': self.hook_input['tool_name'],
            'tool_input': self.hook_input['tool_input'],
            'risk_score': 100,
            'action': 'block',
            'details': {
                'severity': severity,
                'reason': reason,
                'timestamp': time.time()
            }
        })
        
        # Alert on critical blocks
        if severity == 'critical':
            self.db.record_metric('critical_blocks', 1, {
                'tool': self.hook_input['tool_name'],
                'reason': reason
            })

# Main execution
if __name__ == "__main__":
    validator = SecurityValidator()
    result = validator.validate()
    print(json.dumps(result))
```

### Intelligent Code Formatter

```python
# ~/.claude/hooks/post/formatter.py

import json
import sys
import subprocess
from pathlib import Path
from typing import Dict, Optional, List
import tempfile
import difflib

sys.path.append(str(Path(__file__).parent.parent / 'lib'))

from config_manager import ConfigManager
from database import HookDatabase

class IntelligentFormatter:
    """Smart code formatting with diff tracking"""
    
    def __init__(self):
        self.config = ConfigManager()
        self.db = HookDatabase()
        self.hook_input = json.loads(sys.stdin.read())
        
    def format_file(self):
        """Main formatting entry point"""
        file_path = self.hook_input['tool_input'].get('file_path', '')
        if not file_path or not Path(file_path).exists():
            return
        
        # Determine formatter
        formatter_config = self._get_formatter_config(file_path)
        if not formatter_config:
            return
        
        # Create backup
        backup_path = self._create_backup(file_path)
        
        try:
            # Format file
            success = self._run_formatter(file_path, formatter_config)
            
            if success:
                # Track changes
                self._track_changes(file_path, backup_path)
                
                # Run linter if configured
                self._run_linter(file_path)
            
        except Exception as e:
            # Restore from backup on error
            self._restore_backup(file_path, backup_path)
            print(f"Formatting error: {e}", file=sys.stderr)
        finally:
            # Clean up backup
            if backup_path.exists():
                backup_path.unlink()
    
    def _get_formatter_config(self, file_path: str) -> Optional[Dict]:
        """Get formatter configuration for file"""
        formatters = self.config.get('format_rules.formatters', {})
        
        for lang, config in formatters.items():
            extensions = config.get('extensions', [])
            if any(file_path.endswith(ext) for ext in extensions):
                return config
        
        return None
    
    def _create_backup(self, file_path: str) -> Path:
        """Create backup of file"""
        backup_dir = Path.home() / '.claude' / 'backups' / 'formatter'
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        backup_file = backup_dir / f"{Path(file_path).name}.{int(time.time())}.bak"
        with open(backup_file, 'w') as f:
            f.write(content)
        
        return backup_file
    
    def _run_formatter(self, file_path: str, config: Dict) -> bool:
        """Run formatter on file"""
        command_parts = [config['command']]
        
        # Add configuration file if specified
        if 'config_file' in config:
            config_path = Path(file_path).parent / config['config_file']
            if config_path.exists():
                command_parts.extend(['--config', str(config_path)])
        
        # Add additional arguments
        if 'args' in config:
            command_parts.extend(config['args'])
        
        # Add file path
        command_parts.append(file_path)
        
        # Run formatter
        result = subprocess.run(
            command_parts,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"Formatter error: {result.stderr}", file=sys.stderr)
            return False
        
        return True
    
    def _track_changes(self, file_path: str, backup_path: Path):
        """Track formatting changes"""
        with open(backup_path, 'r') as f:
            original = f.readlines()
        
        with open(file_path, 'r') as f:
            formatted = f.readlines()
        
        # Calculate diff
        diff = list(difflib.unified_diff(
            original, formatted,
            fromfile=f"{file_path} (original)",
            tofile=f"{file_path} (formatted)",
            lineterm=''
        ))
        
        if diff:
            # Log formatting changes
            self.db.log_operation({
                'conversation_id': self.hook_input.get('conversation_id'),
                'tool_name': 'Formatter',
                'tool_input': {'file_path': file_path},
                'risk_score': 0,
                'action': 'format',
                'details': {
                    'lines_changed': len([l for l in diff if l.startswith(('+', '-'))]),
                    'diff_preview': '\n'.join(diff[:20])  # First 20 lines of diff
                }
            })
            
            # Record metric
            self.db.record_metric('files_formatted', 1, {
                'extension': Path(file_path).suffix,
                'changes': len(diff)
            })
    
    def _run_linter(self, file_path: str):
        """Run linter after formatting"""
        linters = self.config.get('format_rules.linters', {})
        
        for lang, linter_config in linters.items():
            # Check if linter applies to this file
            formatter = self.config.get(f'format_rules.formatters.{lang}', {})
            extensions = formatter.get('extensions', [])
            
            if any(file_path.endswith(ext) for ext in extensions):
                command_parts = [linter_config['command']]
                
                if 'config' in linter_config:
                    config_path = Path(file_path).parent / linter_config['config']
                    if config_path.exists():
                        command_parts.extend(['--config', str(config_path)])
                
                command_parts.append(file_path)
                
                # Run linter
                result = subprocess.run(
                    command_parts,
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:
                    # Log linting issues
                    self.db.record_metric('linting_issues', 1, {
                        'file': file_path,
                        'linter': linter_config['command']
                    })
    
    def _restore_backup(self, file_path: str, backup_path: Path):
        """Restore file from backup"""
        if backup_path.exists():
            with open(backup_path, 'r') as f:
                content = f.read()
            with open(file_path, 'w') as f:
                f.write(content)

# Main execution
if __name__ == "__main__":
    formatter = IntelligentFormatter()
    formatter.format_file()
```

### Analytics Dashboard Generator

```python
# ~/.claude/hooks/stop/reporter.py

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
import sqlite3
from typing import Dict, List
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from jinja2 import Template

sys.path.append(str(Path(__file__).parent.parent / 'lib'))

from database import HookDatabase
from config_manager import ConfigManager

class AnalyticsReporter:
    """Generate comprehensive analytics reports"""
    
    def __init__(self):
        self.db = HookDatabase()
        self.config = ConfigManager()
        self.hook_input = json.loads(sys.stdin.read())
        self.conversation_id = self.hook_input.get('conversation_id', 'unknown')
        self.report_dir = Path.home() / '.claude' / 'reports' / self.conversation_id
        self.report_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_report(self):
        """Generate full analytics report"""
        # Collect data
        session_data = self._collect_session_data()
        
        # Generate visualizations
        self._generate_charts(session_data)
        
        # Generate HTML report
        self._generate_html_report(session_data)
        
        # Generate summary
        self._generate_summary(session_data)
        
        # Clean up old reports
        self._cleanup_old_reports()
    
    def _collect_session_data(self) -> Dict:
        """Collect all session data"""
        with self.db.connection() as conn:
            # Basic stats
            total_operations = conn.execute(
                "SELECT COUNT(*) FROM operations WHERE conversation_id = ?",
                (self.conversation_id,)
            ).fetchone()[0]
            
            # Tool usage
            tool_usage = conn.execute('''
                SELECT tool_name, COUNT(*) as count, AVG(risk_score) as avg_risk
                FROM operations 
                WHERE conversation_id = ?
                GROUP BY tool_name
            ''', (self.conversation_id,)).fetchall()
            
            # Timeline
            timeline = conn.execute('''
                SELECT timestamp, tool_name, risk_score
                FROM operations 
                WHERE conversation_id = ?
                ORDER BY timestamp
            ''', (self.conversation_id,)).fetchall()
            
            # Risk distribution
            risk_dist = conn.execute('''
                SELECT 
                    CASE 
                        WHEN risk_score < 20 THEN 'Low'
                        WHEN risk_score < 50 THEN 'Medium'
                        WHEN risk_score < 80 THEN 'High'
                        ELSE 'Critical'
                    END as risk_level,
                    COUNT(*) as count
                FROM operations 
                WHERE conversation_id = ?
                GROUP BY risk_level
            ''', (self.conversation_id,)).fetchall()
            
            # Blocked operations
            blocked_ops = conn.execute('''
                SELECT tool_name, details
                FROM operations 
                WHERE conversation_id = ? AND action = 'block'
            ''', (self.conversation_id,)).fetchall()
        
        return {
            'total_operations': total_operations,
            'tool_usage': tool_usage,
            'timeline': timeline,
            'risk_distribution': risk_dist,
            'blocked_operations': blocked_ops,
            'session_duration': self._calculate_duration(timeline)
        }
    
    def _generate_charts(self, data: Dict):
        """Generate visualization charts"""
        # Tool usage pie chart
        if data['tool_usage']:
            plt.figure(figsize=(10, 6))
            tools = [row['tool_name'] for row in data['tool_usage']]
            counts = [row['count'] for row in data['tool_usage']]
            
            plt.pie(counts, labels=tools, autopct='%1.1f%%')
            plt.title('Tool Usage Distribution')
            plt.savefig(self.report_dir / 'tool_usage.png')
            plt.close()
        
        # Risk timeline
        if data['timeline']:
            plt.figure(figsize=(12, 6))
            timestamps = [datetime.fromisoformat(row['timestamp']) for row in data['timeline']]
            risk_scores = [row['risk_score'] for row in data['timeline']]
            
            plt.plot(timestamps, risk_scores, 'b-', alpha=0.7)
            plt.scatter(timestamps, risk_scores, c=risk_scores, cmap='RdYlGn_r', s=50)
            
            plt.xlabel('Time')
            plt.ylabel('Risk Score')
            plt.title('Risk Score Timeline')
            plt.colorbar(label='Risk Level')
            
            # Format x-axis
            plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
            plt.gcf().autofmt_xdate()
            
            plt.savefig(self.report_dir / 'risk_timeline.png')
            plt.close()
    
    def _generate_html_report(self, data: Dict):
        """Generate HTML report"""
        template = Template('''
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Session Report - {{ conversation_id }}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #666; margin-top: 30px; }
        .metric { display: inline-block; margin: 20px; padding: 20px; background: #f9f9f9; border-radius: 5px; }
        .metric-value { font-size: 36px; font-weight: bold; color: #4CAF50; }
        .metric-label { color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; }
        .risk-low { color: #4CAF50; }
        .risk-medium { color: #FF9800; }
        .risk-high { color: #f44336; }
        .risk-critical { color: #9C27B0; font-weight: bold; }
        img { max-width: 100%; margin: 20px 0; }
        .blocked { background: #ffebee; padding: 10px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Claude Code Session Report</h1>
        <p><strong>Session ID:</strong> {{ conversation_id }}</p>
        <p><strong>Generated:</strong> {{ generated_at }}</p>
        <p><strong>Duration:</strong> {{ duration }}</p>
        
        <h2>Overview Metrics</h2>
        <div class="metric">
            <div class="metric-value">{{ total_operations }}</div>
            <div class="metric-label">Total Operations</div>
        </div>
        <div class="metric">
            <div class="metric-value">{{ blocked_count }}</div>
            <div class="metric-label">Blocked Operations</div>
        </div>
        <div class="metric">
            <div class="metric-value">{{ unique_tools }}</div>
            <div class="metric-label">Unique Tools Used</div>
        </div>
        
        <h2>Tool Usage</h2>
        <img src="tool_usage.png" alt="Tool Usage Distribution">
        <table>
            <tr>
                <th>Tool</th>
                <th>Usage Count</th>
                <th>Average Risk</th>
            </tr>
            {% for tool in tool_usage %}
            <tr>
                <td>{{ tool.tool_name }}</td>
                <td>{{ tool.count }}</td>
                <td class="risk-{{ tool.risk_class }}">{{ "%.1f"|format(tool.avg_risk) }}</td>
            </tr>
            {% endfor %}
        </table>
        
        <h2>Risk Analysis</h2>
        <img src="risk_timeline.png" alt="Risk Timeline">
        
        <h2>Risk Distribution</h2>
        <table>
            <tr>
                <th>Risk Level</th>
                <th>Count</th>
            </tr>
            {% for risk in risk_distribution %}
            <tr>
                <td class="risk-{{ risk.risk_level|lower }}">{{ risk.risk_level }}</td>
                <td>{{ risk.count }}</td>
            </tr>
            {% endfor %}
        </table>
        
        {% if blocked_operations %}
        <h2>Blocked Operations</h2>
        {% for op in blocked_operations %}
        <div class="blocked">
            <strong>Tool:</strong> {{ op.tool_name }}<br>
            <strong>Reason:</strong> {{ op.reason }}
        </div>
        {% endfor %}
        {% endif %}
    </div>
</body>
</html>
        ''')
        
        # Prepare template data
        template_data = {
            'conversation_id': self.conversation_id,
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'duration': data['session_duration'],
            'total_operations': data['total_operations'],
            'blocked_count': len(data['blocked_operations']),
            'unique_tools': len(data['tool_usage']),
            'tool_usage': [
                {
                    **dict(row),
                    'risk_class': self._get_risk_class(row['avg_risk'])
                }
                for row in data['tool_usage']
            ],
            'risk_distribution': data['risk_distribution'],
            'blocked_operations': [
                {
                    'tool_name': op['tool_name'],
                    'reason': json.loads(op['details']).get('reason', 'Unknown')
                }
                for op in data['blocked_operations']
            ]
        }
        
        # Generate HTML
        html_content = template.render(**template_data)
        
        # Save report
        with open(self.report_dir / 'report.html', 'w') as f:
            f.write(html_content)
    
    def _generate_summary(self, data: Dict):
        """Generate text summary"""
        summary = f"""
Claude Code Session Summary
===========================
Session ID: {self.conversation_id}
Duration: {data['session_duration']}
Total Operations: {data['total_operations']}

Tool Usage:
"""
        for tool in data['tool_usage']:
            summary += f"  - {tool['tool_name']}: {tool['count']} operations (avg risk: {tool['avg_risk']:.1f})\n"
        
        if data['blocked_operations']:
            summary += f"\nBlocked Operations: {len(data['blocked_operations'])}\n"
            for op in data['blocked_operations']:
                details = json.loads(op['details'])
                summary += f"  - {op['tool_name']}: {details.get('reason', 'Unknown')}\n"
        
        # Save summary
        with open(self.report_dir / 'summary.txt', 'w') as f:
            f.write(summary)
        
        # Also print to console
        print(summary)
    
    def _calculate_duration(self, timeline: List) -> str:
        """Calculate session duration"""
        if not timeline:
            return "Unknown"
        
        start = datetime.fromisoformat(timeline[0]['timestamp'])
        end = datetime.fromisoformat(timeline[-1]['timestamp'])
        duration = end - start
        
        # Format duration
        hours, remainder = divmod(duration.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        if hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"
    
    def _get_risk_class(self, risk_score: float) -> str:
        """Get CSS class for risk score"""
        if risk_score < 20:
            return 'low'
        elif risk_score < 50:
            return 'medium'
        elif risk_score < 80:
            return 'high'
        else:
            return 'critical'
    
    def _cleanup_old_reports(self):
        """Clean up reports older than 30 days"""
        reports_root = Path.home() / '.claude' / 'reports'
        cutoff_date = datetime.now() - timedelta(days=30)
        
        for report_dir in reports_root.iterdir():
            if report_dir.is_dir():
                # Check modification time
                mtime = datetime.fromtimestamp(report_dir.stat().st_mtime)
                if mtime < cutoff_date:
                    # Archive old report
                    import shutil
                    archive_dir = reports_root / 'archive'
                    archive_dir.mkdir(exist_ok=True)
                    shutil.move(str(report_dir), str(archive_dir / report_dir.name))

# Main execution
if __name__ == "__main__":
    reporter = AnalyticsReporter()
    reporter.generate_report()
```

## Team Collaboration Features

### Shared Configuration Management

```bash
#!/bin/bash
# ~/.claude/hooks/lib/sync_config.sh

# Sync team configurations from Git repository
TEAM_CONFIG_REPO="https://github.com/yourteam/claude-hooks-config.git"
LOCAL_CONFIG_DIR="$HOME/.claude/team-config"

# Clone or update team config
if [ -d "$LOCAL_CONFIG_DIR/.git" ]; then
    cd "$LOCAL_CONFIG_DIR"
    git pull --quiet
else
    git clone --quiet "$TEAM_CONFIG_REPO" "$LOCAL_CONFIG_DIR"
fi

# Merge team config with local
python3 - << EOF
import json
import yaml
from pathlib import Path

local_config = Path.home() / '.claude' / 'config'
team_config = Path.home() / '.claude' / 'team-config'

# Merge configurations
for team_file in team_config.glob('*.json'):
    local_file = local_config / team_file.name
    
    if local_file.exists():
        # Merge with local
        with open(local_file) as f:
            local_data = json.load(f)
        with open(team_file) as f:
            team_data = json.load(f)
        
        # Team config takes precedence for security rules
        if 'security' in team_file.name:
            local_data.update(team_data)
        else:
            # Local takes precedence for preferences
            team_data.update(local_data)
            local_data = team_data
        
        with open(local_file, 'w') as f:
            json.dump(local_data, f, indent=2)
    else:
        # Copy team config
        import shutil
        shutil.copy(team_file, local_file)

print("Team configuration synchronized")
EOF
```

## Monitoring and Observability

### Metrics Exporter

```python
# ~/.claude/hooks/lib/metrics_exporter.py

from prometheus_client import Counter, Histogram, Gauge, push_to_gateway
from prometheus_client.core import CollectorRegistry
import time

class MetricsCollector:
    """Export metrics to Prometheus/Grafana"""
    
    def __init__(self):
        self.registry = CollectorRegistry()
        
        # Define metrics
        self.operation_counter = Counter(
            'claude_operations_total',
            'Total operations by tool',
            ['tool_name', 'action'],
            registry=self.registry
        )
        
        self.risk_histogram = Histogram(
            'claude_risk_score',
            'Risk score distribution',
            buckets=[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            registry=self.registry
        )
        
        self.duration_histogram = Histogram(
            'claude_operation_duration_seconds',
            'Operation duration',
            ['tool_name'],
            registry=self.registry
        )
        
        self.active_sessions = Gauge(
            'claude_active_sessions',
            'Number of active sessions',
            registry=self.registry
        )
    
    def record_operation(self, tool_name: str, action: str, risk_score: float, duration: float):
        """Record operation metrics"""
        self.operation_counter.labels(tool_name=tool_name, action=action).inc()
        self.risk_histogram.observe(risk_score)
        self.duration_histogram.labels(tool_name=tool_name).observe(duration)
    
    def export_metrics(self):
        """Export to Prometheus pushgateway"""
        try:
            push_to_gateway(
                'localhost:9091',
                job='claude_hooks',
                registry=self.registry
            )
        except Exception as e:
            print(f"Failed to export metrics: {e}", file=sys.stderr)
```

## Troubleshooting Toolkit

### Hook Debugger

```bash
#!/bin/bash
# ~/.claude/hooks/debug/hook_debugger.sh

# Enable debug mode for all hooks
export CLAUDE_HOOK_DEBUG=1

# Create debug directory
DEBUG_DIR="$HOME/.claude/debug/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DEBUG_DIR"

echo "Claude Hook Debugger"
echo "==================="
echo "Debug output will be saved to: $DEBUG_DIR"
echo ""

# Test hook with sample input
cat << EOF > "$DEBUG_DIR/test_input.json"
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "echo 'test command'",
    "description": "Test command for debugging"
  },
  "conversation_id": "debug_session",
  "request_id": "debug_request",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Test each hook type
for hook_type in pre post notification stop; do
    echo "Testing $hook_type hooks..."
    
    # Find all hooks for this type
    if [ -d "$HOME/.claude/hooks/$hook_type" ]; then
        for hook in "$HOME/.claude/hooks/$hook_type"/*; do
            if [ -x "$hook" ]; then
                echo "  Running: $(basename $hook)"
                
                # Run hook with test input
                if cat "$DEBUG_DIR/test_input.json" | "$hook" > "$DEBUG_DIR/${hook_type}_$(basename $hook).out" 2> "$DEBUG_DIR/${hook_type}_$(basename $hook).err"; then
                    echo "    ✓ Success"
                else
                    echo "    ✗ Failed (exit code: $?)"
                fi
            fi
        done
    fi
done

echo ""
echo "Debug complete. Check $DEBUG_DIR for output files."
```

## Best Practices Summary

1. **Modular Design**: Keep hooks small and focused
2. **Error Handling**: Always fail gracefully
3. **Performance**: Monitor hook execution time
4. **Security**: Validate all inputs
5. **Documentation**: Comment complex logic
6. **Testing**: Test hooks in isolation
7. **Version Control**: Track all hook changes
8. **Monitoring**: Export metrics for visibility
9. **Team Sync**: Share common configurations
10. **Debugging**: Build debugging into your system

## Practice Exercise: Production Deployment

Deploy a complete hook ecosystem that includes:
1. Security validation with ML-based risk scoring
2. Automatic code formatting and linting
3. Multi-channel notifications
4. Comprehensive analytics and reporting
5. Team configuration synchronization
6. Prometheus metrics export
7. Debug and troubleshooting tools

## Summary

You've learned to build:
- ✅ Production-ready hook architectures
- ✅ Modular, maintainable systems
- ✅ Team collaboration features
- ✅ Advanced monitoring and analytics
- ✅ Comprehensive debugging tools

## Conclusion

Claude Code hooks transform your development environment into an intelligent, automated assistant. By implementing the patterns and practices in this course, you can:

- Enforce security and compliance automatically
- Maintain code quality without manual intervention
- Track and analyze all development activities
- Collaborate effectively with team standards
- Build a safer, more efficient workflow

Remember: hooks are powerful tools that require careful implementation. Start simple, test thoroughly, and gradually build your ecosystem.

Happy hooking! 🚀