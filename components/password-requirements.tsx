import { Check, X } from "lucide-react"

interface PasswordRequirementsProps {
  password: string
  className?: string
}

export function PasswordRequirements({ password, className = "" }: PasswordRequirementsProps) {
  // Define password requirements
  const requirements = [
    {
      text: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      text: "At least one uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      text: "At least one lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      text: "At least one number",
      met: /[0-9]/.test(password),
    },
    {
      text: "At least one special character",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ]

  // Calculate overall strength
  const metCount = requirements.filter((req) => req.met).length
  const strength = metCount / requirements.length

  // Determine strength color
  let strengthColor = "bg-red-500"
  if (strength >= 0.8) strengthColor = "bg-green-500"
  else if (strength >= 0.5) strengthColor = "bg-yellow-500"
  else if (strength >= 0.3) strengthColor = "bg-orange-500"

  return (
    <div className={`mt-2 text-sm ${className}`}>
      <div className="mb-2">
        <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${strengthColor} transition-all duration-300 ease-in-out`}
            style={{ width: `${strength * 100}%` }}
          />
        </div>
      </div>
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-center">
            {req.met ? <Check className="h-3 w-3 text-green-500 mr-2" /> : <X className="h-3 w-3 text-red-500 mr-2" />}
            <span className={req.met ? "text-green-700" : "text-gray-600"}>{req.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
