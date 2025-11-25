import * as React from "react"
import { cn } from "@/utils"

export const Select = ({ children, value, onValueChange }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  
  return (
    <div className="select-container">
      {React.Children.map(children, child =>
        React.cloneElement(child, { value, onValueChange, isOpen, setIsOpen })
      )}
    </div>
  )
}

export const SelectTrigger = React.forwardRef(
  ({ className, children, isOpen, setIsOpen, ...props }, ref) => {
    return (
      <div className="relative">
        <button
          ref={ref}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent transition-colors",
            className
          )}
          {...props}
        >
          {children}
          <svg 
            className={cn(
              "h-4 w-4 opacity-50 transition-transform duration-200",
              isOpen && "rotate-180"
            )} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

export const SelectValue = ({ placeholder, value }) => {
  return <span>{value || placeholder}</span>
}

export const SelectContent = React.forwardRef(
  ({ className, children, value, onValueChange, isOpen, setIsOpen, ...props }, ref) => {
    const contentRef = React.useRef(null)
    
    // Close dropdown when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event) => {
        if (contentRef.current && !contentRef.current.parentElement.contains(event.target)) {
          setIsOpen(false)
        }
      }
      
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen, setIsOpen])
    
    if (!isOpen) return null
    
    return (
      <div
        ref={contentRef}
        className={cn(
          "absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95",
          className
        )}
        style={{
          animation: 'slideDown 0.2s ease-out'
        }}
        {...props}
      >
        <div className="p-1 max-h-60 overflow-auto">
          {React.Children.map(children, child =>
            React.cloneElement(child, { 
              onSelect: (newValue) => {
                onValueChange?.(newValue)
                setIsOpen(false)
              },
              isSelected: child.props.value === value
            })
          )}
        </div>
        <style jsx>{`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    )
  }
)
SelectContent.displayName = "SelectContent"

export const SelectItem = React.forwardRef(
  ({ className, children, value, onSelect, isSelected, ...props }, ref) => {
    return (
      <div
        ref={ref}
        onClick={() => onSelect?.(value)}
        className={cn(
          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors duration-150",
          "hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-accent text-accent-foreground font-medium",
          className
        )}
        {...props}
      >
        {children}
        {isSelected && (
          <svg 
            className="ml-auto h-4 w-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"
