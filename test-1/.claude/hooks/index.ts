#!/usr/bin/env bun

import {
  runHook,
  log,
  ensureSessionsDirectory,
  saveSessionData,
  type PreToolUsePayload,
  type HookResponse,
  type BashToolInput
} from './lib';

// Ensure sessions directory exists on startup
await ensureSessionsDirectory();

// Security patterns based on your selections
const DANGEROUS_FILE_OPS = [
  /rm\s+-rf\s+[/~]/, // Prevent deletion of root or home
  /chmod\s+777/, // Prevent overly permissive permissions
  /chown\s+-R\s+root/, // Prevent changing ownership to root
];
const SECRET_PATTERNS = [
  /(api_key|password|secret|token)\s*[:=]\s*["']?\w+/i,
  /AWS_[A-Z_]+=['"]?[\w/+=]+/,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/,
];

// PreToolUse handler - validate and potentially block dangerous commands
export async function preToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
  // Save session data
  await saveSessionData('PreToolUse', payload);

  if (payload.tool_name === 'Bash' && payload.tool_input && 'command' in payload.tool_input) {
    const bashInput = payload.tool_input as BashToolInput;
    const command = bashInput.command;

    // Check for dangerous file operations
    for (const pattern of DANGEROUS_FILE_OPS) {
      if (pattern.test(command)) {
        return {
          action: 'block',
          stopReason: `Dangerous file operation detected: ${pattern}`
        };
      }
    }

    // Check for potential secrets exposure
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(command)) {
        return {
          action: 'block',
          stopReason: 'Potential secret exposure detected in command'
        };
      }
    }
  }
  
  // Allow all other commands
  return { action: 'continue' };
}

// Run the hook with our handlers
runHook({
  preToolUse
});
