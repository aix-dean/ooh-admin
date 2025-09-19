import { Badge } from "@/components/ui/badge"

interface NotFeaturedBadgeProps {
  className?: string
}

export function NotFeaturedBadge({ className = "" }: NotFeaturedBadgeProps) {
  return (
    <Badge variant="outline" className={`bg-gray-100 text-gray-600 border-gray-200 ${className}`}>
      Not Featured
    </Badge>
  )
}
