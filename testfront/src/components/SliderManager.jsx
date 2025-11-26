/**
 * SliderManager Component
 * 
 * Manages all equalizer sliders:
 * - Add/remove sliders
 * - Update slider parameters
 * - Visual list of all active sliders
 * - Quick presets (bass, treble, voice, etc.)
 */

import { Button, Card, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components"
import { Plus, Save, Loader2, RotateCcw } from "lucide-react"
import { SliderControl } from "./SliderControl"

export function SliderManager({
  sliders = [],
  maxFrequency = 22050,
  onAddSlider,
  onUpdateSlider,
  onRemoveSlider,
  onProcessSignal,
  onReset,
  isLoading = false,
  disabled = false,
  autoProcess = false,
}) {
  // Predefined frequency presets
  const presets = {
    bass: { center_freq: 100, width: 100, gain: 1.5 },
    lowMid: { center_freq: 500, width: 300, gain: 1.2 },
    mid: { center_freq: 1000, width: 500, gain: 1.0 },
    highMid: { center_freq: 3000, width: 1000, gain: 1.1 },
    treble: { center_freq: 8000, width: 2000, gain: 1.3 },
    presence: { center_freq: 5000, width: 1500, gain: 1.2 },
  }

  const handleAddPreset = (presetName) => {
    const preset = presets[presetName]
    if (preset) {
      onAddSlider(preset)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold">
          Frequency Sliders ({sliders.length})
        </Label>
        <Button
          variant="default"
          size="sm"
          onClick={() => onAddSlider()}
          disabled={disabled}
          className="gap-2"
        >
          <Plus className="h-3 w-3" />
          Add Slider
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Control center frequency, width, and gain for each slider. Visual dragging on frequency graph coming soon.
      </p>

      {/* Sliders List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {sliders.length === 0 ? (
          <Card className="p-8 bg-muted/20 border-dashed">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                No sliders yet
              </p>
              <p className="text-xs text-muted-foreground">
                Click "Add Custom" or choose a preset to start
              </p>
            </div>
          </Card>
        ) : (
          sliders.map((slider) => (
            <SliderControl
              key={slider.id}
              id={slider.id}
              centerFreq={slider.center_freq}
              width={slider.width}
              gain={slider.gain}
              maxFrequency={maxFrequency}
              onChange={(updates) => onUpdateSlider(slider.id, updates)}
              onRemove={() => onRemoveSlider(slider.id)}
            />
          ))
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2 border-t border-border">
        {!autoProcess && (
          <Button
            className="w-full gap-2"
            onClick={onProcessSignal}
            disabled={disabled || sliders.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Apply Changes
              </>
            )}
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onReset}
          disabled={disabled || isLoading}
        >
          <RotateCcw className="h-4 w-4" />
          Reset All
        </Button>
      </div>

      {/* Info */}
      {sliders.length > 0 && (
        <div className="text-xs text-muted-foreground text-center bg-muted/20 rounded p-2">
          <p>💡 Expand each slider for detailed controls</p>
          <p className="mt-1">Gain: 0 = mute, 1 = no change, 2 = double</p>
        </div>
      )}
    </div>
  )
}
