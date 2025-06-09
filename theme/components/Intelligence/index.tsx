/// <reference types="react/experimental" />

import { useLang } from '@alauda/doom/runtime'
import { useI18n } from '@rspress/core/runtime'
import { startTransition, useCallback, useRef, useState } from 'react'
import { Tooltip } from 'react-tooltip'

import { AIAssistant } from './AIAssistant/index.js'
import AssistantIcon from './assistant.svg?react'
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

export const Intelligence = () => {
  const lang = useLang()

  const t = useI18n<typeof import('@docs/i18n.json')>()

  const [open, setOpen] = useState(false)

  const disposedRef = useRef<() => void>(undefined)

  const toggleOpen = useCallback(() => {
    disposedRef.current?.()
    disposedRef.current = removeClipViewTransition()
    startTransition(() => {
      setOpen((prev) => !prev)
    })
  }, [])

  if (lang !== 'en') {
    return
  }

  return (
    <>
      {open ? (
        <AIAssistant
          onOpenChange={toggleOpen}
          onCleanup={disposedRef.current}
        />
      ) : (
        <div className={classes.entry} onClick={toggleOpen}>
          <AssistantIcon />
        </div>
      )}
      <Tooltip anchorSelect={`.${classes.entry}`} place="left">
        {t('ai_assistant')}
      </Tooltip>
    </>
  )
}

export default Intelligence
