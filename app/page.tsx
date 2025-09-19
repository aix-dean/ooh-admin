import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* 🔷 Solid top bar */}
      <div className="w-full h-10 bg-[#23295A]" />
      <header className="bg-[#FFFFFF] py-4">
        <div className="container mx-auto flex items-left justify-between px-4">
          <nav className="flex items-left space-x-8">
            <div className="hidden space-x-6 md:flex">
              <Link href="/" className="text-[#999999] hover:text-[#23295A] font-bold">
                Home
              </Link>
              <Link href="/" className="text-[#999999] hover:text-[#23295A] font-bold">
                Partners
              </Link>
              <Link href="/" className="text-[#999999] hover:text-[#23295A] font-bold">
                About OH!Shop Admin
              </Link>
            </div>
          </nav>
          <div className="flex space-x-2">
            <Button asChild variant="outline" className="bg-[#23295A] text-[#FFFFFF] hover:bg-[#23295A]/90">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild className="bg-[#CCCCCC] text-[#23295A] hover:bg-[#CCCCCC]/90">
              <Link href="/register">Register</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative bg-[#FFFFFF]">
          {/* 🟢 Full-width image container */}
          <div className="relative w-full">
            <Image
              src="/images/landing-banner.png"
              alt="OH! Shop Admin"
              width={1920}
              height={562}
              style={{
                width: "100%",
                height: "562px  ",
                objectFit: "contain",
              }}
              priority
            />
          </div>

          {/* 🔵 Keep rest of the content in the container */}
          <div className="container mx-auto px-4 py-20">{/* Other content here */}</div>

          <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-white"></span>
            <span className="h-2 w-2 rounded-full bg-white/50"></span>
            <span className="h-2 w-2 rounded-full bg-white/50"></span>
            <span className="h-2 w-2 rounded-full bg-white/50"></span>
            <span className="h-2 w-2 rounded-full bg-white/50"></span>
            <span className="h-2 w-2 rounded-full bg-white/50"></span>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col justify-between md:flex-row">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-muted-foreground">Copyright © 2025 OH! Shop - Admin. All Rights Reserved.</p>
            </div>
            <div className="flex space-x-8">
              <div className="text-sm">
                <h4 className="font-medium">Quick links</h4>
              </div>
              <div className="text-sm">
                <h4 className="font-medium">Subsidiaries</h4>
              </div>
              <div className="text-sm">
                <h4 className="font-medium">Legal Pages</h4>
              </div>
              <div className="text-sm">
                <h4 className="font-medium">Email & Contact Details</h4>
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-end space-x-4">
            <Link href="#" aria-label="Facebook">
              <Facebook className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link href="#" aria-label="YouTube">
              <Youtube className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link href="#" aria-label="Instagram">
              <Instagram className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Link href="#" aria-label="Twitter">
              <Twitter className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
