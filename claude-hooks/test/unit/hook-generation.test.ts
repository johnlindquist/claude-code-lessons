import {expect} from 'chai'
import Init from '../../src/commands/init'

describe('Hook Generation Logic', () => {
  // Access private method for testing
  const init = new Init([], {} as any)
  const generateIndexFile = (init as any).generateIndexFile.bind(init)

  describe('generateIndexFile', () => {
    it('should generate minimal hooks when only preToolUse is selected', () => {
      const content = generateIndexFile(
        {preToolUse: true, postToolUse: false, notification: false, stop: false},
        {
          blockDangerousFileOps: true,
          preventSecretsExposure: true,
          requireProductionConfirmation: false,
          blockNetworkRequests: false,
          customRegexPatterns: false
        },
        {type: 'json', path: './sessions'},
        'nodejs'
      )

      expect(content).to.include('function preToolUse')
      expect(content).not.to.include('function postToolUse')
      expect(content).not.to.include('function notification')
      expect(content).not.to.include('function stop')
      expect(content).to.include('DANGEROUS_FILE_OPS')
      expect(content).to.include('SECRET_PATTERNS')
      expect(content).to.match(/runHook\({\s*preToolUse\s*}\)/)
    })

    it('should generate all hooks when all are selected', () => {
      const content = generateIndexFile(
        {preToolUse: true, postToolUse: true, notification: true, stop: true},
        {
          blockDangerousFileOps: false,
          preventSecretsExposure: false,
          requireProductionConfirmation: false,
          blockNetworkRequests: false,
          customRegexPatterns: false
        },
        {type: 'json', path: './sessions'},
        'nodejs'
      )

      expect(content).to.include('function preToolUse')
      expect(content).to.include('function postToolUse')
      expect(content).to.include('function notification')
      expect(content).to.include('function stop')
      expect(content).to.match(/runHook\({\s*preToolUse,\s*postToolUse,\s*notification,\s*stop\s*}\)/)
    })

    it('should not include session storage code when storage is none', () => {
      const content = generateIndexFile(
        {preToolUse: true, postToolUse: false, notification: false, stop: false},
        {
          blockDangerousFileOps: false,
          preventSecretsExposure: false,
          requireProductionConfirmation: false,
          blockNetworkRequests: false,
          customRegexPatterns: false
        },
        {type: 'none'},
        'nodejs'
      )

      expect(content).not.to.include('ensureSessionsDirectory')
      expect(content).not.to.include('saveSessionData')
    })

    it('should include production patterns when enabled', () => {
      const content = generateIndexFile(
        {preToolUse: true, postToolUse: false, notification: false, stop: false},
        {
          blockDangerousFileOps: false,
          preventSecretsExposure: false,
          requireProductionConfirmation: true,
          blockNetworkRequests: false,
          customRegexPatterns: false
        },
        {type: 'none'},
        'nodejs'
      )

      expect(content).to.include('PRODUCTION_PATTERNS')
      expect(content).to.include('--context=production')
      expect(content).to.include('Production operation detected')
    })

    it('should generate correct imports based on selections', () => {
      const content = generateIndexFile(
        {preToolUse: false, postToolUse: true, notification: true, stop: false},
        {
          blockDangerousFileOps: false,
          preventSecretsExposure: false,
          requireProductionConfirmation: false,
          blockNetworkRequests: false,
          customRegexPatterns: false
        },
        {type: 'json', path: './sessions'},
        'nodejs'
      )

      expect(content).to.include('type PostToolUsePayload')
      expect(content).to.include('type NotificationPayload')
      expect(content).not.to.include('type PreToolUsePayload')
      expect(content).not.to.include('type StopPayload')
    })
  })
})