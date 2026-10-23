# Project Design System & Identity (`DESIGN.md`)

## Identity
- **Product Name**: 
- **Primary User**: 
- **Visual Tone**: Modern, Clean, Professional

## Semantic Tokens

```json
{
  "color": {
    "action": { "primary": "#2563EB", "hover": "#1D4ED8" },
    "surface": { "default": "#FFFFFF", "muted": "#F3F4F6" },
    "text": { "primary": "#111827", "muted": "#6B7280" },
    "border": { "subtle": "#E5E7EB" },
    "feedback": { "error": "#DC2626", "success": "#16A34A" }
  },
  "space": {
    "compact": "4px",
    "default": "8px",
    "section": "24px"
  },
  "radius": {
    "control": "6px",
    "container": "12px"
  },
  "type": {
    "heading": "Inter, sans-serif",
    "body": "Inter, sans-serif"
  }
}
```

## Principles & Anti-Patterns
1. Ground all component styles in semantic tokens above.
2. No unmotivated glassmorphism, decorative gradients, or card spam.
3. Enforce WCAG 2.1 AA accessibility (4.5:1 contrast ratio, focus visible states).
