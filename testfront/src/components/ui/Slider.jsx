import * as React from "react"
import { cn } from "@/utils"

export const Slider = React.forwardRef(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const [localValue, setLocalValue] = React.useState(value || [min])
    
    const handleChange = (e) => {
      const newValue = [parseFloat(e.target.value)]
      setLocalValue(newValue)
      onValueChange?.(newValue)
    }

    React.useEffect(() => {
      if (value) setLocalValue(value)
    }, [value])

    return (
      <div className={cn("relative flex w-full touch-none select-none items-center", className)} ref={ref}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue[0]}
          onChange={handleChange}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider-thumb"
          {...props}
        />
        <style>{`
          .slider-thumb::-webkit-slider-thumb {
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: hsl(var(--primary));
            cursor: pointer;
            border: 2px solid hsl(var(--background));
          }
          .slider-thumb::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: hsl(var(--primary));
            cursor: pointer;
            border: 2px solid hsl(var(--background));
          }
        `}</style>
      </div>
    )
  }
)
Slider.displayName = "Slider"
