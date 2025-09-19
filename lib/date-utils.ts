import { isValid, parse } from "date-fns"

/**
 * Checks if a value is a valid date
 */
export function isValidDate(date: any): boolean {
  if (!date) return false

  // If it's already a Date object, check if it's valid
  if (date instanceof Date) {
    return isValid(date) && !isNaN(date.getTime())
  }

  // Try to convert to Date object
  try {
    const dateObj = new Date(date)
    return isValid(dateObj) && !isNaN(dateObj.getTime())
  } catch (error) {
    return false
  }
}

/**
 * Parses a string or timestamp into a Date object
 */
export function parseDate(dateValue: any): Date | undefined {
  if (!dateValue) return undefined

  // If it's already a Date object, return it if valid
  if (dateValue instanceof Date) {
    return isValidDate(dateValue) ? dateValue : undefined
  }

  // Handle Firestore timestamp objects
  if (typeof dateValue === "object" && dateValue.toDate && typeof dateValue.toDate === "function") {
    try {
      const date = dateValue.toDate()
      return isValidDate(date) ? date : undefined
    } catch (error) {
      console.error("Error converting Firestore timestamp:", error)
      return undefined
    }
  }

  // Handle string dates
  if (typeof dateValue === "string") {
    try {
      // Try to parse as ISO string
      const date = new Date(dateValue)
      if (isValidDate(date)) return date

      // Try common date formats
      const formats = [
        "yyyy-MM-dd",
        "yyyy-MM-dd HH:mm",
        "yyyy-MM-dd HH:mm:ss",
        "MM/dd/yyyy",
        "MM/dd/yyyy HH:mm",
        "dd/MM/yyyy",
        "dd/MM/yyyy HH:mm",
      ]

      for (const formatString of formats) {
        try {
          const parsedDate = parse(dateValue, formatString, new Date())
          if (isValidDate(parsedDate)) return parsedDate
        } catch (e) {
          // Continue to next format
        }
      }
    } catch (error) {
      console.error("Error parsing date string:", error)
    }
  }

  // Handle numeric timestamps
  if (typeof dateValue === "number") {
    try {
      const date = new Date(dateValue)
      return isValidDate(date) ? date : undefined
    } catch (error) {
      console.error("Error parsing numeric timestamp:", error)
    }
  }

  return undefined
}

/**
 * Formats a date for display
 */
export function formatDate(date: Date | string | undefined, includeTime = false): string {
  if (!date) return "N/A"

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date

    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return "Invalid Date"
    }

    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    }

    if (includeTime) {
      options.hour = "2-digit"
      options.minute = "2-digit"
      options.hour12 = true
    }

    return dateObj.toLocaleDateString("en-US", options)
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Error"
  }
}
