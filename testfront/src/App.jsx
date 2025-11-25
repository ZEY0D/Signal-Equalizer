import { useState } from "react"
import { 
  Button, 
  Card, 
  Label, 
  Slider, 
  Switch, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue, 
  ToggleGroup, 
  ToggleGroupItem 
} from "@/components"
import { Play, Pause, Square, FileUp, ZoomIn, ZoomOut, Plus } from "lucide-react"

export default function App() {
  const [speed, setSpeed] = useState([1])
  const [showSpectrograms, setShowSpectrograms] = useState(true)
  const [equalizerMode, setEqualizerMode] = useState("generic")

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-full px-2">
          <h1 className="text-2xl font-bold tracking-tight">Signal Equalizer</h1>
          <Button className="gap-2">
            <FileUp className="h-4 w-4" />
            Open File...
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="flex gap-6 max-w-full">
          {/* Left Column - Main Content (~70%) */}
          <div className="flex-[70] space-y-6 min-w-0">
            {/* Playback & View Controls */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Playback & View Controls</h2>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" title="Play">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" title="Pause">
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" title="Stop">
                    <Square className="h-4 w-4" />
                  </Button>
                </div>

                <div className="h-6 border-r border-border"></div>

                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Label htmlFor="speed" className="whitespace-nowrap text-sm">
                    Speed
                  </Label>
                  <Slider
                    id="speed"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={speed}
                    onValueChange={setSpeed}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-10 text-right">{speed[0].toFixed(1)}x</span>
                </div>

                <div className="h-6 border-r border-border"></div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" title="Zoom In">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" title="Zoom Out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="px-3 bg-transparent">
                    Reset View
                  </Button>
                </div>
              </div>
            </Card>

            {/* Input Signal */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Input Signal (Time-Domain)</h2>
              <div className="h-56 bg-muted rounded-lg flex items-center justify-center border border-border">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-2">Input Cine Viewer</p>
                  <p className="text-xs text-muted-foreground">Chart.js Line Chart Placeholder</p>
                </div>
              </div>
            </Card>

            {/* Input Spectrogram */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Input Spectrogram</h2>
              {showSpectrograms ? (
                <div className="h-40 bg-muted rounded-lg flex items-center justify-center border border-border">
                  <p className="text-muted-foreground text-sm">Spectrogram Placeholder</p>
                </div>
              ) : (
                <div className="h-20 bg-muted/50 rounded-lg flex items-center justify-center border border-dashed border-border">
                  <p className="text-muted-foreground text-xs">Hidden</p>
                </div>
              )}
            </Card>

            {/* Output Signal */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Output Signal (Time-Domain)</h2>
              <div className="h-56 bg-muted rounded-lg flex items-center justify-center border border-border">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-2">Output Cine Viewer</p>
                  <p className="text-xs text-muted-foreground">Chart.js Line Chart Placeholder</p>
                </div>
              </div>
            </Card>

            {/* Output Spectrogram */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Output Spectrogram</h2>
              {showSpectrograms ? (
                <div className="h-40 bg-muted rounded-lg flex items-center justify-center border border-border">
                  <p className="text-muted-foreground text-sm">Spectrogram Placeholder</p>
                </div>
              ) : (
                <div className="h-20 bg-muted/50 rounded-lg flex items-center justify-center border border-dashed border-border">
                  <p className="text-muted-foreground text-xs">Hidden</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Sidebar (~30%) */}
          <div className="flex-[30] space-y-6 min-w-0">
            {/* Frequency Graph */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Frequency Graph</h2>
              <div className="h-56 bg-muted rounded-lg flex items-center justify-center border border-border mb-4">
                <p className="text-muted-foreground text-sm">Chart Placeholder</p>
              </div>
              <ToggleGroup type="single" defaultValue="linear" className="w-full">
                <ToggleGroupItem value="linear" className="flex-1">
                  Linear
                </ToggleGroupItem>
                <ToggleGroupItem value="audiogram" className="flex-1">
                  Audiogram
                </ToggleGroupItem>
              </ToggleGroup>
            </Card>

            {/* Equalizer Controls */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Equalizer Controls</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="mode" className="text-sm mb-2 block">
                    Mode
                  </Label>
                  <Select value={equalizerMode} onValueChange={setEqualizerMode}>
                    <SelectTrigger id="mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generic">Generic</SelectItem>
                      <SelectItem value="instruments">Musical Instruments</SelectItem>
                      <SelectItem value="animals">Animal Sounds</SelectItem>
                      <SelectItem value="voices">Human Voices</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" className="w-full bg-transparent" onClick={() => console.log("Add slider")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Slider
                </Button>
              </div>
            </Card>

            {/* View Options */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">View Options</h2>
              <div className="flex items-center justify-between">
                <Label htmlFor="spectrograms" className="text-sm cursor-pointer">
                  Show/Hide Spectrograms
                </Label>
                <Switch id="spectrograms" checked={showSpectrograms} onCheckedChange={setShowSpectrograms} />
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
