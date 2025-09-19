"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { updateUserProfile } from "@/lib/profile"
import { useAuth } from "@/contexts/auth-context"
import { PhoneInput } from "@/components/phone-input"
import { ScrollArea } from "@/components/ui/scroll-area"

// Define the form schema with validation
const profileFormSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters" }),
  middleName: z.string().optional(),
  lastName: z.string().min(2, { message: "Last name must be at least 2 characters" }),
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters" }),
  phoneNumber: z
    .string()
    .min(10, { message: "Phone number must be at least 10 characters" })
    .regex(/^\+?[0-9\s\-()]+$/, { message: "Please enter a valid phone number" }),
  gender: z.enum(["Male", "Female", "Other", "Not specified"], {
    required_error: "Please select a gender",
  }),
  countryCode: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

interface ProfileFormProps {
  userData: any
}

export function ProfileForm({ userData }: ProfileFormProps) {
  const { refreshUserData } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formStatus, setFormStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Initialize form with user data
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: userData.first_name || "",
      middleName: userData.middle_name === "-" ? "" : userData.middle_name || "",
      lastName: userData.last_name || "",
      displayName: userData.display_name || "",
      phoneNumber: userData.phone_number === "-" ? "" : userData.phone_number || "",
      gender: (userData.gender as any) || "Not specified",
      countryCode: userData.country_code || "+63",
    },
  })

  // Handle form submission
  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true)
    setFormStatus(null)

    try {
      // Prepare data for update
      const profileData = {
        first_name: data.firstName,
        middle_name: data.middleName || "-",
        last_name: data.lastName,
        display_name: data.displayName,
        phone_number: data.phoneNumber || "-",
        country_code: data.countryCode || "+63",
        gender: data.gender,
      }

      // Update profile in Firestore
      await updateUserProfile(profileData)

      // Refresh user data in context
      await refreshUserData()

      // Show success message
      setFormStatus({
        type: "success",
        message: "Profile updated successfully",
      })
    } catch (error: any) {
      // Show error message
      setFormStatus({
        type: "error",
        message: error.message || "An error occurred while updating your profile",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ScrollArea className="h-full pr-4">
      <div className="p-4 bg-white rounded-md">
        <h3 className="text-lg font-medium mb-4">Personal Information</h3>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Status message */}
            {formStatus && (
              <Alert
                variant={formStatus.type === "error" ? "destructive" : "default"}
                className={formStatus.type === "success" ? "border-green-500 bg-green-50" : ""}
              >
                {formStatus.type === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                <AlertDescription className={formStatus.type === "success" ? "text-green-700" : ""}>
                  {formStatus.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="First Name" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="middleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Middle Name" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Last Name" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Display Name" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <PhoneInput
                      value={field.value}
                      countryCode={userData.country_code || "+63"}
                      onChange={(value, countryCode) => {
                        field.onChange(value)
                        // Store the country code in a hidden field or in form data
                        form.setValue("countryCode", countryCode)
                      }}
                      disabled={isSubmitting}
                      error={form.formState.errors.phoneNumber?.message?.toString()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Gender</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-2"
                      disabled={isSubmitting}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Male" id="male" />
                        <FormLabel htmlFor="male" className="font-normal">
                          Male
                        </FormLabel>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Female" id="female" />
                        <FormLabel htmlFor="female" className="font-normal">
                          Female
                        </FormLabel>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Other" id="other" />
                        <FormLabel htmlFor="other" className="font-normal">
                          Other
                        </FormLabel>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Not specified" id="not-specified" />
                        <FormLabel htmlFor="not-specified" className="font-normal">
                          Not specified
                        </FormLabel>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </ScrollArea>
  )
}
