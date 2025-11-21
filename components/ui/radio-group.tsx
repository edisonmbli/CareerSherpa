'use client'
import React from 'react'

type RadioGroupProps = {
  value: string
  onValueChange: (v: string) => void
  className?: string
  children: React.ReactNode
}

export function RadioGroup({ value, onValueChange, className, children }: RadioGroupProps) {
  return (
    <div role="radiogroup" className={className}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        const props = (child as any).props
        const checked = props.value === value
        const onChange = () => onValueChange(props.value)
        return React.cloneElement(child as any, { checked, onChange })
      })}
    </div>
  )
}

type RadioGroupItemProps = {
  id?: string
  value: string
  checked?: boolean
  onChange?: () => void
  className?: string
}

export function RadioGroupItem({ id, value, checked, onChange, className }: RadioGroupItemProps) {
  return (
    <input id={id} type="radio" value={value} checked={checked} onChange={onChange} className={className ?? 'h-4 w-4 rounded-full border'} />
  )
}