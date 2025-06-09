import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import { AuthInfo } from './types'
import { getAuthInfoFromToken, setLocalStorage } from './utils'

export interface CloudAuth {
  origin: string
  detail?: AuthInfo
}

export interface CloudAuthContext {
  authInfo: CloudAuth | null
  setAuthBasic: (authBasic: { origin: string; token: string } | null) => void
}

export const CloudAuthContext = createContext<CloudAuthContext>(null!)

export const useCloudAuth = () => useContext(CloudAuthContext)

const CLOUD_AUTH_ORIGIN_KEY = '__CLOUD_AUTH_ORIGIN__'
const CLOUD_AUTH_TOKEN_KEY = '__CLOUD_AUTH_TOKEN__'

const getCloudAuth = (): CloudAuth | null => {
  const origin = localStorage.getItem(CLOUD_AUTH_ORIGIN_KEY)
  const token = localStorage.getItem(CLOUD_AUTH_TOKEN_KEY)

  if (!origin) {
    return null
  }

  if (!token) {
    return { origin }
  }

  return { origin, detail: getAuthInfoFromToken(token) }
}

export const CloudAuthProvider = ({ children }: { children: ReactNode }) => {
  const [authInfo, setAuthInfo] = useState(getCloudAuth)
  return (
    <CloudAuthContext.Provider
      value={useMemo(
        () => ({
          authInfo,
          setAuthBasic(authBasic) {
            setLocalStorage(CLOUD_AUTH_ORIGIN_KEY, authBasic?.origin)
            setLocalStorage(CLOUD_AUTH_TOKEN_KEY, authBasic?.token)
            setAuthInfo(getCloudAuth)
          },
        }),
        [authInfo],
      )}
    >
      {children}
    </CloudAuthContext.Provider>
  )
}
