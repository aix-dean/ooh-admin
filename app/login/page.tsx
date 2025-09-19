"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, Eye, EyeOff, AlertCircle, Loader2, WifiOff, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { checkFirestoreConnection } from "@/lib/auth"
import { useNetworkStatus } from "@/lib/network-status"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  // Add a new state for password reset success
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNetworkOnline = useNetworkStatus()

  // Check if user just registered successfully
  useEffect(() => {
    const registered = searchParams.get("registered")
    if (registered === "true") {
      setRegistrationSuccess(true)

      // Clear the success message after 5 seconds
      const timer = setTimeout(() => {
        setRegistrationSuccess(false)
      }, 5000)

      return () => clearTimeout(timer)
    }

    // Check for password reset success
    const reset = searchParams.get("reset")
    if (reset === "true") {
      setPasswordResetSuccess(true)

      // Clear the success message after 5 seconds
      const timer = setTimeout(() => {
        setPasswordResetSuccess(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [searchParams])

  // Check Firestore connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      setIsCheckingConnection(true)
      try {
        // First check if browser reports we're offline
        if (!isNetworkOnline) {
          console.log("Browser reports device is offline")
          setIsFirestoreConnected(false)
          setIsCheckingConnection(false)
          return
        }

        // Then try to check Firestore connection
        const isConnected = await checkFirestoreConnection()
        setIsFirestoreConnected(isConnected)
      } catch (error) {
        console.error("Error checking Firestore connection:", error)
        setIsFirestoreConnected(false)
      } finally {
        setIsCheckingConnection(false)
      }
    }

    // Don't block rendering with the connection check
    // Just start it and let it update state when done
    checkConnection()

    // We don't need to re-run this effect when isNetworkOnline changes
    // as we check that inside the effect
  }, [])

  // Add a separate effect to update connection status when network status changes
  useEffect(() => {
    if (!isNetworkOnline) {
      setIsFirestoreConnected(false)
    }
  }, [isNetworkOnline])

  // Clear error when network status changes
  useEffect(() => {
    if (isNetworkOnline && error.includes("offline")) {
      setError("")
    }
  }, [isNetworkOnline, error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Check network status
    if (!isNetworkOnline) {
      setError("You appear to be offline. Please check your internet connection and try again.")
      return
    }

    // Check Firestore connection
    if (!isFirestoreConnected) {
      setError("Unable to connect to the database. Please try again later.")
      return
    }

    // Validate inputs
    if (!email.trim()) {
      setError("Email is required")
      return
    }

    if (!password) {
      setError("Password is required")
      return
    }

    setIsLoading(true)

    try {
      console.log("Attempting to sign in user")
      await signIn(email, password)
      console.log("Sign in successful, redirecting to dashboard")
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Login error:", error)

      // Provide user-friendly error messages
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        setError("Invalid email or password. Please try again.")
      } else if (error.code === "auth/too-many-requests") {
        setError("Too many failed login attempts. Please try again later or reset your password.")
      } else if (error.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection and try again.")
      } else if (error.code === "auth/user-disabled") {
        setError("This account has been disabled. Please contact support.")
      } else {
        setError(error.message || "Failed to sign in. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Retry connection check
  const handleRetryConnection = async () => {
    setIsCheckingConnection(true)
    setError("")

    try {
      const isConnected = await checkFirestoreConnection()
      setIsFirestoreConnected(isConnected)

      if (!isConnected) {
        setError("Still unable to connect to the database. Please try again later.")
      }
    } catch (error) {
      console.error("Error checking Firestore connection:", error)
      setIsFirestoreConnected(false)
      setError("Failed to check database connection. Please try again later.")
    } finally {
      setIsCheckingConnection(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-[#1A237E] lg:block">
        <div className="relative h-full w-full">
          <Image
            src="/images/login-background.png"
            alt="OH! Shop Admin Login"
            fill
            style={{ objectFit: "cover" }}
            priority
          />
        </div>
      </div>
      <div className="flex w-full flex-col p-8 lg:w-1/2">
        <Link
          href="/"
          className="mb-8 flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-col justify-center space-y-6 pt-16 md:pt-24 lg:pt-32">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-3xl font-bold">Login to your Account</h1>
          </div>

          {/* Registration Success Alert */}
          {registrationSuccess && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Registration successful! You can now log in with your credentials.
              </AlertDescription>
            </Alert>
          )}

          {/* Password Reset Success Alert */}
          {passwordResetSuccess && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Password has been reset successfully. You can now log in with your new password.
              </AlertDescription>
            </Alert>
          )}

          {/* Network Status Alert */}
          {!isNetworkOnline && (
            <Alert variant="destructive" className="bg-amber-50 border-amber-500">
              <WifiOff className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-600">
                You are currently offline. Please check your internet connection to continue.
              </AlertDescription>
            </Alert>
          )}

          {/* Firestore Connection Alert */}
          {isNetworkOnline && !isFirestoreConnected && !isCheckingConnection && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex justify-between items-center">
                <span>Unable to connect to the database. Please try again later.</span>
                <Button variant="outline" size="sm" onClick={handleRetryConnection} disabled={isCheckingConnection}>
                  {isCheckingConnection ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Retry"
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Input
                id="email"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                className="h-11"
              />
            </div>
            <div className="relative space-y-2">
              <div className="relative">
                <Input
                  id="password"
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  className="h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
            </div>
            <Button
              type="submit"
              className="h-11 w-full bg-[#1A237E] hover:bg-[#1A237E]/90"
              disabled={!isNetworkOnline || !isFirestoreConnected || isLoading || isCheckingConnection}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : isCheckingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking connection...
                </>
              ) : (
                "Login"
              )}
            </Button>
            <div className="mt-2 text-center">
              <Link href="/forgot-password" className="text-sm text-[#1A237E] hover:underline">
                Forgot password?
              </Link>
            </div>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-[#1A237E] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
