/**
 * SliderControl Component
 * 
 * Individual frequency equalizer slider with:
 * - Center frequency control (draggable/input)
 * - Width (bandwidth) control
 * - Gain control (0 to 2)
 * - Visual representation
 */

import { useState } from "react"
import { Card, Label, Slider, Button } from "@/components"
import { X, GripVertical } from "lucide-react"

export function SliderControl({ 
  id, 
  centerFreq, 
  width, 
  gain,
  maxFrequency = 22050, // Nyquist frequency for 44100 Hz sample rate
  onChange,
  onRemove 
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Handle center frequency change
  const handleCenterFreqChange = (value) => {
    onChange({ center_freq: value[0] })
  }

  // Handle width change
  const handleWidthChange = (value) => {
    onChange({ width: value[0] })
  }

  // Handle gain change
  const handleGainChange = (value) => {
    onChange({ gain: value[0] })
  }

  // Calculate frequency range
  const freqMin = Math.max(0, centerFreq - width / 2)
  const freqMax = Math.min(maxFrequency, centerFreq + width / 2)

  return (
    <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
      <div className="space-y-4">
        {/* Header with drag handle and remove button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
            <span className="font-medium text-sm">
              Slider #{id.toString().slice(-4)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs h-6 px-2"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-6 w-6 text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick info (always visible) */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-muted-foreground">Frequency</div>
            <div className="font-mono font-medium">{centerFreq.toFixed(0)} Hz</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Width</div>
            <div className="font-mono font-medium">{width.toFixed(0)} Hz</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground">Gain</div>
            <div className={`font-mono font-medium ${
              gain > 1 ? 'text-green-600' : gain < 1 ? 'text-orange-600' : 'text-foreground'
            }`}>
              {gain.toFixed(2)}x
            </div>
          </div>
        </div>

        {/* Frequency range indicator */}
        <div className="text-xs text-center text-muted-foreground bg-muted/50 rounded px-2 py-1">
          Range: {freqMin.toFixed(0)} - {freqMax.toFixed(0)} Hz
        </div>

        {/* Expanded controls */}
        {isExpanded && (
          <div className="space-y-4 pt-2 border-t border-border">
            {/* Center Frequency Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Center Frequency</Label>
                <input
                  type="number"
                  value={centerFreq.toFixed(0)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val >= 0 && val <= maxFrequency) {
                      onChange({ center_freq: val })
                    }
                  }}
                  className="w-20 px-2 py-1 text-xs rounded border border-input bg-background text-right font-mono"
                  min="0"
                  max={maxFrequency}
                  step="10"
                />
              </div>
              <Slider
                value={[centerFreq]}
                onValueChange={handleCenterFreqChange}
                min={0}
                max={maxFrequency}
                step={10}
                className="w-full"
              />
            </div>

            {/* Width Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Bandwidth (Width)</Label>
                <input
                  type="number"
                  value={width.toFixed(0)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val >= 10 && val <= 5000) {
                      onChange({ width: val })
                    }
                  }}
                  className="w-20 px-2 py-1 text-xs rounded border border-input bg-background text-right font-mono"
                  min="10"
                  max="5000"
                  step="10"
                />
              </div>
              <Slider
                value={[width]}
                onValueChange={handleWidthChange}
                min={10}
                max={5000}
                step={10}
                className="w-full"
              />
            </div>

            {/* Gain Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Gain Multiplier</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={gain.toFixed(2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val) && val >= 0 && val <= 2) {
                        onChange({ gain: val })
                      }
                    }}
                    className="w-16 px-2 py-1 text-xs rounded border border-input bg-background text-right font-mono"
                    min="0"
                    max="2"
                    step="0.01"
                  />
                  <span className="text-xs text-muted-foreground">
                    {gain > 1 ? `+${((gain - 1) * 100).toFixed(0)}%` : 
                     gain < 1 ? `-${((1 - gain) * 100).toFixed(0)}%` : 
                     '0%'}
                  </span>
                </div>
              </div>
              <Slider
                value={[gain]}
                onValueChange={handleGainChange}
                min={0}
                max={2}
                step={0.01}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mute</span>
                <span>Unity</span>
                <span>+100%</span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-4 gap-1 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onChange({ gain: 0 })}
              >
                Mute
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onChange({ gain: 0.5 })}
              >
                -50%
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onChange({ gain: 1.0 })}
              >
                Unity
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onChange({ gain: 2.0 })}
              >
                +100%
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
