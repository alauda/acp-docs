import { useMemo } from 'react'
import { useI18n } from 'rspress/runtime'

import { ApiError } from '../types.js'

import AlertIcon from './alert.svg?react'

import './styles.scss'

export interface ApiErrorAlertProps {
  error: ApiError
}

export const ApiErrorAlert = ({ error }: ApiErrorAlertProps) => {
  const t = useI18n()
  const message = useMemo(() => {
    if (!error.response) {
      return t('ERR_INTERNET_DISCONNECTED')
    }
    const reason = error.data?.reason
    const message = error.data?.message || error.message
    try {
      return reason ? t(reason) : message
    } catch {
      return message
    }
  }, [error])
  return (
    <div className="api-error-alert">
      <AlertIcon className="api-error-alert__icon" />
      {message}
    </div>
  )
}
