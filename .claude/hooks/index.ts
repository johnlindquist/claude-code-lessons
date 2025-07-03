#!/usr/bin/env bun

import {
  runHook,
  log,
  ensureSessionsDirectory,
  saveSessionData,
  type PreToolUsePayload,
  type PostToolUsePayload,
  type NotificationPayload,
  type StopPayload,
  type HookResponse,
  type BashToolInput
} from './lib';

// Ensure sessions directory exists on startup
await ensureSessionsDirectory();

// PreToolUse handler - validate and potentially block dangerous commands
export async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
  // Save session data
  await saveSessionData('PreToolUse', payload);
  
  // Example: Block dangerous commands
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
  }
  
  // Allow all other commands
  return { action: 'continue' };
}

// PostToolUse handler - log tool results
export async function postToolUse(payload: PostToolUsePayload): Promise<void> {
  await saveSessionData('PostToolUse', payload);
  log('Tool executed:', payload.tool_name);
}

// Notification handler - log notifications
export async function notification(payload: NotificationPayload): Promise<void> {
  await saveSessionData('Notification', payload);
  log('Notification received:', payload.message);
}

// Stop handler - log session end
export async function stop(payload: StopPayload): Promise<void> {
  await saveSessionData('Stop', payload);
  log('Session ended:', payload.session_id);
}

// Run the hook with our handlers
runHook({
  preToolUse,
  postToolUse,
  notification,
  stop
});