import { isProduction } from '@rspress/shared'
import { CloudAuthRegion } from './types'

export const CLOUD_AUTH_ORIGIN_KEY = '__CLOUD_AUTH_ORIGIN__'
export const CLOUD_AUTH_TOKEN_KEY = '__CLOUD_AUTH_TOKEN__'

const CLOUD_AUTH_ORIGINS: CloudAuthRegion[] = [
  {
    name: 'global',
    value: 'https://cloud.alauda.io',
  },
  {
    name: 'china',
    value: 'https://cloud.alauda.cn',
  },
]

if (!isProduction()) {
  CLOUD_AUTH_ORIGINS.unshift({
    name: 'local',
    value: '',
  })
}

export const CLOUD_AUTH_ORIGIN_VALUES = CLOUD_AUTH_ORIGINS.map(
  ({ value }) => value,
)

export { CLOUD_AUTH_ORIGINS }
