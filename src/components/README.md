# Components Structure

This folder contains all the UI components organized in a clean, modular structure.

## 📁 Folder Structure

```
src/components/
├── index.js              # Main export file - import from here!
└── ui/
    ├── index.js          # UI components barrel export
    ├── Button.jsx        # Button component with variants
    ├── Card.jsx          # Card container component
    ├── Label.jsx         # Form label component
    ├── Slider.jsx        # Range slider component
    ├── Switch.jsx        # Toggle switch component
    ├── Select.jsx        # Dropdown select (with 4 sub-components)
    └── ToggleGroup.jsx   # Toggle button group (with 2 components)
```

## 🎯 Usage

### Option 1: Import from main components folder (Recommended)
```jsx
import { Button, Card, Label } from '@/components'
```

### Option 2: Import from ui folder
```jsx
import { Button, Card, Label } from '@/components/ui'
```

### Option 3: Import specific component file
```jsx
import { Button } from '@/components/ui/Button'
```

## 📦 Available Components

### 1. **Button** (`Button.jsx`)
Button component with variants and sizes.

```jsx
<Button>Click me</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost" size="icon">
  <Icon />
</Button>
```

**Props:**
- `variant`: "default" | "outline" | "ghost"
- `size`: "default" | "icon"

---

### 2. **Card** (`Card.jsx`)
Container component for grouped content.

```jsx
<Card className="p-6">
  <h2>Title</h2>
  <p>Content</p>
</Card>
```

---

### 3. **Label** (`Label.jsx`)
Form label component.

```jsx
<Label htmlFor="input-id">Label Text</Label>
```

---

### 4. **Slider** (`Slider.jsx`)
Range input slider component.

```jsx
<Slider
  min={0}
  max={100}
  step={1}
  value={[50]}
  onValueChange={(value) => setValue(value)}
/>
```

**Props:**
- `min`: number (default: 0)
- `max`: number (default: 100)
- `step`: number (default: 1)
- `value`: [number] (array with single value)
- `onValueChange`: (value: [number]) => void

---

### 5. **Switch** (`Switch.jsx`)
Toggle switch component.

```jsx
<Switch
  checked={isOn}
  onCheckedChange={(checked) => setIsOn(checked)}
/>
```

**Props:**
- `checked`: boolean
- `onCheckedChange`: (checked: boolean) => void

---

### 6. **Select** (`Select.jsx`)
Dropdown select component with multiple sub-components.

```jsx
<Select value={selectedValue} onValueChange={setSelectedValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

**Components:**
- `Select` - Wrapper component
- `SelectTrigger` - Clickable trigger button
- `SelectValue` - Displays selected value
- `SelectContent` - Dropdown content container
- `SelectItem` - Individual option item

---

### 7. **ToggleGroup** (`ToggleGroup.jsx`)
Toggle button group component.

```jsx
<ToggleGroup type="single" defaultValue="option1">
  <ToggleGroupItem value="option1">Option 1</ToggleGroupItem>
  <ToggleGroupItem value="option2">Option 2</ToggleGroupItem>
  <ToggleGroupItem value="option3">Option 3</ToggleGroupItem>
</ToggleGroup>
```

**Props (ToggleGroup):**
- `type`: "single" (only single supports currently)
- `value`: string (controlled)
- `onValueChange`: (value: string) => void
- `defaultValue`: string (uncontrolled)

**Components:**
- `ToggleGroup` - Wrapper component
- `ToggleGroupItem` - Individual toggle button

---

## 🎨 Styling

All components use Tailwind CSS and support the `className` prop for custom styling:

```jsx
<Button className="mt-4 w-full">
  Custom Styled Button
</Button>
```

## 🔧 Adding New Components

1. Create a new file in `src/components/ui/` (e.g., `NewComponent.jsx`)
2. Export it from `src/components/ui/index.js`
3. It will automatically be available via `@/components`

Example:
```jsx
// src/components/ui/NewComponent.jsx
export const NewComponent = ({ children }) => {
  return <div>{children}</div>
}

// src/components/ui/index.js
export { NewComponent } from './NewComponent'
```

---

## 📝 Notes

- All components are using `React.forwardRef` for ref forwarding
- Components use the `cn()` utility from `@/utils` for className merging
- Styling uses CSS variables defined in `src/index.css`
- All components support spreading additional props

---

**Total Components: 7 files** | **Total Sub-components: 11** | **Easy to navigate and maintain!** ✨
