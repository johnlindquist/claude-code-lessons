import { mkdir, readFile, writeFile, exists } from 'node:fs/promises';
import path from 'node:path';
import type { PreToolUsePayload, PostToolUsePayload, NotificationPayload, StopPayload } from './claude-hooks-base';

// Interface for session entry
export interface SessionEntry {
  type: string;
  payload: PreToolUsePayload | PostToolUsePayload | NotificationPayload | StopPayload;
  timestamp: string;
}

// Helper function to save session data
export async function saveSessionData(hookType: string, payload: any) {
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
    
    const sessionFile = path.join(process.cwd(), 'sessions', sessionFileName);
    console.error(`[${hookType}] Using session file:`, sessionFile);
    
    // Read existing session data or create empty array
    let sessionData: SessionEntry[] = [];
    if (await exists(sessionFile)) {
      try {
        const existingData = await readFile(sessionFile, 'utf8');
        if (existingData.trim()) {
          sessionData = JSON.parse(existingData);
        }
      } catch (error) {
        console.error(`[${hookType}] Error reading existing session file:`, error);
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
    console.error(`[${hookType}] Session data saved. Total entries:`, sessionData.length);
    
  } catch (error) {
    console.error(`[${hookType}] Error saving session data:`, error);
  }
}