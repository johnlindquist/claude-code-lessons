# Lesson 4: Notification and Stop Hooks

## Learning Objectives
By the end of this lesson, you will:
- Master Notification hooks for custom alerts
- Implement Stop hooks for cleanup and reporting
- Build multi-channel notification systems
- Create session summaries and analytics
- Integrate with external services (Slack, Discord, email)

## Understanding Notification Hooks

Notification hooks trigger when Claude needs your attention, replacing the default terminal bell or system notification.

### Basic Notification Hook

```json
{
  "hooks": {
    "Notification": [
      {
        "type": "command",
        "command": "echo 'Claude needs your input' | tee ~/.claude/notifications.log"
      }
    ]
  }
}
```

### Rich Notifications Across Platforms

```bash
#!/bin/bash
# ~/.claude/hooks/smart_notify.sh

MESSAGE="Claude Code needs your attention"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Platform detection and notification
case "$OSTYPE" in
  darwin*)
    # macOS - Multiple notification methods
    # System notification
    osascript -e "display notification \"$MESSAGE\" with title \"Claude Code\" subtitle \"$TIMESTAMP\""
    
    # Sound alert
    afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
    
    # Terminal bell
    printf '\a'
    ;;
    
  linux*)
    # Linux - Try multiple notification systems
    # Try notify-send first
    if command -v notify-send &> /dev/null; then
      notify-send -u critical "Claude Code" "$MESSAGE"
    fi
    
    # Try zenity
    if command -v zenity &> /dev/null; then
      zenity --notification --text="Claude Code: $MESSAGE" &
    fi
    
    # Play sound if available
    if command -v paplay &> /dev/null; then
      paplay /usr/share/sounds/freedesktop/stereo/message.oga 2>/dev/null || true
    fi
    ;;
    
  msys*|mingw*|cygwin*)
    # Windows
    powershell -Command "
      Add-Type -AssemblyName System.Windows.Forms
      \$notification = New-Object System.Windows.Forms.NotifyIcon
      \$notification.Icon = [System.Drawing.SystemIcons]::Information
      \$notification.Visible = \$true
      \$notification.ShowBalloonTip(10000, 'Claude Code', '$MESSAGE', 'Info')
    "
    ;;
esac

# Log notification
echo "[$TIMESTAMP] Notification sent: $MESSAGE" >> ~/.claude/notification.log
```

## Advanced Notification Systems

### Multi-Channel Notification Manager

```python
#!/usr/bin/env python3
# ~/.claude/hooks/notification_manager.py

import json
import sys
import os
import subprocess
import requests
from datetime import datetime
from pathlib import Path
import configparser

class NotificationManager:
    def __init__(self):
        self.config_path = Path.home() / '.claude' / 'notification_config.ini'
        self.config = self.load_config()
        self.notification_log = Path.home() / '.claude' / 'notifications.jsonl'
        
    def load_config(self):
        """Load notification preferences"""
        config = configparser.ConfigParser()
        if self.config_path.exists():
            config.read(self.config_path)
        else:
            # Create default config
            config['channels'] = {
                'desktop': 'true',
                'slack': 'false',
                'discord': 'false',
                'email': 'false',
                'sms': 'false'
            }
            config['slack'] = {
                'webhook_url': '',
                'channel': '#claude-notifications'
            }
            config['discord'] = {
                'webhook_url': ''
            }
            config['email'] = {
                'smtp_server': '',
                'smtp_port': '587',
                'from_email': '',
                'to_email': '',
                'password': ''
            }
            # Save default config
            self.config_path.parent.mkdir(exist_ok=True)
            with open(self.config_path, 'w') as f:
                config.write(f)
        return config
    
    def notify(self, message: str, priority: str = 'normal'):
        """Send notification through configured channels"""
        notification_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'message': message,
            'priority': priority
        }
        
        # Log notification
        self.log_notification(notification_data)
        
        # Send through enabled channels
        channels = self.config['channels']
        
        if channels.getboolean('desktop', True):
            self.send_desktop_notification(message, priority)
        
        if channels.getboolean('slack', False):
            self.send_slack_notification(message, priority)
        
        if channels.getboolean('discord', False):
            self.send_discord_notification(message, priority)
        
        if channels.getboolean('email', False):
            self.send_email_notification(message, priority)
    
    def send_desktop_notification(self, message: str, priority: str):
        """Send desktop notification"""
        if sys.platform == 'darwin':
            # macOS
            urgency = 'critical' if priority == 'high' else 'normal'
            subprocess.run([
                'osascript', '-e',
                f'display notification "{message}" with title "Claude Code" sound name "Glass"'
            ])
        elif sys.platform.startswith('linux'):
            # Linux
            urgency = 'critical' if priority == 'high' else 'normal'
            subprocess.run([
                'notify-send', '-u', urgency, 'Claude Code', message
            ])
    
    def send_slack_notification(self, message: str, priority: str):
        """Send Slack notification"""
        webhook_url = self.config['slack'].get('webhook_url')
        if not webhook_url:
            return
        
        color = '#ff0000' if priority == 'high' else '#36a64f'
        payload = {
            'attachments': [{
                'color': color,
                'title': 'Claude Code Notification',
                'text': message,
                'footer': 'Claude Code Hooks',
                'ts': int(datetime.utcnow().timestamp())
            }]
        }
        
        try:
            response = requests.post(webhook_url, json=payload, timeout=5)
            response.raise_for_status()
        except Exception as e:
            print(f"Failed to send Slack notification: {e}", file=sys.stderr)
    
    def send_discord_notification(self, message: str, priority: str):
        """Send Discord notification"""
        webhook_url = self.config['discord'].get('webhook_url')
        if not webhook_url:
            return
        
        embed_color = 0xFF0000 if priority == 'high' else 0x00FF00
        payload = {
            'embeds': [{
                'title': 'Claude Code Notification',
                'description': message,
                'color': embed_color,
                'timestamp': datetime.utcnow().isoformat(),
                'footer': {'text': 'Claude Code Hooks'}
            }]
        }
        
        try:
            response = requests.post(webhook_url, json=payload, timeout=5)
            response.raise_for_status()
        except Exception as e:
            print(f"Failed to send Discord notification: {e}", file=sys.stderr)
    
    def send_email_notification(self, message: str, priority: str):
        """Send email notification"""
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        smtp_config = self.config['email']
        if not all([smtp_config.get('smtp_server'), smtp_config.get('from_email'), 
                   smtp_config.get('to_email'), smtp_config.get('password')]):
            return
        
        msg = MIMEMultipart()
        msg['From'] = smtp_config['from_email']
        msg['To'] = smtp_config['to_email']
        msg['Subject'] = f'Claude Code Notification ({priority})'
        
        body = f"""
        Claude Code Notification
        
        Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        Priority: {priority}
        
        Message:
        {message}
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        try:
            server = smtplib.SMTP(smtp_config['smtp_server'], int(smtp_config['smtp_port']))
            server.starttls()
            server.login(smtp_config['from_email'], smtp_config['password'])
            server.send_message(msg)
            server.quit()
        except Exception as e:
            print(f"Failed to send email notification: {e}", file=sys.stderr)
    
    def log_notification(self, data: dict):
        """Log notification for history"""
        self.notification_log.parent.mkdir(exist_ok=True)
        with open(self.notification_log, 'a') as f:
            f.write(json.dumps(data) + '\n')

# Main execution
if __name__ == "__main__":
    # Parse any input (might contain context)
    try:
        hook_input = json.loads(sys.stdin.read())
        context = hook_input.get('context', '')
        message = f"Awaiting input: {context}" if context else "Claude Code needs your attention"
    except:
        message = "Claude Code needs your attention"
    
    manager = NotificationManager()
    
    # Determine priority based on context
    priority = 'high' if 'error' in message.lower() or 'failed' in message.lower() else 'normal'
    
    manager.notify(message, priority)
```

## Stop Hooks: Cleanup and Reporting

Stop hooks execute when Claude finishes responding, perfect for:
- 📊 Generating session summaries
- 🧹 Cleaning up temporary files
- 📈 Collecting metrics
- 💾 Backing up changes

### Basic Stop Hook

```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "echo 'Session ended at $(date)' >> ~/.claude/sessions.log"
      }
    ]
  }
}
```

### Comprehensive Session Reporter

```python
#!/usr/bin/env python3
# ~/.claude/hooks/session_reporter.py

import json
import sys
import sqlite3
from datetime import datetime
from pathlib import Path
from collections import defaultdict
import subprocess

class SessionReporter:
    def __init__(self):
        self.db_path = Path.home() / '.claude' / 'session_tracking.db'
        self.report_dir = Path.home() / '.claude' / 'reports'
        self.report_dir.mkdir(exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """Initialize session tracking database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS tool_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT,
                    tool_name TEXT,
                    timestamp DATETIME,
                    details TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS file_changes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT,
                    file_path TEXT,
                    operation TEXT,
                    timestamp DATETIME
                )
            ''')
    
    def generate_report(self, conversation_id: str):
        """Generate comprehensive session report"""
        report = {
            'conversation_id': conversation_id,
            'end_time': datetime.utcnow().isoformat(),
            'summary': self._generate_summary(conversation_id),
            'tool_usage': self._get_tool_usage(conversation_id),
            'file_changes': self._get_file_changes(conversation_id),
            'metrics': self._calculate_metrics(conversation_id)
        }
        
        # Save report
        report_file = self.report_dir / f"session_{conversation_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Generate human-readable summary
        self._generate_readable_summary(report)
        
        return report
    
    def _generate_summary(self, conversation_id: str) -> dict:
        """Generate session summary"""
        with sqlite3.connect(self.db_path) as conn:
            # Get session duration
            first_action = conn.execute(
                "SELECT MIN(timestamp) FROM tool_usage WHERE conversation_id = ?",
                (conversation_id,)
            ).fetchone()[0]
            
            last_action = conn.execute(
                "SELECT MAX(timestamp) FROM tool_usage WHERE conversation_id = ?",
                (conversation_id,)
            ).fetchone()[0]
            
            # Count operations
            tool_counts = conn.execute(
                "SELECT tool_name, COUNT(*) FROM tool_usage WHERE conversation_id = ? GROUP BY tool_name",
                (conversation_id,)
            ).fetchall()
            
            file_count = conn.execute(
                "SELECT COUNT(DISTINCT file_path) FROM file_changes WHERE conversation_id = ?",
                (conversation_id,)
            ).fetchone()[0]
        
        duration = None
        if first_action and last_action:
            start = datetime.fromisoformat(first_action)
            end = datetime.fromisoformat(last_action)
            duration = str(end - start)
        
        return {
            'duration': duration,
            'tool_usage': dict(tool_counts),
            'files_modified': file_count,
            'start_time': first_action,
            'end_time': last_action
        }
    
    def _get_tool_usage(self, conversation_id: str) -> list:
        """Get detailed tool usage"""
        with sqlite3.connect(self.db_path) as conn:
            results = conn.execute(
                "SELECT tool_name, timestamp, details FROM tool_usage WHERE conversation_id = ? ORDER BY timestamp",
                (conversation_id,)
            ).fetchall()
        
        return [
            {
                'tool': row[0],
                'timestamp': row[1],
                'details': json.loads(row[2]) if row[2] else {}
            }
            for row in results
        ]
    
    def _get_file_changes(self, conversation_id: str) -> list:
        """Get file changes during session"""
        with sqlite3.connect(self.db_path) as conn:
            results = conn.execute(
                "SELECT DISTINCT file_path, operation FROM file_changes WHERE conversation_id = ?",
                (conversation_id,)
            ).fetchall()
        
        return [
            {'file': row[0], 'operation': row[1]}
            for row in results
        ]
    
    def _calculate_metrics(self, conversation_id: str) -> dict:
        """Calculate session metrics"""
        with sqlite3.connect(self.db_path) as conn:
            # Command complexity
            bash_commands = conn.execute(
                "SELECT COUNT(*) FROM tool_usage WHERE conversation_id = ? AND tool_name = 'Bash'",
                (conversation_id,)
            ).fetchone()[0]
            
            # File operations
            file_ops = conn.execute(
                "SELECT COUNT(*) FROM tool_usage WHERE conversation_id = ? AND tool_name IN ('Edit', 'Write', 'MultiEdit')",
                (conversation_id,)
            ).fetchone()[0]
        
        return {
            'total_operations': bash_commands + file_ops,
            'bash_commands': bash_commands,
            'file_operations': file_ops,
            'complexity_score': self._calculate_complexity(conversation_id)
        }
    
    def _calculate_complexity(self, conversation_id: str) -> int:
        """Calculate session complexity score"""
        # Simple heuristic based on operation count and diversity
        with sqlite3.connect(self.db_path) as conn:
            tool_diversity = conn.execute(
                "SELECT COUNT(DISTINCT tool_name) FROM tool_usage WHERE conversation_id = ?",
                (conversation_id,)
            ).fetchone()[0]
            
            total_ops = conn.execute(
                "SELECT COUNT(*) FROM tool_usage WHERE conversation_id = ?",
                (conversation_id,)
            ).fetchone()[0]
        
        return min(100, (tool_diversity * 10) + (total_ops * 2))
    
    def _generate_readable_summary(self, report: dict):
        """Generate human-readable summary"""
        summary = f"""
Claude Code Session Summary
==========================
Session ID: {report['conversation_id']}
Duration: {report['summary'].get('duration', 'Unknown')}
Complexity Score: {report['metrics']['complexity_score']}/100

Operations Summary:
- Total Operations: {report['metrics']['total_operations']}
- Bash Commands: {report['metrics']['bash_commands']}
- File Operations: {report['metrics']['file_operations']}
- Files Modified: {report['summary']['files_modified']}

Tool Usage:
"""
        for tool, count in report['summary']['tool_usage'].items():
            summary += f"- {tool}: {count} times\n"
        
        if report['file_changes']:
            summary += "\nModified Files:\n"
            for change in report['file_changes']:
                summary += f"- {change['file']} ({change['operation']})\n"
        
        # Save readable summary
        summary_file = self.report_dir / f"summary_{report['conversation_id']}.txt"
        with open(summary_file, 'w') as f:
            f.write(summary)
        
        # Optionally display summary
        print(summary)

# Main execution
if __name__ == "__main__":
    try:
        hook_input = json.loads(sys.stdin.read())
        conversation_id = hook_input.get('conversation_id', 'unknown')
    except:
        conversation_id = 'unknown'
    
    reporter = SessionReporter()
    reporter.generate_report(conversation_id)
```

### Stop Hook with Cleanup

```bash
#!/bin/bash
# ~/.claude/hooks/session_cleanup.sh

# Get session info
CONVERSATION_ID="${CLAUDE_CONVERSATION_ID:-unknown}"
SESSION_DIR="$HOME/.claude/sessions/$CONVERSATION_ID"

# Create session summary
if [ -d "$SESSION_DIR" ]; then
    # Archive session data
    tar -czf "$SESSION_DIR.tar.gz" "$SESSION_DIR"
    
    # Clean up temporary files
    find "$SESSION_DIR" -name "*.tmp" -delete
    find "$SESSION_DIR" -name "*.bak" -mtime +7 -delete
    
    # Generate Git summary if in repo
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo "Git changes during session:" > "$SESSION_DIR/git_summary.txt"
        git diff --stat >> "$SESSION_DIR/git_summary.txt"
        git status --short >> "$SESSION_DIR/git_summary.txt"
    fi
fi

# Send completion notification
~/.claude/hooks/notify.sh "Session completed: $CONVERSATION_ID"

# Log session end
echo "[$(date)] Session ended: $CONVERSATION_ID" >> ~/.claude/sessions.log
```

## Combining Notification and Stop Hooks

### Intelligent Session Monitor

```python
#!/usr/bin/env python3
# ~/.claude/hooks/session_monitor.py

import json
import sys
import time
from pathlib import Path
from datetime import datetime
import threading
import queue

class SessionMonitor:
    def __init__(self):
        self.session_file = Path.home() / '.claude' / 'active_session.json'
        self.notification_queue = queue.Queue()
        self.monitoring = True
        
    def start_monitoring(self):
        """Start monitoring session activity"""
        # Start notification thread
        notif_thread = threading.Thread(target=self._notification_worker)
        notif_thread.daemon = True
        notif_thread.start()
        
        # Start activity monitor
        monitor_thread = threading.Thread(target=self._activity_monitor)
        monitor_thread.daemon = True
        monitor_thread.start()
    
    def _notification_worker(self):
        """Process notifications in background"""
        while self.monitoring:
            try:
                notification = self.notification_queue.get(timeout=1)
                self._send_notification(notification)
            except queue.Empty:
                continue
    
    def _activity_monitor(self):
        """Monitor session activity"""
        last_activity = time.time()
        
        while self.monitoring:
            time.sleep(60)  # Check every minute
            
            # Check for inactivity
            if time.time() - last_activity > 300:  # 5 minutes
                self.notification_queue.put({
                    'type': 'inactivity',
                    'message': 'Claude Code session inactive for 5 minutes'
                })
    
    def _send_notification(self, notification):
        """Send notification based on type"""
        if notification['type'] == 'inactivity':
            # Could pause expensive operations or send reminder
            pass
        elif notification['type'] == 'completion':
            # Send session summary
            pass
    
    def handle_notification_hook(self):
        """Handle notification event"""
        self.notification_queue.put({
            'type': 'attention_needed',
            'message': 'Claude Code needs your input',
            'timestamp': datetime.utcnow().isoformat()
        })
    
    def handle_stop_hook(self):
        """Handle session stop"""
        self.monitoring = False
        
        # Generate final report
        session_data = self._collect_session_data()
        self._generate_final_report(session_data)
        
        # Cleanup
        self._cleanup_session()
    
    def _collect_session_data(self):
        """Collect all session data"""
        # Implementation depends on what you're tracking
        return {
            'end_time': datetime.utcnow().isoformat(),
            'duration': self._get_session_duration(),
            'activity_summary': self._get_activity_summary()
        }
    
    def _generate_final_report(self, session_data):
        """Generate comprehensive final report"""
        report_path = Path.home() / '.claude' / 'reports' / f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        report_path.parent.mkdir(exist_ok=True)
        
        report = f"""# Claude Code Session Report

## Session Overview
- **End Time**: {session_data['end_time']}
- **Duration**: {session_data['duration']}

## Activity Summary
{session_data['activity_summary']}

## Recommendations
- Review modified files for consistency
- Run tests on changed code
- Commit changes if satisfied
"""
        
        with open(report_path, 'w') as f:
            f.write(report)
    
    def _cleanup_session(self):
        """Clean up session resources"""
        # Remove temporary files
        # Archive logs
        # Clear caches
        pass
```

## Practice Exercise: Build a Dashboard Hook System

Create a hook system that:
1. Tracks all Claude operations in real-time
2. Sends notifications to a web dashboard
3. Generates visual reports on Stop
4. Supports multiple notification channels

<details>
<summary>Solution Outline</summary>

```python
# ~/.claude/hooks/dashboard_system.py

import json
import sys
import asyncio
import websockets
from flask import Flask, render_template
from threading import Thread
import sqlite3
from datetime import datetime

class DashboardHookSystem:
    def __init__(self):
        self.app = Flask(__name__)
        self.websocket_clients = set()
        self.db_path = Path.home() / '.claude' / 'dashboard.db'
        self._init_database()
        self._setup_routes()
    
    def _init_database(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS operations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME,
                    hook_type TEXT,
                    tool_name TEXT,
                    details TEXT
                )
            ''')
    
    def _setup_routes(self):
        @self.app.route('/')
        def dashboard():
            return render_template('dashboard.html')
        
        @self.app.route('/api/operations')
        def get_operations():
            with sqlite3.connect(self.db_path) as conn:
                ops = conn.execute(
                    "SELECT * FROM operations ORDER BY timestamp DESC LIMIT 100"
                ).fetchall()
            return json.dumps(ops)
    
    async def websocket_handler(self, websocket, path):
        """Handle WebSocket connections"""
        self.websocket_clients.add(websocket)
        try:
            await websocket.wait_closed()
        finally:
            self.websocket_clients.remove(websocket)
    
    async def broadcast_update(self, data):
        """Broadcast updates to all connected clients"""
        if self.websocket_clients:
            await asyncio.gather(
                *[client.send(json.dumps(data)) for client in self.websocket_clients]
            )
    
    def handle_hook(self, hook_type: str):
        """Handle any hook type"""
        hook_input = json.loads(sys.stdin.read())
        
        # Store in database
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO operations (timestamp, hook_type, tool_name, details) VALUES (?, ?, ?, ?)",
                (datetime.utcnow(), hook_type, hook_input.get('tool_name'), json.dumps(hook_input))
            )
        
        # Broadcast to dashboard
        asyncio.run(self.broadcast_update({
            'type': hook_type,
            'data': hook_input,
            'timestamp': datetime.utcnow().isoformat()
        }))
    
    def start_dashboard(self):
        """Start the web dashboard"""
        # Run Flask in thread
        flask_thread = Thread(target=lambda: self.app.run(port=5555))
        flask_thread.daemon = True
        flask_thread.start()
        
        # Start WebSocket server
        start_server = websockets.serve(self.websocket_handler, "localhost", 8765)
        asyncio.get_event_loop().run_until_complete(start_server)
        asyncio.get_event_loop().run_forever()

# HTML Template (save as templates/dashboard.html)
dashboard_html = '''
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .operation { padding: 10px; margin: 5px; border: 1px solid #ddd; }
        .notification { background: #fffacd; }
        .stop { background: #f0f0f0; }
    </style>
</head>
<body>
    <h1>Claude Code Operations Dashboard</h1>
    <div id="operations"></div>
    <canvas id="chart"></canvas>
    
    <script>
        const ws = new WebSocket('ws://localhost:8765');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            updateDashboard(data);
        };
        
        function updateDashboard(data) {
            const ops = document.getElementById('operations');
            const div = document.createElement('div');
            div.className = `operation ${data.type}`;
            div.innerHTML = `<strong>${data.type}</strong>: ${JSON.stringify(data.data)}`;
            ops.insertBefore(div, ops.firstChild);
        }
    </script>
</body>
</html>
'''
```
</details>

## Best Practices for Notification and Stop Hooks

### 1. Respect User Preferences
```python
def get_notification_preferences():
    """Load user notification preferences"""
    prefs_file = Path.home() / '.claude' / 'notification_prefs.json'
    if prefs_file.exists():
        with open(prefs_file) as f:
            return json.load(f)
    return {
        'quiet_hours': {'start': '22:00', 'end': '08:00'},
        'channels': ['desktop'],
        'priority_only': False
    }
```

### 2. Rate Limiting
```python
class RateLimitedNotifier:
    def __init__(self, max_per_minute=5):
        self.max_per_minute = max_per_minute
        self.recent_notifications = []
    
    def should_notify(self):
        now = time.time()
        # Remove old notifications
        self.recent_notifications = [
            t for t in self.recent_notifications 
            if now - t < 60
        ]
        
        if len(self.recent_notifications) < self.max_per_minute:
            self.recent_notifications.append(now)
            return True
        return False
```

### 3. Context-Aware Notifications
```python
def get_notification_context(hook_input):
    """Extract meaningful context for notifications"""
    tool_name = hook_input.get('tool_name', '')
    
    contexts = {
        'Bash': 'Command execution needs approval',
        'Edit': 'File modification needs review',
        'Write': 'New file creation needs confirmation'
    }
    
    return contexts.get(tool_name, 'Claude Code needs your attention')
```

## Summary

You've learned:
- ✅ Creating rich, multi-platform notifications
- ✅ Building comprehensive session reports
- ✅ Integrating with external services
- ✅ Implementing cleanup and archival systems
- ✅ Combining hooks for complex workflows

## Next Steps

In Lesson 5, we'll build:
- Complete hook ecosystems
- Production-ready configurations
- Team collaboration features
- Advanced monitoring and analytics

## Quick Reference

### Notification Hook Patterns
```bash
# Simple notification
echo "Claude needs input" | notify-send

# Rich notification with sound
osascript -e 'display notification "Message" sound name "Glass"'

# Multi-channel notification
python3 ~/.claude/hooks/notify_all_channels.py
```

### Stop Hook Patterns
```bash
# Simple logging
echo "Session ended: $(date)" >> log.txt

# Comprehensive reporting
python3 ~/.claude/hooks/generate_report.py

# Cleanup and archive
~/.claude/hooks/cleanup_session.sh
```

### Common Integration Points
- Slack: Webhooks for team notifications
- Discord: Rich embeds for detailed alerts
- Email: Critical notifications and reports
- SMS: High-priority alerts (via Twilio)
- Dashboard: Real-time monitoring