"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export function FormDebug() {
  const [isOpen, setIsOpen] = useState(false)
  const form = useFormContext()

  if (!form) return null

  const { formState, getValues } = form
  const { errors, isDirty, isSubmitting, isValid, dirtyFields, touchedFields } = formState

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)} className="bg-background shadow-md">
        {isOpen ? "Hide Debug" : "Debug Form"}
      </Button>

      {isOpen && (
        <Card className="absolute bottom-12 right-0 w-96 shadow-lg">
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Form Debug</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-96 rounded-md border p-2">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Form State</h3>
                  <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify({ isDirty, isSubmitting, isValid }, null, 2)}
                  </pre>
                </div>

                <div>
                  <h3 className="font-medium">Form Values</h3>
                  <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(getValues(), null, 2)}
                  </pre>
                </div>

                <div>
                  <h3 className="font-medium">Errors</h3>
                  <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto">
                    {Object.keys(errors).length > 0 ? JSON.stringify(errors, null, 2) : "No errors"}
                  </pre>
                </div>

                <div>
                  <h3 className="font-medium">Dirty Fields</h3>
                  <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto">
                    {Object.keys(dirtyFields).length > 0 ? JSON.stringify(dirtyFields, null, 2) : "No dirty fields"}
                  </pre>
                </div>

                <div>
                  <h3 className="font-medium">Touched Fields</h3>
                  <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto">
                    {Object.keys(touchedFields).length > 0
                      ? JSON.stringify(touchedFields, null, 2)
                      : "No touched fields"}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
