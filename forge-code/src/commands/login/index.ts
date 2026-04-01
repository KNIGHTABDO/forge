import type { Command } from '../../commands.js'
import { hasForgeTeamApiKeyAuth } from '../../utils/auth.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: hasForgeTeamApiKeyAuth()
      ? 'Switch ForgeTeam accounts'
      : 'Sign in with your ForgeTeam account',
    isEnabled: () => !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND),
    load: () => import('./login.js'),
  }) satisfies Command




