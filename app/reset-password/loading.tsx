import { Loader2 } from "lucide-react"

export default function ResetPasswordLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#1A237E]" />
        <p className="text-lg font-medium">Loading...</p>
      </div>
    </div>
  )
}
