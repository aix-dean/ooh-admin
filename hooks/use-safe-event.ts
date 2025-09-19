"use client"

import type React from "react"

import { useRef, useEffect, useCallback } from "react"

/**
 * A hook that ensures event handlers are properly cleaned up and updated
 * when components re-render or unmount.
 *
 * @param handler The event handler function
 * @param deps Dependencies array for the handler
 * @returns A stable event handler reference that's safe to use
 */
export function useSafeEvent<T extends (...args: any[]) => any>(handler: T, deps: React.DependencyList = []): T {
  const handlerRef = useRef<T>(handler)

  // Update the handler ref whenever the handler changes
  useEffect(() => {
    handlerRef.current = handler
  }, [handler, ...deps])

  // Return a stable callback that uses the latest handler
  return useCallback(
    ((...args: Parameters<T>) => {
      const fn = handlerRef.current
      return fn(...args)
    }) as T,
    [handlerRef],
  )
}
