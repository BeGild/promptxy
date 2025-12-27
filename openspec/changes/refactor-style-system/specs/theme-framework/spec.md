## ADDED Requirements

### Requirement: CSS Variable System

The frontend SHALL provide a comprehensive CSS variable system for centralized style management.

#### Scenario: Color variables defined

- **GIVEN** the CSS variable system is initialized
- **THEN** the following color variables SHALL be defined in `:root`:
  - `--color-bg-primary` - Primary background color
  - `--color-bg-secondary` - Secondary background color
  - `--color-bg-elevated` - Elevated surface background color
  - `--color-text-primary` - Primary text color
  - `--color-text-secondary` - Secondary text color
  - `--color-text-muted` - Muted text color
  - `--color-brand-primary` - Brand primary color
  - `--color-brand-secondary` - Brand secondary color
  - `--color-status-success` - Success status color
  - `--color-status-warning` - Warning status color
  - `--color-status-error` - Error status color
  - `--color-status-info` - Info status color
  - `--color-border-default` - Default border color
  - `--color-border-subtle` - Subtle border color

#### Scenario: Spacing variables defined on 4px grid

- **GIVEN** the CSS variable system is initialized
- **THEN** the following spacing variables SHALL be defined in `:root`:
  - `--spacing-xs` = 4px (0.25rem)
  - `--spacing-sm` = 8px (0.5rem)
  - `--spacing-md` = 16px (1rem)
  - `--spacing-lg` = 24px (1.5rem)
  - `--spacing-xl` = 32px (2rem)
  - `--spacing-2xl` = 48px (3rem)

#### Scenario: Typography variables defined

- **GIVEN** the CSS variable system is initialized
- **THEN** the following typography variables SHALL be defined in `:root`:
  - `--font-size-xs` = 12px
  - `--font-size-sm` = 14px
  - `--font-size-md` = 16px
  - `--font-size-lg` = 18px
  - `--font-size-xl` = 20px
  - `--font-size-2xl` = 24px
  - `--font-weight-normal` = 400
  - `--font-weight-medium` = 500
  - `--font-weight-semibold` = 600
  - `--font-weight-bold` = 700

#### Scenario: Effect variables defined

- **GIVEN** the CSS variable system is initialized
- **THEN** the following effect variables SHALL be defined in `:root`:
  - `--radius-sm` = 4px
  - `--radius-md` = 8px
  - `--radius-lg` = 12px
  - `--radius-xl` = 16px
  - `--shadow-sm` = Small shadow
  - `--shadow-md` = Medium shadow
  - `--shadow-lg` = Large shadow
  - `--shadow-xl` = Extra large shadow

### Requirement: Light Theme Support

The frontend SHALL provide a light theme with appropriate color values.

#### Scenario: Light theme colors

- **GIVEN** the light theme is active
- **THEN** the following color values SHALL be applied:
  - `--color-bg-primary` = #ffffff (white)
  - `--color-bg-secondary` = #f5f5f5 (light gray)
  - `--color-bg-elevated` = #ffffff (white)
  - `--color-text-primary` = #1a1a1a (near black)
  - `--color-text-secondary` = #666666 (medium gray)
  - `--color-text-muted` = #999999 (light gray)
  - `--color-brand-primary` = #007acc (blue)
  - `--color-border-default` = #e0e0e0 (light border)

### Requirement: Dark Theme Support

The frontend SHALL provide a dark theme with appropriate color values.

#### Scenario: Dark theme colors

- **GIVEN** the dark theme is active (`.dark` class on documentElement)
- **THEN** the following color values SHALL be applied:
  - `--color-bg-primary` = #1e1e1e (dark gray)
  - `--color-bg-secondary` = #252526 (medium dark gray)
  - `--color-bg-elevated` = #2d2d30 (lighter dark gray)
  - `--color-text-primary` = #cccccc (light gray)
  - `--color-text-secondary` = #858585 (medium gray)
  - `--color-text-muted` = #6a6a6a (darker gray)
  - `--color-brand-primary` = #007acc (blue)
  - `--color-border-default` = #3e3e42 (dark border)

### Requirement: Theme Switching

The frontend SHALL support seamless switching between light and dark themes.

#### Scenario: Switch to dark theme

- **WHEN** the user switches to dark theme
- **THEN** the `.dark` class is added to `document.documentElement`
- **AND** all CSS variables update to dark theme values
- **AND** components re-render with dark theme colors

#### Scenario: Switch to light theme

- **WHEN** the user switches to light theme
- **THEN** the `.dark` class is removed from `document.documentElement`
- **AND** all CSS variables update to light theme values
- **AND** components re-render with light theme colors

#### Scenario: Theme persistence

- **WHEN** the user selects a theme
- **THEN** the theme preference is saved to localStorage
- **AND** on page load, the saved theme is applied
- **AND** if no saved preference, system preference is used via `prefers-color-scheme`

### Requirement: Tailwind CSS Integration

The frontend SHALL map CSS variables to Tailwind utility classes.

#### Scenario: Color utilities

- **GIVEN** Tailwind configuration is updated
- **THEN** the following utility classes SHALL be available:
  - `bg-primary` → `background-color: var(--color-bg-primary)`
  - `bg-secondary` → `background-color: var(--color-bg-secondary)`
  - `bg-elevated` → `background-color: var(--color-bg-elevated)`
  - `text-primary` → `color: var(--color-text-primary)`
  - `text-secondary` → `color: var(--color-text-secondary)`
  - `text-muted` → `color: var(--color-text-muted)`
  - `text-brand` → `color: var(--color-brand-primary)`
  - `border-default` → `border-color: var(--color-border-default)`

#### Scenario: Spacing utilities

- **GIVEN** Tailwind configuration is updated
- **THEN** the following spacing utilities SHALL use CSS variables:
  - `p-xs`, `p-sm`, `p-md`, `p-lg`, `p-xl`, `p-2xl` (padding)
  - `px-*`, `py-*` (axis-specific padding)
  - `m-*`, `mx-*`, `my-*` (margin)
  - `gap-*` (flex/grid gap)

#### Scenario: Typography utilities

- **GIVEN** Tailwind configuration is updated
- **THEN** the following typography utilities SHALL use CSS variables:
  - `text-xs`, `text-sm`, `text-md`, `text-lg`, `text-xl`, `text-2xl` (font-size)
  - `font-normal`, `font-medium`, `font-semibold`, `font-bold` (font-weight)

#### Scenario: Effect utilities

- **GIVEN** Tailwind configuration is updated
- **THEN** the following effect utilities SHALL use CSS variables:
  - `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl` (border-radius)
  - `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` (box-shadow)

### Requirement: HeroUI Theme Integration

The frontend SHALL configure HeroUI theme to inherit CSS variables.

#### Scenario: Light theme HeroUI configuration

- **GIVEN** HeroUI is configured with light theme
- **THEN** all HeroUI component colors SHALL reference CSS variables:
  - `background` → `var(--color-bg-primary)`
  - `foreground` → `var(--color-text-primary)`
  - `primary` colors → `var(--color-brand-primary)`
  - `success` colors → `var(--color-status-success)`
  - `warning` colors → `var(--color-status-warning)`
  - `error` colors → `var(--color-status-error)`

#### Scenario: Dark theme HeroUI configuration

- **GIVEN** HeroUI is configured with dark theme
- **THEN** all HeroUI component colors SHALL reference CSS variables:
  - `background` → `var(--color-bg-primary)`
  - `foreground` → `var(--color-text-primary)`
  - `primary` colors → `var(--color-brand-primary)`
  - `success` colors → `var(--color-status-success)`
  - `warning` colors → `var(--color-status-warning)`
  - `error` colors → `var(--color-status-error)`

#### Scenario: HeroUI dark mode configuration

- **GIVEN** Tailwind darkMode is set to `'class'`
- **THEN** HeroUI SHALL respond to the `.dark` class on documentElement
- **AND** HeroUI components SHALL automatically use dark theme colors when `.dark` is present

### Requirement: Style Token TypeScript Types

The frontend SHALL provide TypeScript type definitions for style tokens.

#### Scenario: Token types exported

- **GIVEN** the style token types module exists
- **THEN** the following types SHALL be exported:
  - `StyleTokens` - Object containing all style token values
  - `ColorTokens` - Color-specific tokens
  - `SpacingTokens` - Spacing-specific tokens
  - `TypographyTokens` - Typography-specific tokens
  - `EffectTokens` - Effect-specific tokens

#### Scenario: Token constants

- **GIVEN** the style token module exists
- **THEN** a `styleTokens` constant SHALL be exported with string values referencing CSS variables
- **AND** the constant SHALL have readonly properties

### Requirement: Modular Style Architecture

The frontend SHALL organize styles in a modular directory structure.

#### Scenario: Tokens directory

- **GIVEN** the styles directory exists
- **THEN** the following files SHALL exist in `styles/tokens/`:
  - `colors.css` - Color variable definitions
  - `spacing.css` - Spacing variable definitions
  - `typography.css` - Typography variable definitions
  - `effects.css` - Effect variable definitions (radius, shadow)
  - `index.css` - Aggregates all token files

#### Scenario: Themes directory

- **GIVEN** the styles directory exists
- **THEN** the following files SHALL exist in `styles/themes/`:
  - `light.css` - Light theme specific variables
  - `dark.css` - Dark theme specific variables

#### Scenario: Utilities directory

- **GIVEN** the styles directory exists
- **THEN** the following files SHALL exist in `styles/utilities/`:
  - `layout.css` - Layout utility classes
  - `components.css` - Component utility classes

#### Scenario: Entry point

- **GIVEN** the styles directory exists
- **THEN** `styles/index.css` SHALL exist as the entry point
- **AND** it SHALL import all token files
- **AND** it SHALL import all utility files
- **AND** it SHALL be imported in `frontend/src/main.tsx` or equivalent

### Requirement: Semantic Utility Classes

The frontend SHALL provide semantic utility classes for common patterns.

#### Scenario: Card utility

- **GIVEN** the `.card` class exists
- **THEN** it SHALL apply:
  - `background: var(--color-bg-elevated)`
  - `border-radius: var(--radius-md)`
  - `padding: var(--spacing-md)`
  - `box-shadow: var(--shadow-sm)`

#### Scenario: Button utility

- **GIVEN** the `.btn` class exists
- **THEN** it SHALL apply:
  - `padding: var(--spacing-sm) var(--spacing-md)`
  - `border-radius: var(--radius-md)`
  - `font-weight: var(--font-weight-medium)`
  - `transition: all 0.15s ease`

#### Scenario: Interactive utilities

- **GIVEN** the hover utilities exist
- **THEN** `.card-hoverable` SHALL add hover transition effects
- **AND** `.hover-lift` SHALL add translate-y effect on hover

### Requirement: Style System Compliance

The frontend SHALL enforce strict compliance with the style system, prohibiting hardcoded values and inline styles that bypass CSS variables.

#### Scenario: Prohibited hardcoded colors

- **GIVEN** a component file is being written or reviewed
- **THEN** hardcoded color values SHALL NOT be used
- **AND** the following patterns SHALL be prohibited:
  - `style={{ color: '#007acc' }}`
  - `style={{ backgroundColor: '#ffffff' }}`
  - `style={{ borderColor: '#e0e0e0' }}`
- **AND** all colors MUST use CSS variables or Tailwind classes

#### Scenario: Prohibited hardcoded spacing

- **GIVEN** a component file is being written or reviewed
- **THEN** hardcoded spacing values SHALL NOT be used
- **AND** the following patterns SHALL be prohibited:
  - `style={{ padding: '16px' }}`
  - `style={{ margin: '8px' }}`
  - `style={{ gap: '12px' }}`
- **AND** all spacing MUST use CSS variables or Tailwind classes

#### Scenario: Prohibited hardcoded sizes

- **GIVEN** a component file is being written or reviewed
- **THEN** hardcoded size values SHALL NOT be used
- **AND** the following patterns SHALL be prohibited:
  - `style={{ width: '44px' }}`
  - `style={{ height: '100%' }}`
  - `style={{ fontSize: '14px' }}`
- **AND** all sizes MUST use CSS variables or Tailwind classes

#### Scenario: Required style system compliance comment

- **GIVEN** a component file uses styling
- **THEN** the file SHALL contain a style system compliance comment at the top
- **AND** the comment SHALL include:
  - A warning about bypassing the style system
  - Examples of prohibited patterns
  - Examples of required patterns
- **AND** the comment format SHALL be:

```typescript
/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - style={{ color: '#007acc' }}
 * - style={{ padding: '16px' }}
 *
 * ✅ REQUIRED:
 * - className="text-brand"
 * - style={{ padding: 'var(--spacing-md)' }}
 */
```

#### Scenario: Inline style only with CSS variables

- **GIVEN** an inline style must be used (e.g., dynamic calculation)
- **THEN** the inline style MAY only use CSS variables
- **AND** hardcoded values SHALL NOT be used
- **AND** the following SHALL be allowed:
  - `style={{ padding: 'var(--spacing-md)' }}`
  - `style={{ width: 'calc(var(--spacing-md) * 2)' }}`
- **AND** the following SHALL be prohibited:
  - `style={{ padding: '16px' }}`
  - `style={{ width: '32px' }}`

#### Scenario: Legacy code removal

- **GIVEN** a component has been migrated to the style system
- **THEN** all legacy inline styles SHALL be removed
- **AND** all legacy hardcoded values SHALL be removed
- **AND** no backup files SHALL be retained
- **AND** the component SHALL NOT contain any prohibited patterns
