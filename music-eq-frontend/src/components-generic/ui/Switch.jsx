import * as React from "react"
import { cn } from "@/utils"

export const Switch = React.forwardRef(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const handleChange = (e) => {
      onCheckedChange?.(e.target.checked)
    }

    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div className={cn(
          "w-11 h-6 bg-input rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary",
          className
        )}></div>
      </label>
    )
  }
)
Switch.displayName = "Switch"
