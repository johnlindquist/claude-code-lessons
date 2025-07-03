#!/usr/bin/env bun

import { runHook, log, type PreToolUsePayload, type PostToolUsePayload, type NotificationPayload, type StopPayload, type HookResponse } from './claude-hooks-base';

// PreToolUse: Called before any tool is executed
// Return { action: 'block', stopReason: 'reason' } to prevent execution
// Return { action: 'continue' } to allow execution
async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
  log('Tool about to run:', payload.tool_name);
  
  // Your custom logic here
  
  return { action: 'continue' };
}

// PostToolUse: Called after a tool has been executed
async function postToolUse(payload: PostToolUsePayload): Promise<void> {
  log('Tool completed:', payload.tool_name);
  
  // Your custom logic here
}

// Notification: Called when Claude sends a notification
async function notification(payload: NotificationPayload): Promise<void> {
  log('Notification:', payload.message);
  
  // Your custom logic here
}

// Stop: Called when the session is ending
async function stop(payload: StopPayload): Promise<void> {
  log('Session ending:', payload.session_id);
  
  // Your custom logic here
}

// Run the hook system with your handlers
runHook({
  preToolUse,
  postToolUse,
  notification,
  stop
});