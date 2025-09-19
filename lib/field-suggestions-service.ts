import { collection, query, limit, getDocs } from "firebase/firestore"
import { db } from "./firebase"

export class FieldSuggestionsService {
  private static cache = new Map<string, string[]>()
  private static readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Get intelligent suggestions for a field based on existing data
   */
  static async getFieldSuggestions(
    collectionPath: string,
    fieldName: string,
    fieldType: string,
    currentValue?: string,
  ): Promise<string[]> {
    const cacheKey = `${collectionPath}:${fieldName}:${fieldType}`

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      return this.filterSuggestions(cached, currentValue)
    }

    try {
      // Get suggestions from existing documents
      const suggestions = await this.fetchFieldValues(collectionPath, fieldName, fieldType)

      // Add predefined suggestions based on field name and type
      const predefinedSuggestions = this.getPredefinedSuggestions(fieldName, fieldType)

      // Combine and deduplicate
      const allSuggestions = [...new Set([...suggestions, ...predefinedSuggestions])]

      // Cache the results
      this.cache.set(cacheKey, allSuggestions)
      setTimeout(() => this.cache.delete(cacheKey), this.CACHE_DURATION)

      return this.filterSuggestions(allSuggestions, currentValue)
    } catch (error) {
      console.warn(`Failed to get suggestions for ${fieldName}:`, error)
      return this.getPredefinedSuggestions(fieldName, fieldType)
    }
  }

  /**
   * Fetch existing field values from the collection
   */
  private static async fetchFieldValues(
    collectionPath: string,
    fieldName: string,
    fieldType: string,
  ): Promise<string[]> {
    const suggestions: string[] = []

    try {
      const collectionRef = collection(db, collectionPath)
      const q = query(collectionRef, limit(50)) // Limit to avoid large queries
      const snapshot = await getDocs(q)

      snapshot.docs.forEach((doc) => {
        const data = doc.data()
        const value = data[fieldName]

        if (value !== undefined && value !== null) {
          if (fieldType === "string" && typeof value === "string") {
            suggestions.push(value)
          } else if (fieldType === "number" && typeof value === "number") {
            suggestions.push(value.toString())
          } else if (fieldType === "boolean" && typeof value === "boolean") {
            suggestions.push(value.toString())
          } else if (fieldType === "array" && Array.isArray(value)) {
            // Add individual array elements as suggestions
            value.forEach((item) => {
              if (typeof item === "string") {
                suggestions.push(item)
              }
            })
          }
        }
      })
    } catch (error) {
      console.warn(`Failed to fetch field values for ${fieldName}:`, error)
    }

    // Remove duplicates and sort
    return [...new Set(suggestions)].sort()
  }

  /**
   * Get predefined suggestions based on field name patterns
   */
  private static getPredefinedSuggestions(fieldName: string, fieldType: string): string[] {
    const lowerName = fieldName.toLowerCase()

    if (fieldType === "string") {
      // Status fields
      if (lowerName.includes("status")) {
        return ["active", "inactive", "pending", "completed", "draft", "published", "archived"]
      }

      // Category fields
      if (lowerName.includes("category")) {
        return ["electronics", "clothing", "books", "home", "sports", "automotive", "health", "beauty"]
      }

      // Priority fields
      if (lowerName.includes("priority")) {
        return ["high", "medium", "low", "urgent", "normal"]
      }

      // Type fields
      if (lowerName.includes("type")) {
        return ["product", "service", "digital", "physical", "subscription"]
      }

      // Role fields
      if (lowerName.includes("role")) {
        return ["admin", "user", "moderator", "guest", "editor", "viewer"]
      }

      // Country fields
      if (lowerName.includes("country")) {
        return [
          "United States",
          "Canada",
          "United Kingdom",
          "Germany",
          "France",
          "Japan",
          "Australia",
          "Brazil",
          "India",
          "China",
        ]
      }

      // Currency fields
      if (lowerName.includes("currency")) {
        return ["USD", "EUR", "GBP", "CAD", "JPY", "AUD", "CHF", "CNY"]
      }

      // Language fields
      if (lowerName.includes("language") || lowerName.includes("lang")) {
        return ["en", "es", "fr", "de", "it", "pt", "ja", "zh", "ko", "ar"]
      }

      // Color fields
      if (lowerName.includes("color") || lowerName.includes("colour")) {
        return ["red", "blue", "green", "yellow", "black", "white", "gray", "purple", "orange", "pink"]
      }

      // Size fields
      if (lowerName.includes("size")) {
        return ["XS", "S", "M", "L", "XL", "XXL", "small", "medium", "large"]
      }

      // Gender fields
      if (lowerName.includes("gender")) {
        return ["male", "female", "other", "prefer not to say"]
      }

      // Email domains
      if (lowerName.includes("email")) {
        return ["@gmail.com", "@yahoo.com", "@outlook.com", "@hotmail.com", "@company.com"]
      }
    }

    if (fieldType === "number") {
      // Common numeric values
      if (lowerName.includes("quantity") || lowerName.includes("count")) {
        return ["1", "5", "10", "25", "50", "100"]
      }

      if (lowerName.includes("price") || lowerName.includes("cost")) {
        return ["9.99", "19.99", "29.99", "49.99", "99.99"]
      }

      if (lowerName.includes("percentage") || lowerName.includes("percent")) {
        return ["0", "25", "50", "75", "100"]
      }

      if (lowerName.includes("rating")) {
        return ["1", "2", "3", "4", "5"]
      }
    }

    if (fieldType === "boolean") {
      return ["true", "false"]
    }

    return []
  }

  /**
   * Filter suggestions based on current input
   */
  private static filterSuggestions(suggestions: string[], currentValue?: string): string[] {
    if (!currentValue || currentValue.length < 1) {
      return suggestions.slice(0, 10) // Return top 10 suggestions
    }

    const filtered = suggestions.filter((suggestion) => suggestion.toLowerCase().includes(currentValue.toLowerCase()))

    // Sort by relevance (exact matches first, then starts with, then contains)
    return filtered
      .sort((a, b) => {
        const aLower = a.toLowerCase()
        const bLower = b.toLowerCase()
        const valueLower = currentValue.toLowerCase()

        if (aLower === valueLower) return -1
        if (bLower === valueLower) return 1
        if (aLower.startsWith(valueLower) && !bLower.startsWith(valueLower)) return -1
        if (bLower.startsWith(valueLower) && !aLower.startsWith(valueLower)) return 1

        return a.localeCompare(b)
      })
      .slice(0, 10)
  }

  /**
   * Clear the suggestions cache
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get validation patterns for common field types
   */
  static getValidationPattern(fieldName: string): RegExp | null {
    const lowerName = fieldName.toLowerCase()

    if (lowerName.includes("email")) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }

    if (lowerName.includes("phone")) {
      return /^\+?[\d\s\-$$$$]+$/
    }

    if (lowerName.includes("url") || lowerName.includes("website")) {
      return /^https?:\/\/.+/
    }

    if (lowerName.includes("zip") || lowerName.includes("postal")) {
      return /^[\d\-\s]+$/
    }

    return null
  }

  /**
   * Get format hints for fields
   */
  static getFormatHint(fieldName: string, fieldType: string): string | null {
    const lowerName = fieldName.toLowerCase()

    if (fieldType === "string") {
      if (lowerName.includes("email")) return "Format: user@example.com"
      if (lowerName.includes("phone")) return "Format: +1234567890"
      if (lowerName.includes("url")) return "Format: https://example.com"
      if (lowerName.includes("zip")) return "Format: 12345 or 12345-6789"
    }

    if (fieldType === "number") {
      if (lowerName.includes("price")) return "Format: 19.99"
      if (lowerName.includes("percentage")) return "Format: 0-100"
    }

    return null
  }
}
