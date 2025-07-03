#!/usr/bin/env bun

import { mkdir, readFile, writeFile, exists } from 'node:fs/promises';
import path from 'node:path';

// Type definitions for all tool inputs
export interface BashToolInput {
  command: string;
  description?: string;
  timeout?: number;
}

export interface EditToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface ReadToolInput {
  file_path: string;
  limit?: number;
  offset?: number;
}

export interface WriteToolInput {
  file_path: string;
  content: string;
}

export interface MultiEditToolInput {
  file_path: string;
  edits: Array<{
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }>;
}

export interface GrepToolInput {
  pattern: string;
  path?: string;
  include?: string;
}

export interface GlobToolInput {
  pattern: string;
  path?: string;
}

export interface LSToolInput {
  path: string;
  ignore?: string[];
}

export interface WebFetchToolInput {
  url: string;
  prompt: string;
}

export interface WebSearchToolInput {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
}

export interface TodoWriteToolInput {
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    priority: 'high' | 'medium' | 'low';
    id: string;
  }>;
}

export interface NotebookReadToolInput {
  notebook_path: string;
  cell_id?: string;
}

export interface NotebookEditToolInput {
  notebook_path: string;
  new_source: string;
  cell_id?: string;
  cell_type?: 'code' | 'markdown';
  edit_mode?: 'replace' | 'insert' | 'delete';
}

export interface ExitPlanModeToolInput {
  plan: string;
}

export interface TaskToolInput {
  description: string;
  prompt: string;
}

// Union type for all possible tool inputs
export type ToolInput = 
  | BashToolInput
  | EditToolInput
  | ReadToolInput
  | WriteToolInput
  | MultiEditToolInput
  | GrepToolInput
  | GlobToolInput
  | LSToolInput
  | WebFetchToolInput
  | WebSearchToolInput
  | TodoWriteToolInput
  | NotebookReadToolInput
  | NotebookEditToolInput
  | ExitPlanModeToolInput
  | TaskToolInput
  | Record<string, never>; // For TodoRead which has no input

// Tool names type
export type ToolName = 
  | 'Bash'
  | 'Edit'
  | 'Read'
  | 'Write'
  | 'MultiEdit'
  | 'Grep'
  | 'Glob'
  | 'LS'
  | 'WebFetch'
  | 'WebSearch'
  | 'TodoWrite'
  | 'TodoRead'
  | 'NotebookRead'
  | 'NotebookEdit'
  | 'exit_plan_mode'
  | 'Task';

// Hook payload types based on real data
export interface PreToolUsePayload {
  session_id: string;
  transcript_path: string;
  tool_name: ToolName;
  tool_input: ToolInput;
  timestamp?: string;
  conversation_id?: string;
  request_id?: string;
}

export interface PostToolUsePayload {
  session_id: string;
  transcript_path: string;
  tool_name: ToolName;
  tool_input: ToolInput;
  tool_response?: unknown; // Tool responses can vary widely
  timestamp?: string;
  conversation_id?: string;
  request_id?: string;
}

export interface NotificationPayload {
  session_id: string;
  transcript_path: string;
  message: string;
  context?: string;
  timestamp?: string;
}

export interface StopPayload {
  session_id: string;
  transcript_path: string;
  stop_hook_active: boolean;
  timestamp?: string;
}

// Response type for PreToolUse hooks
export interface HookResponse {
  action: 'continue' | 'block';
  stopReason?: string;
  suppressOutput?: boolean;
}

// Hook handler functions that users can override
export type PreToolUseHandler = (payload: PreToolUsePayload) => Promise<HookResponse> | HookResponse;
export type PostToolUseHandler = (payload: PostToolUsePayload) => Promise<void> | void;
export type NotificationHandler = (payload: NotificationPayload) => Promise<void> | void;
export type StopHandler = (payload: StopPayload) => Promise<void> | void;

// Interface for session entry
export interface SessionEntry {
  type: 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop';
  payload: PreToolUsePayload | PostToolUsePayload | NotificationPayload | StopPayload;
  timestamp: string;
}

// Debug logging to stderr
export const log = (...args: unknown[]) => {
  const hookType = process.argv[2] || 'unknown';
  console.error(`[${hookType}]`, ...args);
};

// Ensure sessions directory exists
export async function ensureSessionsDirectory(sessionsPath: string = './sessions'): Promise<void> {
  try {
    await mkdir(sessionsPath, { recursive: true });
  } catch (error) {
    log('Error creating sessions directory:', error);
  }
}

// Helper function to save session data
export async function saveSessionData(
  hookType: 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop',
  payload: PreToolUsePayload | PostToolUsePayload | NotificationPayload | StopPayload,
  sessionsPath: string = './sessions'
): Promise<void> {
  try {
    // Create the wrapped object
    const wrappedObject: SessionEntry = {
      type: hookType,
      payload: payload,
      timestamp: new Date().toISOString()
    };
    
    // Determine session file based on session_id
    let sessionFileName = 'session.json';
    if ('session_id' in payload && payload.session_id) {
      sessionFileName = `session_${payload.session_id}.json`;
    }
    
    const sessionFile = path.join(sessionsPath, sessionFileName);
    log(`Using session file:`, sessionFile);
    
    // Read existing session data or create empty array
    let sessionData: SessionEntry[] = [];
    if (await exists(sessionFile)) {
      try {
        const existingData = await readFile(sessionFile, 'utf8');
        if (existingData.trim()) {
          sessionData = JSON.parse(existingData);
        }
      } catch (error) {
        log('Error reading existing session file:', error);
      }
    }
    
    // Ensure sessionData is an array
    if (!Array.isArray(sessionData)) {
      sessionData = [];
    }
    
    // Append the new object
    sessionData.push(wrappedObject);
    
    // Write back to file
    await writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
    log('Session data saved. Total entries:', sessionData.length);
    
  } catch (error) {
    log('Error saving session data:', error);
  }
}

// Function to read stdin
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let inputData = '';
    
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      inputData += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(inputData);
    });
    
    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
}

// Default implementations
const defaultPreToolUse: PreToolUseHandler = (_payload) => {
  return { action: 'continue' };
};

const defaultPostToolUse: PostToolUseHandler = (_payload) => {
  // Default: do nothing
};

const defaultNotification: NotificationHandler = (_payload) => {
  // Default: do nothing
};

const defaultStop: StopHandler = (_payload) => {
  // Default: do nothing
};

// Main runner function
export async function runHook(handlers: {
  preToolUse?: PreToolUseHandler;
  postToolUse?: PostToolUseHandler;
  notification?: NotificationHandler;
  stop?: StopHandler;
} = {}) {
  // Get hook type from command line
  const hookType = process.argv[2];
  if (!hookType) {
    console.error('Usage: bun <script> <hook-type>');
    process.exit(1);
  }

  // Merge with defaults
  const finalHandlers = {
    preToolUse: handlers.preToolUse || defaultPreToolUse,
    postToolUse: handlers.postToolUse || defaultPostToolUse,
    notification: handlers.notification || defaultNotification,
    stop: handlers.stop || defaultStop,
  };

  try {
    // Read input from stdin
    const inputData = await readStdin();
    log('Received input length:', inputData.length);
    
    // Parse the input JSON
    const payload = JSON.parse(inputData);
    log('Parsed payload:', JSON.stringify(payload, null, 2));
    
    // Route to appropriate handler
    switch (hookType) {
      case 'PreToolUse':
        const response = await finalHandlers.preToolUse(payload as PreToolUsePayload);
        // Output response for Claude to read
        console.log(JSON.stringify(response));
        break;
        
      case 'PostToolUse':
        await finalHandlers.postToolUse(payload as PostToolUsePayload);
        break;
        
      case 'Notification':
        await finalHandlers.notification(payload as NotificationPayload);
        break;
        
      case 'Stop':
        await finalHandlers.stop(payload as StopPayload);
        break;
        
      default:
        log(`Unknown hook type: ${hookType}`);
        // For PreToolUse, still return a valid response
        if (hookType === 'PreToolUse') {
          console.log(JSON.stringify({ action: 'continue' }));
        }
    }
    
    process.exit(0);
    
  } catch (error) {
    log('Error processing hook:', error);
    
    // Always return a valid response for PreToolUse hooks
    if (hookType === 'PreToolUse') {
      const errorResponse: HookResponse = {
        action: 'continue'
      };
      console.log(JSON.stringify(errorResponse));
    }
    
    process.exit(0);
  }
}