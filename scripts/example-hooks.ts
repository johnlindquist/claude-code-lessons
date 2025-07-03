#!/usr/bin/env bun

import { runHook, log, type PreToolUsePayload, type PostToolUsePayload, type NotificationPayload, type StopPayload, type HookResponse, type BashToolInput } from './claude-hooks-base';
import { writeFile, readFile, exists } from 'node:fs/promises';
import path from 'node:path';

// Example: Custom PreToolUse handler that blocks dangerous commands
async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
  log('PreToolUse hook called for tool:', payload.tool_name);
  
  // Example: Block dangerous bash commands
  if (payload.tool_name === 'Bash' && payload.tool_input && 'command' in payload.tool_input) {
    const bashInput = payload.tool_input as BashToolInput;
    const command = bashInput.command;
    
    // Block rm -rf commands on system directories
    if (command && (command.includes('rm -rf /') || command.includes('rm -rf ~'))) {
      return {
        action: 'block',
        stopReason: 'Dangerous command detected: rm -rf on system directories'
      };
    }
    
    // Block commands that might expose secrets
    if (command && (command.includes('cat ~/.ssh/') || command.includes('env | grep'))) {
      return {
        action: 'block',
        stopReason: 'Command might expose sensitive information'
      };
    }
  }
  
  // Allow all other commands
  return { action: 'continue' };
}

// Example: Custom PostToolUse handler that logs tool usage
async function postToolUse(payload: PostToolUsePayload): Promise<void> {
  log('PostToolUse hook called for tool:', payload.tool_name);
  
  // Example: Log successful bash commands to a file
  if (payload.tool_name === 'Bash' && payload.tool_response) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      tool: payload.tool_name,
      input: payload.tool_input,
      response: payload.tool_response,
      session_id: payload.session_id
    };
    
    // Append to log file
    const logFile = path.join(process.cwd(), 'bash-commands.log');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      await writeFile(logFile, logLine, { flag: 'a' });
      log('Logged bash command to file');
    } catch (error) {
      log('Failed to log bash command:', error);
    }
  }
}

// Example: Custom Notification handler
async function notification(payload: NotificationPayload): Promise<void> {
  log('Notification received:', payload.message);
  
  // Example: Track permission requests
  if (payload.message.includes('needs your permission')) {
    const notificationLog = {
      timestamp: new Date().toISOString(),
      message: payload.message,
      session_id: payload.session_id
    };
    
    // You could send this to a monitoring system, log it, etc.
    log('Permission request:', notificationLog);
  }
}

// Example: Custom Stop handler
async function stop(payload: StopPayload): Promise<void> {
  log('Session stopping:', payload.session_id);
  
  // Example: Create a session summary
  const summary = {
    session_id: payload.session_id,
    ended_at: new Date().toISOString(),
    transcript_path: payload.transcript_path,
    stop_hook_active: payload.stop_hook_active
  };
  
  // Save session summary
  const summaryFile = path.join(process.cwd(), `session-summary-${payload.session_id}.json`);
  
  try {
    await writeFile(summaryFile, JSON.stringify(summary, null, 2));
    log('Session summary saved to:', summaryFile);
  } catch (error) {
    log('Failed to save session summary:', error);
  }
}

// Run the hook with our custom handlers
runHook({
  preToolUse,
  postToolUse,
  notification,
  stop
});