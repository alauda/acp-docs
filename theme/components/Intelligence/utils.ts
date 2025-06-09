import { decodeUrl } from 'ab64'

import { AuthInfo, AuthTokenInfo } from './types'

export const setLocalStorage = (key: string, value?: string) => {
  if (value) {
    localStorage.setItem(key, value)
  } else {
    localStorage.removeItem(key)
  }
}

export const getAuthInfoFromToken = (
  token?: string | null,
): AuthInfo | undefined => {
  if (!token) {
    return
  }

  let authTokenInfo: AuthTokenInfo

  try {
    authTokenInfo = JSON.parse(decodeUrl(token.split('.')[1])) as AuthTokenInfo
  } catch (err) {
    console.error('jwt decode failed:', err)
    return
  }

  return {
    type: authTokenInfo.tenant_type,
    tenant: authTokenInfo.tenant_id,
    user: {
      id: authTokenInfo.user_id,
      name: authTokenInfo.preferred_username || authTokenInfo.email,
      type: authTokenInfo.user_type,
      internal: authTokenInfo.user_type === 'serviceuser',
    },
  }
}
