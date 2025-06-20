import { useI18n } from '@rspress/core/runtime'
import clsx from 'clsx'
import {
  type ChangeEvent,
  type KeyboardEvent,
  type SyntheticEvent,
  useMemo,
  useState,
} from 'react'
import stringWidth from 'string-width'

import { useMemoizedFn } from '@theme/hooks'

import SendIcon from './send.svg?react'
import classes from './styles.module.scss'

export interface ResizableUserInputProps {
  placeholder?: string
  value?: string
  onChange?(value: string): void
  onSend?(value?: string): void
}

export const ResizableUserInput = ({
  value,
  onChange,
  onSend,
}: ResizableUserInputProps) => {
  const t = useI18n<typeof import('@docs/i18n.json')>()

  const [innerValue, setInnerValue] = useState(value ?? '')

  if (value != null && innerValue !== value) {
    setInnerValue(value)
  }

  const maxCharsExceeded = innerValue.length > 2000

  const isSendDisabled = useMemo(
    () => maxCharsExceeded || !innerValue.trim(),
    [maxCharsExceeded, innerValue],
  )

  const handleSend = useMemoizedFn(() => {
    if (isSendDisabled) {
      return
    }
    const content = innerValue.trim()
    if (!content) {
      return
    }
    onSend?.(content)
    setInnerValue('')
  })

  const handleChange = useMemoizedFn(
    (ev: ChangeEvent<HTMLTextAreaElement>) => {
      const value = ev.target.value
      onChange?.(value)
      setInnerValue(value)
    },
  )

  const onKeyDown = useMemoizedFn(
    (
      ev: KeyboardEvent<HTMLTextAreaElement> &
        SyntheticEvent<HTMLTextAreaElement, InputEvent>,
    ) => {
      ev.stopPropagation()
      const event = ev.nativeEvent
      if (
        ev.key === 'Enter' &&
        !event.isComposing &&
        !ev.altKey &&
        !ev.ctrlKey &&
        !ev.metaKey &&
        !ev.shiftKey
      ) {
        ev.preventDefault()
        handleSend()
      }
    },
  )

  const textLines = useMemo(
    () =>
      innerValue
        ?.split(/\r?\n/g)
        .map(line =>
          Math.ceil(stringWidth(line) / /* 27 Chinese characters */ 54),
        )
        .reduce((acc, curr) => acc + curr, 0) ?? 0,
    [innerValue],
  )

  const inputHeight = useMemo(
    () => Math.min(Math.max(textLines, 3), 8) * 20,
    [textLines],
  )

  const inputStyle = useMemo(
    () => ({
      minHeight: inputHeight,
    }),
    [inputHeight],
  )

  return (
    <div className={clsx(classes.input, maxCharsExceeded && classes.error)}>
      <textarea
        placeholder={t('ai_assistant_placeholder')}
        value={innerValue}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        style={inputStyle}
      />

      <div className={classes.actions}>
        <SendIcon
          className={clsx(classes.send, isSendDisabled && classes.disabled)}
          onClick={handleSend}
        />
        {maxCharsExceeded && (
          <span className={classes.errorTip}>
            {t('max_chars_exceeded_tip')}
          </span>
        )}
      </div>
    </div>
  )
}
