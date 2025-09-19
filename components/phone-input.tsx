"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { countryCodes, formatPhoneNumber, getMaxLengthForCountry } from "@/lib/country-codes"
import { getFlagEmoji } from "@/lib/country-flags"

interface PhoneInputProps {
  value: string
  countryCode: string
  onChange: (value: string, countryCode: string) => void
  error?: string
  disabled?: boolean
}

export function PhoneInput({ value, countryCode, onChange, error, disabled = false }: PhoneInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [searchQuery, setSearchQuery] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const maxLength = getMaxLengthForCountry(countryCode)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Get the selected country
  const selectedCountry = countryCodes.find((c) => c.dial_code === countryCode)

  // Filter countries based on search query
  const filteredCountries = countryCodes.filter(
    (country) =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dial_code.includes(searchQuery) ||
      country.code.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  useEffect(() => {
    // Format the phone number when the component mounts or when countryCode changes
    const formatted = formatPhoneNumber(value, countryCode)
    setInputValue(formatted)
  }, [countryCode, value])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      // Focus the search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 10)
    } else {
      setSearchQuery("")
      setHighlightedIndex(-1)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        })
      }
    }
  }, [highlightedIndex])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "")

    // Limit to max length for the selected country
    const truncatedValue = rawValue.slice(0, maxLength)

    // Format the number according to the country format
    const formatted = formatPhoneNumber(truncatedValue, countryCode)
    setInputValue(formatted)

    // Pass the raw digits to the parent component
    onChange(truncatedValue, countryCode)
  }

  const handleCountryChange = (selectedDialCode: string) => {
    // When country changes, reformat the existing number
    onChange(value, selectedDialCode)
    setIsOpen(false)

    // Focus the input field after selecting a country
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const clearInput = () => {
    setInputValue("")
    onChange("", countryCode)
    inputRef.current?.focus()
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setHighlightedIndex(0) // Reset highlight to first item when search changes
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < filteredCountries.length - 1 ? prev + 1 : prev))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredCountries.length) {
          handleCountryChange(filteredCountries[highlightedIndex].dial_code)
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        break
      case "Tab":
        setIsOpen(false)
        break
    }
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className={cn("flex flex-col sm:flex-row gap-2", error ? "border-red-500" : "")}>
        <div className="relative w-full sm:w-[180px]" ref={dropdownRef}>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className="w-full justify-between border-muted-foreground/20 hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-lg" aria-hidden="true">
                {selectedCountry ? getFlagEmoji(selectedCountry.code) : "🌐"}
              </span>
              <span className="font-medium">{countryCode}</span>
              {selectedCountry && (
                <span className="hidden sm:inline truncate text-muted-foreground text-xs">{selectedCountry.name}</span>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", isOpen && "rotate-180")} />
          </Button>

          {isOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-0 shadow-md animate-in fade-in-0 zoom-in-95">
              <div className="sticky top-0 z-10 bg-popover p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search countries..."
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto p-1" role="listbox" ref={listRef} tabIndex={-1}>
                {filteredCountries.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No country found</div>
                ) : (
                  filteredCountries.map((country, index) => (
                    <div
                      key={country.code}
                      role="option"
                      aria-selected={countryCode === country.dial_code}
                      data-highlighted={index === highlightedIndex}
                      className={cn(
                        "flex items-center justify-between px-2 py-3 cursor-pointer rounded-sm text-sm outline-none",
                        countryCode === country.dial_code && "bg-accent text-accent-foreground font-medium",
                        index === highlightedIndex && "bg-accent text-accent-foreground",
                        "hover:bg-accent hover:text-accent-foreground active:bg-accent active:text-accent-foreground",
                      )}
                      onClick={() => handleCountryChange(country.dial_code)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onTouchStart={() => setHighlightedIndex(index)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden="true">
                          {getFlagEmoji(country.code)}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium">{country.name}</span>
                          <span className="text-xs text-muted-foreground">{country.dial_code}</span>
                        </div>
                      </div>
                      {countryCode === country.dial_code && <Check className="h-4 w-4" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            className={cn("pr-8", error ? "border-red-500 focus-visible:ring-red-500" : "focus-visible:ring-primary")}
            placeholder={selectedCountry?.format || "Phone number"}
            disabled={disabled}
          />
          {inputValue && (
            <button
              type="button"
              onClick={clearInput}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear input"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <p className="text-xs text-muted-foreground">Format: {selectedCountry?.format || "XXX XXX XXXX"}</p>
    </div>
  )
}
