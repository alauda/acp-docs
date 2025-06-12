/// <reference types="react/experimental" />

import { useLang } from '@alauda/doom/runtime'
import { isProduction, useI18n } from '@rspress/core/runtime'
import { startTransition, useCallback, useRef, useState } from 'react'
import { Tooltip } from 'react-tooltip'

import { AIAssistant } from './AIAssistant'
import assistantIcon from './assistant.svg'
import { CloudAuthProvider } from './context'
import classes from './styles.module.scss'

const getViewTransitionHackStyle = () =>
  document.getElementById('rspress-view-transition-hack')

// hack copied from https://github.com/web-infra-dev/rspress/blob/80280c2908ab77f74c31329c7620e3be616ff0ab/packages/theme-default/src/components/SwitchAppearance/index.tsx#L17-L29
const removeClipViewTransition = () => {
  let styleDom = getViewTransitionHackStyle()
  if (!styleDom) {
    styleDom = document.createElement('style')
    styleDom.id = 'rspress-view-transition-hack'
    styleDom.innerHTML = `
      .rspress-doc {
        view-transition-name: none !important;
      }
  `
    document.head.appendChild(styleDom)
  }
  return () => {
    const styleDom = getViewTransitionHackStyle()
    if (styleDom) {
      document.head.removeChild(styleDom)
    }
  }
}

const ALLOWED_DOMAINS = new Set(['docs.alauda.cn'])

if (!isProduction()) {
  ALLOWED_DOMAINS.add('localhost')
}

const Intelligence_ = () => {
  const t = useI18n<typeof import('@docs/i18n.json')>()

  const [open, setOpen] = useState(false)

  const disposedRef = useRef<() => void>(undefined)

  const toggleOpen = useCallback(() => {
    disposedRef.current?.()
    disposedRef.current = removeClipViewTransition()
    startTransition(() => {
      setOpen(prev => !prev)
    })
  }, [])

  return (
    <CloudAuthProvider>
      <AIAssistant
        open={open}
        onOpenChange={toggleOpen}
        onCleanup={disposedRef.current}
      />
      {open || (
        <div className={classes.entry} onClick={toggleOpen}>
          <img src={assistantIcon} />
        </div>
      )}
      <Tooltip anchorSelect={`.${classes.entry}`} place="left">
        {t('ai_assistant')}
      </Tooltip>
    </CloudAuthProvider>
  )
}

const Intelligence = () => {
  const lang = useLang()

  if (
    lang !== 'en' ||
    typeof location === 'undefined' ||
    !ALLOWED_DOMAINS.has(location.hostname)
  ) {
    return
  }

  return <Intelligence_ />
}

export default Intelligence
