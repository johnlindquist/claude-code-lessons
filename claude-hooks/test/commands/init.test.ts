import {expect, test} from '@oclif/test'
import * as fs from 'fs-extra'
import * as path from 'path'

describe('init', () => {
  const testDir = path.join(__dirname, '..', '..', 'test-output')

  beforeEach(async () => {
    // Clean up and create test directory
    await fs.remove(testDir)
    await fs.ensureDir(testDir)
    process.chdir(testDir)
  })

  afterEach(async () => {
    // Clean up
    process.chdir(__dirname)
    await fs.remove(testDir)
  })

  describe('help', () => {
    test
      .stdout()
      .command(['init', '--help'])
      .it('shows help information', ctx => {
        expect(ctx.stdout).to.contain('Initialize Claude Code hooks')
        expect(ctx.stdout).to.contain('--force')
        expect(ctx.stdout).to.contain('--yes')
      })
  })

  describe('non-interactive mode', () => {
    test
      .stdout()
      .command(['init', '--yes'])
      .it('runs with default settings', ctx => {
        expect(ctx.stdout).to.contain('Welcome to Claude Hooks Setup Wizard')
        expect(ctx.stdout).to.contain('Claude Code hooks setup complete')
      })

    test
      .stdout()
      .command(['init', '--yes'])
      .it('creates all required files', async ctx => {
        // Check that all files were created
        expect(await fs.pathExists('.claude/settings.json')).to.be.true
        expect(await fs.pathExists('.claude/hooks/index.ts')).to.be.true
        expect(await fs.pathExists('.claude/hooks/lib.ts')).to.be.true
        expect(await fs.pathExists('.claude/hooks/.gitignore')).to.be.true
        expect(await fs.pathExists('.claude/hooks/sessions')).to.be.true
      })

    test
      .stdout()
      .command(['init', '--yes'])
      .it('generates correct settings.json', async ctx => {
        const settings = await fs.readJson('.claude/settings.json')
        expect(settings).to.have.property('hooks')
        expect(settings.hooks).to.deep.equal({
          command: 'bun .claude/hooks/index.ts',
          workingDirectory: '.',
          environment: {}
        })
      })

    test
      .stdout()
      .command(['init', '--yes'])
      .it('includes security patterns in generated hooks', async ctx => {
        const indexContent = await fs.readFile('.claude/hooks/index.ts', 'utf8')
        expect(indexContent).to.contain('DANGEROUS_FILE_OPS')
        expect(indexContent).to.contain('SECRET_PATTERNS')
        expect(indexContent).to.contain('preToolUse')
        expect(indexContent).to.contain('runHook')
      })

    test
      .stdout()
      .command(['init', '--yes'])
      .it('shows Bun warning', ctx => {
        expect(ctx.stdout).to.contain('Bun is required')
      })
  })

  describe('force flag', () => {
    test
      .stdout()
      .command(['init', '--yes'])
      .then(() => test
        .stdout()
        .command(['init', '--yes', '--force'])
        .it('overwrites existing files without prompting', ctx => {
          expect(ctx.stdout).to.contain('Welcome to Claude Hooks Setup Wizard')
          expect(ctx.stdout).to.contain('Claude Code hooks setup complete')
          expect(ctx.stdout).not.to.contain('already exist')
        })
      )
  })

  describe('error handling', () => {
    test
      .stderr()
      .do(async () => {
        // Make directory read-only
        await fs.chmod(testDir, 0o555)
      })
      .finally(async () => {
        // Restore permissions
        await fs.chmod(testDir, 0o755)
      })
      .command(['init', '--yes'])
      .catch(err => {
        expect(err.message).to.contain('permission denied')
      })
      .it('handles permission errors gracefully')
  })
})