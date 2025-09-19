"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, AlertCircle, Loader2, CheckCircle2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { sendPasswordReset } from "@/lib/password-reset"
import { useNetworkStatus } from "@/lib/network-status"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()
  const isNetworkOnline = useNetworkStatus()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    // Check network status
    if (!isNetworkOnline) {
      setError("You appear to be offline. Please check your internet connection and try again.")
      return
    }

    // Validate email
    if (!email.trim()) {
      setError("Email is required")
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    setIsLoading(true)

    try {
      const result = await sendPasswordReset(email)

      if (result.success) {
        setSuccess(result.message)
        // Clear the email field on success
        setEmail("")
      } else {
        setError(result.message)
      }
    } catch (error: any) {
      console.error("Password reset error:", error)
      setError("An unexpected error occurred. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-[#1A237E] lg:block">
        <div className="relative h-full w-full">
          <Image src="/images/login-background.png" alt="OH! Shop Admin" fill style={{ objectFit: "cover" }} priority />
        </div>
      </div>
      <div className="flex w-full flex-col p-8 lg:w-1/2">
        <Link
          href="/login"
          className="mb-8 flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Login
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-3xl font-bold">Reset Your Password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                {success}
                <div className="mt-2 text-sm">
                  <strong>Next steps:</strong>
                  <ol className="list-decimal pl-5 pt-1">
                    <li>Check your email for the password reset link</li>
                    <li>Click the link in the email</li>
                    <li>Follow the instructions to create a new password</li>
                    <li>Return to the login page to sign in with your new password</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  id="email"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || !isNetworkOnline}
                  aria-label="Email address"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#1A237E] hover:bg-[#1A237E]/90"
                disabled={isLoading || !isNetworkOnline}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </form>
          )}

          {success && (
            <div className="mt-4 text-center">
              <Button variant="outline" className="mt-2" onClick={() => router.push("/login")}>
                Return to Login
              </Button>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="font-medium text-[#1A237E] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
