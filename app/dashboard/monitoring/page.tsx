"use client"

import { WebView } from "@/components/webview/webview"

export default function MonitoringPage() {
  return (
    <div className="h-full w-full">
      <WebView
        url="https://oohshop.online/analytics"
        title="OOHShop Analytics Dashboard"
        className="h-[calc(100vh-4rem)] w-full min-h-[800px] overflow-auto"
      />
    </div>
  )
}
