"use client"

import * as React from "react"
import { FormFieldContext, FormItemContext } from "@/components/ui/form"
import { useFormContext } from "react-hook-form"

export function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const formContext = useFormContext() // Call useFormContext unconditionally

  // Check if we're in a form context
  if (!fieldContext) {
    // Return a minimal object with default values when used outside FormField
    return {
      id: "",
      name: "",
      formItemId: "",
      formDescriptionId: "",
      formMessageId: "",
      invalid: false,
      isDirty: false,
      isTouched: false,
      error: undefined,
    }
  }

  // Only try to get field state if we have both contexts
  let fieldState = {
    invalid: false,
    isDirty: false,
    isTouched: false,
    error: undefined,
  }

  if (fieldContext.name) {
    try {
      fieldState = formContext.getFieldState(fieldContext.name, formContext.formState)
    } catch (error) {
      console.error("Error getting field state:", error)
    }
  }

  // Get ID from item context or generate a fallback
  const id = itemContext?.id || React.useId()

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}
