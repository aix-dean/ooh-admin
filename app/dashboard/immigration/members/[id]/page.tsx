import { Suspense } from "react"
import { MemberInformationView } from "@/components/members/member-information-view"

interface PageProps {
  params: {
    id: string
  }
  searchParams: {
    platform?: string
  }
}

export default function MemberInformationPage({ params, searchParams }: PageProps) {
  const platform = searchParams.platform || "ooh-shop"

  return (
    <div className="h-full">
      <Suspense fallback={<div>Loading member information...</div>}>
        <MemberInformationView memberId={params.id} platform={platform} />
      </Suspense>
    </div>
  )
}
