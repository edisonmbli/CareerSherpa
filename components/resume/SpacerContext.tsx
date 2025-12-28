import { createContext, useContext } from 'react'

const SpacerContext = createContext<Record<string, number>>({})

export const useSpacer = (id: string) => {
  const spacers = useContext(SpacerContext)
  return spacers[id] || 0
}

export { SpacerContext }
