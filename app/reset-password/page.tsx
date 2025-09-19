"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useNetworkStatus } from "@/lib/network-status"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [oobCode, setOobCode] = useState("")
  const [isCodeValid, setIsCodeValid] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const isNetworkOnline = useNetworkStatus()

  // Extract and verify the reset code from URL
  useEffect(() => {
    const code = searchParams.get("oobCode")

    if (!code) {
      setError("Invalid or expired password reset link. Please request a new one.")
      setIsVerifying(false)
      return
    }

    setOobCode(code)

    const verifyCode = async () => {
      try {
        // Verify the password reset code and get the associated email
        const email = await verifyPasswordResetCode(auth, code)
        setEmail(email)
        setIsCodeValid(true)
      } catch (error: any) {
        console.error("Error verifying reset code:", error)
        setError("Invalid or expired password reset link. Please request a new one.")
        setIsCodeValid(false)
      } finally {
        setIsVerifying(false)
      }
    }

    verifyCode()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Check network status
    if (!isNetworkOnline) {
      setError("You appear to be offline. Please check your internet connection and try again.")
      return
    }

    // Validate password
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Validate password strength
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[^A-Za-z0-9]/.test(password)

    if (!(hasUppercase && hasLowercase && hasNumber && hasSpecial)) {
      setError("Password does not meet all requirements")
      return
    }

    setIsLoading(true)

    try {
      // Confirm password reset with Firebase
      await confirmPasswordReset(auth, oobCode, password)

      // Redirect to login with success message
      router.push("/login?reset=true")
    } catch (error: any) {
      console.error("Password reset error:", error)

      if (error.code === "auth/expired-action-code") {
        setError("This password reset link has expired. Please request a new one.")
      } else if (error.code === "auth/invalid-action-code") {
        setError("Invalid reset link. Please request a new password reset link.")
      } else if (error.code === "auth/weak-password") {
        setError("Please choose a stronger password.")
      } else if (error.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection and try again.")
      } else {
        setError("Failed to reset password. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Password Reset</CardTitle>
          <CardDescription>Firebase handles the password reset process directly through email links</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <h3 className="font-medium">Important Information</h3>
              <p className="text-sm">
                If you clicked a password reset link from your email, please follow the instructions in that email.
                Firebase will handle the password reset process directly.
              </p>
              <p className="mt-2 text-sm">
                If you need to request a new password reset link, please return to the forgot password page.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/forgot-password">
            <Button variant="outline" className="mr-2">
              Forgot Password
            </Button>
          </Link>
          <Link href="/login">
            <Button>Return to Login</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
