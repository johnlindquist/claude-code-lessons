#!/usr/bin/env bun
import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test';
import { rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PreToolUsePayload, HookResponse } from '../lib';

// Mock the process.argv and stdin for testing
const originalArgv = process.argv;
const originalStdin = process.stdin;

describe('Hook Implementations', () => {
  const TEST_SESSIONS_DIR = path.join(__dirname, 'hook-impl-test-sessions');

  beforeEach(async () => {
    await rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(TEST_SESSIONS_DIR, { recursive: true, force: true });
    process.argv = originalArgv;
  });

  describe('PreToolUse Hook', () => {
    test('should block dangerous rm -rf commands', async () => {
      // Import the handlers after setting up the test environment
      process.env.TEST_MODE = 'true';
      
      // Dynamic import to get fresh module
      const { preToolUse } = await import('../index');
      
      const dangerousPayloads: PreToolUsePayload[] = [
        {
          session_id: 'test-dangerous-1',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'Bash',
          tool_input: {
            command: 'rm -rf /',
            description: 'Remove root'
          }
        },
        {
          session_id: 'test-dangerous-2',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'Bash',
          tool_input: {
            command: 'sudo rm -rf ~',
            description: 'Remove home'
          }
        }
      ];

      for (const payload of dangerousPayloads) {
        const response = await preToolUse(payload);
        expect(response.action).toBe('block');
        expect(response.stopReason).toContain('Dangerous command detected');
      }
    });

    test('should allow safe commands', async () => {
      const { preToolUse } = await import('../index');
      
      const safePayloads: PreToolUsePayload[] = [
        {
          session_id: 'test-safe-1',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'Bash',
          tool_input: {
            command: 'ls -la',
            description: 'List files'
          }
        },
        {
          session_id: 'test-safe-2',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'Bash',
          tool_input: {
            command: 'rm test.txt',
            description: 'Remove single file'
          }
        },
        {
          session_id: 'test-safe-3',
          transcript_path: '/test/transcript.jsonl',
          tool_name: 'Edit',
          tool_input: {
            file_path: '/test/file.js',
            old_string: 'foo',
            new_string: 'bar'
          }
        }
      ];

      for (const payload of safePayloads) {
        const response = await preToolUse(payload);
        expect(response.action).toBe('continue');
        expect(response.stopReason).toBeUndefined();
      }
    });
  });

  describe('Real Session Data Tests', () => {
    test('should handle payloads from test-payloads.json', async () => {
      const testPayloadsPath = path.join(__dirname, '../../../scripts/test-payloads.json');
      const testPayloadsContent = await readFile(testPayloadsPath, 'utf8');
      const testPayloads = JSON.parse(testPayloadsContent);

      const { preToolUse } = await import('../index');

      // Test the dangerous payload
      const dangerousPayload: PreToolUsePayload = {
        session_id: 'test-from-json',
        transcript_path: '/test/transcript.jsonl',
        ...testPayloads.PreToolUse_dangerous
      };
      
      const blockResponse = await preToolUse(dangerousPayload);
      expect(blockResponse.action).toBe('block');

      // Test the safe payload
      const safePayload: PreToolUsePayload = {
        session_id: 'test-from-json',
        transcript_path: '/test/transcript.jsonl',
        ...testPayloads.PreToolUse
      };
      
      const allowResponse = await preToolUse(safePayload);
      expect(allowResponse.action).toBe('continue');
    });
  });
});