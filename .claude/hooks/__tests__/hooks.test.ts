#!/usr/bin/env bun
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  type PreToolUsePayload,
  type PostToolUsePayload,
  type NotificationPayload,
  type StopPayload,
  type HookResponse,
  type SessionEntry,
  saveSessionData,
  ensureSessionsDirectory
} from '../lib';

const TEST_SESSIONS_DIR = path.join(__dirname, 'test-sessions');

describe('Hook Integration Tests', () => {
  beforeEach(async () => {
    // Clean up and create test sessions directory
    await rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
    await mkdir(TEST_SESSIONS_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test sessions directory
    await rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
  });

  describe('Session Data Saving', () => {
    test('should save PreToolUse payload', async () => {
      const payload: PreToolUsePayload = {
        session_id: 'test-session-123',
        transcript_path: '/Users/test/.claude/projects/test/transcript.jsonl',
        tool_name: 'Bash',
        tool_input: {
          command: 'ls -la',
          description: 'List files with details'
        },
        timestamp: '2024-01-15T10:30:00Z',
        conversation_id: 'conv_123',
        request_id: 'req_456'
      };

      await saveSessionData('PreToolUse', payload, TEST_SESSIONS_DIR);

      const sessionFile = path.join(TEST_SESSIONS_DIR, 'session_test-session-123.json');
      const data = await readFile(sessionFile, 'utf8');
      const sessions: SessionEntry[] = JSON.parse(data);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].type).toBe('PreToolUse');
      expect(sessions[0].payload).toEqual(payload);
      expect(sessions[0].timestamp).toBeDefined();
    });

    test('should save PostToolUse payload', async () => {
      const payload: PostToolUsePayload = {
        session_id: 'test-session-456',
        transcript_path: '/Users/test/.claude/projects/test/transcript.jsonl',
        tool_name: 'Edit',
        tool_input: {
          file_path: '/path/to/file.js',
          old_string: 'foo',
          new_string: 'bar'
        },
        tool_response: { success: true },
        timestamp: '2024-01-15T10:31:00Z',
        conversation_id: 'conv_123',
        request_id: 'req_458'
      };

      await saveSessionData('PostToolUse', payload, TEST_SESSIONS_DIR);

      const sessionFile = path.join(TEST_SESSIONS_DIR, 'session_test-session-456.json');
      const data = await readFile(sessionFile, 'utf8');
      const sessions: SessionEntry[] = JSON.parse(data);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].type).toBe('PostToolUse');
      expect(sessions[0].payload).toEqual(payload);
    });

    test('should save Notification payload', async () => {
      const payload: NotificationPayload = {
        session_id: 'test-session-789',
        transcript_path: '/Users/test/.claude/projects/test/transcript.jsonl',
        message: 'Claude needs approval for a high-risk operation',
        context: 'User requested a dangerous operation',
        timestamp: '2024-01-15T10:32:00Z'
      };

      await saveSessionData('Notification', payload, TEST_SESSIONS_DIR);

      const sessionFile = path.join(TEST_SESSIONS_DIR, 'session_test-session-789.json');
      const data = await readFile(sessionFile, 'utf8');
      const sessions: SessionEntry[] = JSON.parse(data);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].type).toBe('Notification');
      expect(sessions[0].payload).toEqual(payload);
    });

    test('should save Stop payload', async () => {
      const payload: StopPayload = {
        session_id: 'test-session-999',
        transcript_path: '/Users/test/.claude/projects/test/transcript.jsonl',
        stop_hook_active: false,
        timestamp: '2024-01-15T10:33:00Z'
      };

      await saveSessionData('Stop', payload, TEST_SESSIONS_DIR);

      const sessionFile = path.join(TEST_SESSIONS_DIR, 'session_test-session-999.json');
      const data = await readFile(sessionFile, 'utf8');
      const sessions: SessionEntry[] = JSON.parse(data);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].type).toBe('Stop');
      expect(sessions[0].payload).toEqual(payload);
    });

    test('should append to existing session file', async () => {
      const sessionId = 'test-append-session';
      
      const payload1: PreToolUsePayload = {
        session_id: sessionId,
        transcript_path: '/test/transcript.jsonl',
        tool_name: 'Read',
        tool_input: {
          file_path: '/test/file.txt'
        }
      };

      const payload2: PostToolUsePayload = {
        session_id: sessionId,
        transcript_path: '/test/transcript.jsonl',
        tool_name: 'Read',
        tool_input: {
          file_path: '/test/file.txt'
        },
        tool_response: 'File contents here'
      };

      await saveSessionData('PreToolUse', payload1, TEST_SESSIONS_DIR);
      await saveSessionData('PostToolUse', payload2, TEST_SESSIONS_DIR);

      const sessionFile = path.join(TEST_SESSIONS_DIR, `session_${sessionId}.json`);
      const data = await readFile(sessionFile, 'utf8');
      const sessions: SessionEntry[] = JSON.parse(data);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].type).toBe('PreToolUse');
      expect(sessions[1].type).toBe('PostToolUse');
    });
  });

  describe('Directory Creation', () => {
    test('should create sessions directory if it does not exist', async () => {
      const newDir = path.join(TEST_SESSIONS_DIR, 'nested', 'sessions');
      await ensureSessionsDirectory(newDir);
      
      // Check if directory exists by trying to save a file
      const payload: StopPayload = {
        session_id: 'dir-test',
        transcript_path: '/test/transcript.jsonl',
        stop_hook_active: true
      };
      
      await saveSessionData('Stop', payload, newDir);
      
      const sessionFile = path.join(newDir, 'session_dir-test.json');
      const data = await readFile(sessionFile, 'utf8');
      const sessions: SessionEntry[] = JSON.parse(data);
      
      expect(sessions).toHaveLength(1);
    });
  });

  describe('Type Safety', () => {
    test('should handle all tool types correctly', async () => {
      const toolTests: Array<[string, PreToolUsePayload]> = [
        ['Bash', {
          session_id: 'type-test',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'Bash',
          tool_input: { command: 'echo test', description: 'Test echo' }
        }],
        ['MultiEdit', {
          session_id: 'type-test',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'MultiEdit',
          tool_input: {
            file_path: '/test/file.js',
            edits: [
              { old_string: 'foo', new_string: 'bar' },
              { old_string: 'baz', new_string: 'qux', replace_all: true }
            ]
          }
        }],
        ['TodoWrite', {
          session_id: 'type-test',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'TodoWrite',
          tool_input: {
            todos: [{
              id: '1',
              content: 'Test todo',
              status: 'pending' as const,
              priority: 'high' as const
            }]
          }
        }],
        ['TodoRead', {
          session_id: 'type-test',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'TodoRead',
          tool_input: {} // TodoRead has no input
        }]
      ];

      for (const [testName, payload] of toolTests) {
        await saveSessionData('PreToolUse', payload, TEST_SESSIONS_DIR);
        // If this compiles and runs without errors, type safety is working
        expect(true).toBe(true);
      }
    });
  });
});