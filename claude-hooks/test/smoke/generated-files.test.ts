import {expect} from 'chai'
import {execSync} from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'

describe('Smoke Tests - Generated Files', () => {
  const testDir = path.join(__dirname, '..', '..', 'test-smoke-output')
  const binPath = path.join(__dirname, '..', '..', 'bin', 'run.js')

  before(async () => {
    // Set up once for all smoke tests
    await fs.remove(testDir)
    await fs.ensureDir(testDir)
    
    // Generate hooks
    execSync(`node ${binPath} init --yes`, {
      cwd: testDir,
      encoding: 'utf8'
    })
  })

  after(async () => {
    await fs.remove(testDir)
  })

  describe('settings.json', () => {
    it('should have valid JSON structure', async () => {
      const settingsPath = path.join(testDir, '.claude/settings.json')
      const settings = await fs.readJson(settingsPath)

      expect(settings).to.be.an('object')
      expect(settings.hooks).to.be.an('object')
      expect(settings.hooks.command).to.equal('bun .claude/hooks/index.ts')
      expect(settings.hooks.workingDirectory).to.equal('.')
      expect(settings.hooks.environment).to.be.an('object')
    })
  })

  describe('index.ts', () => {
    let indexContent: string

    before(async () => {
      const indexPath = path.join(testDir, '.claude/hooks/index.ts')
      indexContent = await fs.readFile(indexPath, 'utf8')
    })

    it('should have shebang for bun', () => {
      expect(indexContent).to.match(/^#!\/usr\/bin\/env bun/)
    })

    it('should import required functions from lib', () => {
      expect(indexContent).to.include("import {")
      expect(indexContent).to.include("runHook")
      expect(indexContent).to.include("from './lib'")
    })

    it('should contain security patterns', () => {
      expect(indexContent).to.include('DANGEROUS_FILE_OPS')
      expect(indexContent).to.include('/rm\\s+-rf\\s+[/~]/')
      expect(indexContent).to.include('SECRET_PATTERNS')
      expect(indexContent).to.include('api_key|password|secret|token')
    })

    it('should define preToolUse function', () => {
      expect(indexContent).to.match(/export\s+async\s+function\s+preToolUse/)
      expect(indexContent).to.include('PreToolUsePayload')
      expect(indexContent).to.include('HookResponse')
    })

    it('should call runHook with handlers', () => {
      expect(indexContent).to.match(/runHook\({\s*preToolUse\s*}\)/)
    })

    it('should handle Bash tool specifically', () => {
      expect(indexContent).to.include("payload.tool_name === 'Bash'")
      expect(indexContent).to.include('BashToolInput')
    })

    it('should return proper responses', () => {
      expect(indexContent).to.include("action: 'block'")
      expect(indexContent).to.include("action: 'continue'")
      expect(indexContent).to.include('stopReason')
    })
  })

  describe('lib.ts', () => {
    let libContent: string

    before(async () => {
      const libPath = path.join(testDir, '.claude/hooks/lib.ts')
      libContent = await fs.readFile(libPath, 'utf8')
    })

    it('should define all required types', () => {
      expect(libContent).to.include('export interface PreToolUsePayload')
      expect(libContent).to.include('export interface PostToolUsePayload')
      expect(libContent).to.include('export interface NotificationPayload')
      expect(libContent).to.include('export interface StopPayload')
      expect(libContent).to.include('export interface HookResponse')
      expect(libContent).to.include('export interface BashToolInput')
    })

    it('should export utility functions', () => {
      expect(libContent).to.include('export function log')
      expect(libContent).to.include('export function runHook')
      expect(libContent).to.include('export async function ensureSessionsDirectory')
      expect(libContent).to.include('export async function saveSessionData')
    })

    it('should handle stdin for hook communication', () => {
      expect(libContent).to.include("process.stdin.on('data'")
      expect(libContent).to.include('JSON.parse(data.toString())')
      expect(libContent).to.include('JSON.stringify')
    })
  })

  describe('.gitignore', () => {
    it('should ignore sessions directory', async () => {
      const gitignorePath = path.join(testDir, '.claude/hooks/.gitignore')
      const content = await fs.readFile(gitignorePath, 'utf8')
      expect(content).to.equal('sessions/\n')
    })
  })

  describe('directory structure', () => {
    it('should create sessions directory', async () => {
      const sessionsPath = path.join(testDir, '.claude/hooks/sessions')
      const exists = await fs.pathExists(sessionsPath)
      expect(exists).to.be.true

      const stats = await fs.stat(sessionsPath)
      expect(stats.isDirectory()).to.be.true
    })

    it('should have correct file permissions', async () => {
      const indexPath = path.join(testDir, '.claude/hooks/index.ts')
      const stats = await fs.stat(indexPath)
      
      // Check that file is readable
      expect(stats.mode & 0o400).to.be.above(0)
    })
  })
})