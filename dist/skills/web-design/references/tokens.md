# Design Tokens Reference

Source: Xialiang/SKILL.md (CONSENSUS)

## Purpose
Enforces semantic tokens over raw hardcoded values.

## Token Categories
1. **Color Tokens**: `color.action.primary`, `color.surface.default`, `color.text.primary`, `color.border.subtle`, `color.feedback.error`.
2. **Spacing Tokens**: `space.component.compact`, `space.component.default`, `space.layout.section`.
3. **Radius Tokens**: `radius.control`, `radius.container`.
4. **Typography Tokens**: `type.heading.primary`, `type.body.default`, `type.mono`.

## Rules
- Arbitrary raw values (`#3B82F6`, `12px`, `rounded-2xl`) without semantic mapping trigger code review warnings.
