"use client"

interface SidebarBackdropProps {
  isOpen: boolean
  onClick: () => void
}

export function SidebarBackdrop({ isOpen, onClick }: SidebarBackdropProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-10 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      onClick={onClick}
      aria-hidden="true"
    />
  )
}
