#!/usr/bin/env bun

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

// Hook payload types based on real data
export interface PreToolUsePayload {
  session_id: string;
  transcript_path: string;
  tool_name: string;
  tool_input: ToolInput;
}

export interface PostToolUsePayload {
  session_id: string;
  transcript_path: string;
  tool_name: string;
  tool_input: ToolInput;
  tool_response?: any;
}

export interface NotificationPayload {
  session_id: string;
  transcript_path: string;
  message: string;
}

export interface StopPayload {
  session_id: string;
  transcript_path: string;
  stop_hook_active: boolean;
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

// Default implementations
const defaultPreToolUse: PreToolUseHandler = (payload) => {
  return { action: 'continue' };
};

const defaultPostToolUse: PostToolUseHandler = (payload) => {
  // Default: do nothing
};

const defaultNotification: NotificationHandler = (payload) => {
  // Default: do nothing
};

const defaultStop: StopHandler = (payload) => {
  // Default: do nothing
};

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

// Debug logging to stderr
export const log = (...args: any[]) => {
  const hookType = process.argv[2] || 'unknown';
  console.error(`[${hookType}]`, ...args);
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