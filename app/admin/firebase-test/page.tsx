"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FirebaseVerification } from "@/components/firebase-verification"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { registerUser } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function FirebaseTestPage() {
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [testEmail, setTestEmail] = useState(`test-${Date.now()}@example.com`)
  const [testPassword, setTestPassword] = useState("Test123456")

  const runRegistrationTest = async () => {
    setIsLoading(true)
    setTestResult(null)

    try {
      // Generate a unique test user
      const timestamp = Date.now()
      const testUser = {
        firstName: "Test",
        lastName: `User ${timestamp}`,
        contactNumber: "1234567890",
        gender: "Other",
        email: testEmail,
        password: testPassword,
        displayName: `Test User ${timestamp}`,
      }

      // Attempt to register the test user
      const user = await registerUser(testUser)

      setTestResult({
        success: true,
        message: `Test user registered successfully with UID: ${user.uid}`,
      })
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Registration test failed: ${error.message}`,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Firebase Configuration Test</h1>

      <div className="grid gap-6">
        <FirebaseVerification />

        <Card>
          <CardHeader>
            <CardTitle>Registration Test</CardTitle>
            <CardDescription>Test the user registration process with the Firestore database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="testEmail">Test Email</Label>
                <Input
                  id="testEmail"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="testPassword">Test Password</Label>
                <Input
                  id="testPassword"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button onClick={runRegistrationTest} disabled={isLoading} className="w-full">
              {isLoading ? "Testing..." : "Run Registration Test"}
            </Button>

            {testResult && (
              <Alert
                variant={testResult.success ? "default" : "destructive"}
                className={testResult.success ? "bg-green-50 border-green-500" : ""}
              >
                <AlertDescription className={testResult.success ? "text-green-700" : ""}>
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
