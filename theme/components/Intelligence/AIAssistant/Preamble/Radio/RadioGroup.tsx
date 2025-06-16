import {
  ChangeEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useState,
} from 'react'
import { RadioGroupContext } from './context'

import './styles.scss'

export interface RadioGroupProps {
  id?: string
  name?: string
  value?: string
  onChange?: (value: ChangeEvent<HTMLInputElement>) => void
  children?: ReactNode
  prefix?: ReactNode
  suffix?: ReactNode
}

export const RadioGroup = ({
  id = useId(),
  name = id,
  value,
  onChange,
  children,
  prefix,
  suffix,
}: RadioGroupProps) => {
  const [innerValue, setInnerValue] = useState(value ?? '')

  if (value != null && innerValue !== value) {
    setInnerValue(value)
  }

  const handleChange = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
    onChange?.(ev)
    setInnerValue(ev.target.value)
  }, [])

  return (
    <div id={id} className="radio-group">
      <RadioGroupContext.Provider
        value={useMemo(
          () => ({
            name,
            value: innerValue,
            onChange: handleChange,
          }),
          [name, innerValue, handleChange],
        )}
      >
        {prefix && <span className="radio-group__prefix">{prefix}</span>}
        {children}
        {suffix && <span className="radio-group__suffix">{suffix}</span>}
      </RadioGroupContext.Provider>
    </div>
  )
}
