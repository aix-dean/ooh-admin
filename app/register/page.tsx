"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, AlertCircle, Loader2, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { registerUser, checkFirestoreConnection } from "@/lib/auth"
import { useNetworkStatus } from "@/lib/network-status"
import { PhoneInput } from "@/components/phone-input"
import { getMaxLengthForCountry } from "@/lib/country-codes"
import { PasswordRequirements } from "@/components/password-requirements"

// Validation functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validatePassword = (password: string): boolean => {
  // Basic validation - at least 6 characters
  // The detailed validation is handled by PasswordRequirements component
  return password.length >= 6
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true)
  const isNetworkOnline = useNetworkStatus()
  const router = useRouter()

  // Update the formData state to include countryCode
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    contactNumber: "",
    countryCode: "+63", // Default to Philippines
    gender: "Female", // Default gender
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "", // Optional business/organization name
  })

  // Add state to track if the password field is focused
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)

  // Update the validatePhone function to consider country code
  const validatePhone = (phone: string, countryCode: string): boolean => {
    // Get the maximum length for the selected country
    const maxLength = getMaxLengthForCountry(countryCode)

    // Check if the phone number has the correct number of digits
    return phone.length === maxLength
  }

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

  // Clear errors when form data changes
  useEffect(() => {
    const fieldsToValidate =
      step === 1 ? ["firstName", "lastName", "contactNumber"] : ["email", "password", "confirmPassword"]

    const newErrors = { ...errors }
    fieldsToValidate.forEach((field) => {
      if (newErrors[field]) {
        delete newErrors[field]
      }
    })

    setErrors(newErrors)
  }, [formData, step])

  // Clear general error when network status changes
  useEffect(() => {
    if (isNetworkOnline && generalError.includes("offline")) {
      setGeneralError("")
    }
  }, [isNetworkOnline, generalError])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleGenderChange = (value: string) => {
    setFormData((prev) => ({ ...prev, gender: value }))
  }

  // Update the validateStep1 function to include country code in validation
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required"
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = "Contact number is required"
    } else if (!validatePhone(formData.contactNumber, formData.countryCode)) {
      const maxLength = getMaxLengthForCountry(formData.countryCode)
      newErrors.contactNumber = `Please enter a valid ${maxLength}-digit phone number`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (!validatePassword(formData.password)) {
      newErrors.password = "Password must be at least 6 characters long"
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password"
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError("")

    // Check network status
    if (!isNetworkOnline) {
      setGeneralError("You appear to be offline. Please check your internet connection and try again.")
      return
    }

    // Check Firestore connection
    if (!isFirestoreConnected) {
      setGeneralError("Unable to connect to the database. Please try again later.")
      return
    }

    if (validateStep1()) {
      setStep(2)
    }
  }

  // Add a new handler for phone input changes
  const handlePhoneChange = (value: string, countryCode: string) => {
    setFormData((prev) => ({
      ...prev,
      contactNumber: value,
      countryCode: countryCode,
    }))
  }

  // Add handlers for password field focus events
  const handlePasswordFocus = () => {
    setIsPasswordFocused(true)
  }

  const handlePasswordBlur = () => {
    // Only hide the requirements if the password field is empty
    if (!formData.password) {
      setIsPasswordFocused(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError("")

    // Check network status
    if (!isNetworkOnline) {
      setGeneralError("You appear to be offline. Please check your internet connection and try again.")
      return
    }

    // Check Firestore connection
    if (!isFirestoreConnected) {
      setGeneralError("Unable to connect to the database. Please try again later.")
      return
    }

    if (!validateStep2()) {
      return
    }

    setIsLoading(true)

    try {
      console.log("Starting registration submission")

      // Prepare display name if provided
      const displayName = formData.displayName.trim()
        ? formData.displayName
        : `${formData.firstName} ${formData.lastName}`

      // Update the registerUser call to include the country code
      await registerUser({
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        contactNumber: formData.contactNumber,
        countryCode: formData.countryCode,
        gender: formData.gender,
        email: formData.email,
        password: formData.password,
        displayName: displayName,
      })

      console.log("Registration successful")
      setIsSuccess(true)

      // Redirect after a short delay to show success message
      setTimeout(() => {
        router.push("/dashboard?registered=true")
      }, 2000)
    } catch (error: any) {
      console.error("Registration error:", error)
      setGeneralError(error.message || "Failed to register. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Retry connection check
  const handleRetryConnection = async () => {
    setIsCheckingConnection(true)
    setGeneralError("")

    try {
      const isConnected = await checkFirestoreConnection()
      setIsFirestoreConnected(isConnected)

      if (!isConnected) {
        setGeneralError("Still unable to connect to the database. Please try again later.")
      }
    } catch (error) {
      console.error("Error checking Firestore connection:", error)
      setIsFirestoreConnected(false)
      setGeneralError("Failed to check database connection. Please try again later.")
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
            alt="OH! Shop Admin Registration"
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
        <div className="mx-auto flex w-full max-w-md flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-3xl font-bold">Create your Account</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 ? "Enter your personal information" : "Set up your account credentials"}
            </p>
          </div>

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

          {/* General Error Alert */}
          {generalError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {isSuccess && (
            <Alert className="border-green-500 bg-green-50">
              <AlertDescription className="text-green-700">
                Registration successful! Redirecting to login page...
              </AlertDescription>
            </Alert>
          )}

          {step === 1 ? (
            <form onSubmit={handleContinue} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="First Name *"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={errors.firstName ? "border-red-500" : ""}
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  />
                  {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
                </div>

                <div>
                  <Input
                    id="middleName"
                    name="middleName"
                    placeholder="Middle Name (Optional)"
                    value={formData.middleName}
                    onChange={handleChange}
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  />
                </div>

                <div>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Last Name *"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={errors.lastName ? "border-red-500" : ""}
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  />
                  {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
                </div>

                <div>
                  <Input
                    id="displayName"
                    name="displayName"
                    placeholder="Display Name (Business/Organization Name)"
                    value={formData.displayName}
                    onChange={handleChange}
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Leave blank to use your full name</p>
                </div>

                <div>
                  <PhoneInput
                    value={formData.contactNumber}
                    countryCode={formData.countryCode}
                    onChange={handlePhoneChange}
                    error={errors.contactNumber}
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gender:</Label>
                  <RadioGroup
                    value={formData.gender}
                    onValueChange={handleGenderChange}
                    className="flex space-x-8"
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Female" id="female" />
                      <Label htmlFor="female">Female</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Male" id="male" />
                      <Label htmlFor="male">Male</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-[#1A237E] hover:bg-[#1A237E]/90"
                disabled={!isNetworkOnline || !isFirestoreConnected || isLoading || isCheckingConnection}
              >
                {isCheckingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking connection...
                  </>
                ) : (
                  <>
                    Continue <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-[#1A237E] hover:underline">
                  Login
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email Address *"
                    value={formData.email}
                    onChange={handleChange}
                    className={errors.email ? "border-red-500" : ""}
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                </div>

                <div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Password *"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    className={errors.password ? "border-red-500" : ""}
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                    aria-describedby="password-requirements"
                  />
                  {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}

                  {/* Password strength checker - show when password field is focused or has content */}
                  {(isPasswordFocused || formData.password) && (
                    <div id="password-requirements" className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-2">Password Strength</p>
                      <PasswordRequirements password={formData.password} />
                    </div>
                  )}
                </div>

                <div>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm Password *"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={errors.confirmPassword ? "border-red-500" : ""}
                    disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
                </div>
              </div>
              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2"
                  onClick={() => setStep(1)}
                  disabled={!isNetworkOnline || !isFirestoreConnected || isLoading}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  type="submit"
                  className="w-1/2 bg-[#1A237E] hover:bg-[#1A237E]/90"
                  disabled={!isNetworkOnline || !isFirestoreConnected || isLoading || isCheckingConnection}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-[#1A237E] hover:underline">
                  Login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
