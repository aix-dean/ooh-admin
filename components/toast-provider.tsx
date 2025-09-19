"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Toast, ToastTitle, ToastDescription } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

export function ToastProvider() {
  const { toasts, dismissToast } = useToast()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  return createPortal(
    <div className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col-reverse md:max-w-[420px] overflow-hidden">
      {toasts
        .filter((toast) => toast.visible)
        .map((toast) => (
          <Toast key={toast.id} variant={toast.variant} onClose={() => dismissToast(toast.id)}>
            <div className="flex flex-col gap-1">
              <ToastTitle>{toast.title}</ToastTitle>
              {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
            </div>
          </Toast>
        ))}
    </div>,
    document.body,
  )
}
