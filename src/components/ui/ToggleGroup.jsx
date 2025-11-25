import * as React from "react"
import { cn } from "@/utils"

export const ToggleGroup = ({ type = "single", value, onValueChange, defaultValue, className, children }) => {
  const [selected, setSelected] = React.useState(defaultValue || value)

  const handleToggle = (itemValue) => {
    if (type === "single") {
      setSelected(itemValue)
      onValueChange?.(itemValue)
    }
  }

  return (
    <div className={cn("inline-flex rounded-md shadow-sm", className)} role="group">
      {React.Children.map(children, child =>
        React.cloneElement(child, {
          isSelected: selected === child.props.value,
          onToggle: handleToggle,
        })
      )}
    </div>
  )
}

export const ToggleGroupItem = React.forwardRef(
  ({ className, children, value, isSelected, onToggle, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onToggle?.(value)}
        className={cn(
          "px-4 py-2 text-sm font-medium border border-border first:rounded-l-md last:rounded-r-md hover:bg-accent",
          isSelected && "bg-accent text-accent-foreground",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ToggleGroupItem.displayName = "ToggleGroupItem"
