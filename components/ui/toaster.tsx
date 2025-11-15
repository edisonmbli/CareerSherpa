"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      richColors
      closeButton
      position="bottom-right"
      expand={false}
      duration={2500}
      toastOptions={{
        classNames: {
          description: "text-sm",
        },
      }}
    />
  )
}