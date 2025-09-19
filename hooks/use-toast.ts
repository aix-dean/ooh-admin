"use client"

import { useState } from "react"

type ToastType = "default" | "success" | "error" | "warning" | "info"

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastType
  duration?: number
}

interface Toast extends ToastOptions {
  id: string
  visible: boolean
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = (options: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant || "default",
      duration: options.duration || 5000,
      visible: true,
    }

    setToasts((prev) => [...prev, newToast])

    // Auto dismiss
    setTimeout(() => {
      dismissToast(id)
    }, newToast.duration)

    return id
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, visible: false } : toast)))

    // Remove from state after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 300)
  }

  return { toast, toasts, dismissToast }
}
