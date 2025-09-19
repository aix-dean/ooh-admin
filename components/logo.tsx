import Image from "next/image"
import Link from "next/link"

interface LogoProps {
  className?: string
  showText?: boolean
  textColor?: string
}

export function Logo({ className = "", showText = true, textColor = "text-white" }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center ${className}`}>
      <div className="relative h-8 w-8">
        <Image src="/images/navigation-logo.png" alt="OH! Shop Logo" fill style={{ objectFit: "contain" }} priority />
      </div>
      {showText && (
        <div className="ml-2 flex flex-col">
          <span className={`text-base font-bold ${textColor}`}>OH! Shop</span>
          <span className={`text-xs ${textColor}/80`}>Admin</span>
        </div>
      )}
    </Link>
  )
}
