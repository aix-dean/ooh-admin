"use client"

import * as React from "react"
import { FormFieldContext, FormItemContext } from "@/components/ui/form"
import { useFormContext } from "react-hook-form"

export function useSafeFormField() {
  // Get contexts
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)

  // Generate a fallback ID if itemContext is not available
  const fallbackId = React.useId()
  const id = itemContext?.id || fallbackId

  // Try to get form context
  let formContext
  try {
    formContext = useFormContext()
  } catch (error) {
    formContext = undefined
  }

  // If we're not in a form field context, return default values
  if (!fieldContext) {
    return {
      id,
      name: "",
      formItemId: `${id}-form-item`,
      formDescriptionId: `${id}-form-item-description`,
      formMessageId: `${id}-form-item-message`,
      error: undefined,
      invalid: false,
      isDirty: false,
      isTouched: false,
    }
  }

  // If we can't get form context, return default values with the field name
  if (!formContext) {
    return {
      id,
      name: fieldContext.name,
      formItemId: `${id}-form-item`,
      formDescriptionId: `${id}-form-item-description`,
      formMessageId: `${id}-form-item-message`,
      error: undefined,
      invalid: false,
      isDirty: false,
      isTouched: false,
    }
  }

  // If we have form context but no getFieldState, return default values with the field name
  if (!formContext.getFieldState) {
    return {
      id,
      name: fieldContext.name,
      formItemId: `${id}-form-item`,
      formDescriptionId: `${id}-form-item-description`,
      formMessageId: `${id}-form-item-message`,
      error: undefined,
      invalid: false,
      isDirty: false,
      isTouched: false,
    }
  }

  // Get field state
  const fieldState = formContext.getFieldState(fieldContext.name, formContext.formState)

  // Return complete field info
  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}
