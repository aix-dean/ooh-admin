"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Mail,
  Phone,
  MapPin,
  Building,
  Calendar,
  FileText,
  Copy,
  Check,
  User,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"

interface QuotationRequest {
  id: string
  break_date: any
  company: string
  company_address: string
  company_id: string
  contact_number: string
  created: any
  email_address: string
  end_date: any
  name: string
  position: string
  product_id: string
  product_ref: any
  start_date: any
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSING"
}

interface QuotationMemberDetailsDialogProps {
  quotation: QuotationRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusConfig = {
  PENDING: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  APPROVED: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  REJECTED: { color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  PROCESSING: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: AlertCircle },
}

export function QuotationMemberDetailsDialog({ quotation, open, onOpenChange }: QuotationMemberDetailsDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!quotation) return null

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const formatDate = (timestamp: any) => {
    try {
      let date
      if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000)
      } else if (timestamp?.toDate) {
        date = timestamp.toDate()
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp)
      } else if (typeof timestamp === "number") {
        date = new Date(timestamp)
      } else {
        date = new Date(timestamp)
      }

      if (isNaN(date.getTime())) {
        return "Not specified"
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      return "Not specified"
    }
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING
    const Icon = config.icon

    return (
      <Badge variant="outline" className={`${config.color} border`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-lg">
                {quotation.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{quotation.name}</h2>
              <p className="text-sm text-muted-foreground">
                {quotation.position} at {quotation.company}
              </p>
              <StatusBadge status={quotation.status} />
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="quotation">Quotation</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Full Name:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{quotation.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(quotation.name, "name")}
                          >
                            {copiedField === "name" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Position:</span>
                        </div>
                        <span className="text-sm">{quotation.position}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Email:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{quotation.email_address}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(quotation.email_address, "email")}
                          >
                            {copiedField === "email" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Phone:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{quotation.contact_number}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(quotation.contact_number, "phone")}
                          >
                            {copiedField === "phone" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="company" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Company Name:</span>
                      </div>
                      <span className="text-sm font-semibold">{quotation.company}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Company ID:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono bg-white px-2 py-1 rounded border">
                          {quotation.company_id}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(quotation.company_id, "company_id")}
                        >
                          {copiedField === "company_id" ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span className="text-sm font-medium">Company Address:</span>
                      </div>
                      <p className="text-sm ml-6">{quotation.company_address}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quotation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Quotation Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Start Date:</span>
                        </div>
                        <p className="text-sm ml-6 font-semibold">{formatDate(quotation.start_date)}</p>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">End Date:</span>
                        </div>
                        <p className="text-sm ml-6 font-semibold">{formatDate(quotation.end_date)}</p>
                      </div>

                      {quotation.break_date && (
                        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-800">Break Date:</span>
                          </div>
                          <p className="text-sm ml-6 font-semibold text-yellow-800">
                            {formatDate(quotation.break_date)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Product ID:</span>
                        </div>
                        <div className="flex items-center gap-2 ml-6">
                          <span className="text-sm font-mono bg-white px-2 py-1 rounded border">
                            {quotation.product_id}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(quotation.product_id, "product_id")}
                          >
                            {copiedField === "product_id" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Status:</span>
                        </div>
                        <div className="ml-6">
                          <StatusBadge status={quotation.status} />
                        </div>
                      </div>

                      {quotation.product_ref && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Product Reference:</span>
                          </div>
                          <p className="text-xs ml-6 font-mono text-blue-700 bg-white p-2 rounded border">
                            {JSON.stringify(quotation.product_ref, null, 2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Request Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-green-800">Quotation Submitted</h4>
                        <p className="text-sm text-green-700">{formatDate(quotation.created)}</p>
                        <p className="text-xs text-green-600 mt-1">Request ID: {quotation.id}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold">Current Status</h4>
                        <div className="mt-1">
                          <StatusBadge status={quotation.status} />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Last updated: {formatDate(quotation.created)}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">Request Summary</h4>
                      <div className="text-xs text-blue-700 space-y-1">
                        <p>
                          <strong>Requestor:</strong> {quotation.name} ({quotation.position})
                        </p>
                        <p>
                          <strong>Company:</strong> {quotation.company}
                        </p>
                        <p>
                          <strong>Duration:</strong> {formatDate(quotation.start_date)} to{" "}
                          {formatDate(quotation.end_date)}
                        </p>
                        <p>
                          <strong>Product:</strong> {quotation.product_id}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
