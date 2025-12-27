/**
 * Style Tokens TypeScript 类型定义
 *
 * 提供 CSS 变量的 TypeScript 类型安全访问
 * 所有值都引用 CSS 变量，确保主题切换时自动更新
 */

/**
 * 颜色 Tokens
 */
export interface ColorTokens {
  readonly bg: {
    readonly primary: string;
    readonly secondary: string;
    readonly elevated: string;
    readonly canvas: string;
    readonly overlay: string;
    readonly backdrop: string;
  };
  readonly text: {
    readonly primary: string;
    readonly secondary: string;
    readonly tertiary: string;
    readonly muted: string;
    readonly disabled: string;
    readonly inverse: string;
  };
  readonly brand: {
    readonly primary: string;
    readonly secondary: string;
  };
  readonly status: {
    readonly success: string;
    readonly warning: string;
    readonly error: string;
    readonly info: string;
  };
  readonly border: {
    readonly default: string;
    readonly subtle: string;
    readonly strong: string;
    readonly focused: string;
    readonly error: string;
  };
}

/**
 * 间距 Tokens (基于 4px 网格)
 */
export interface SpacingTokens {
  readonly xs: string;
  readonly sm: string;
  readonly md: string;
  readonly lg: string;
  readonly xl: string;
  readonly '2xl': string;
  readonly '3xl': string;
}

/**
 * 字体 Tokens
 */
export interface TypographyTokens {
  readonly fontSize: {
    readonly xs: string;
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
    readonly xl: string;
    readonly '2xl': string;
    readonly '3xl': string;
    readonly '4xl': string;
  };
  readonly fontWeight: {
    readonly normal: string;
    readonly medium: string;
    readonly semibold: string;
    readonly bold: string;
  };
  readonly lineHeight: {
    readonly tight: string;
    readonly normal: string;
    readonly relaxed: string;
  };
  readonly fontFamily: {
    readonly base: string;
    readonly mono: string;
  };
}

/**
 * 效果 Tokens
 */
export interface EffectTokens {
  readonly radius: {
    readonly xs: string;
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
    readonly xl: string;
    readonly '2xl': string;
    readonly full: string;
  };
  readonly shadow: {
    readonly xs: string;
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
    readonly xl: string;
    readonly '2xl': string;
    readonly dropdown: string;
    readonly modal: string;
    readonly tooltip: string;
  };
}

/**
 * 完整的 Style Tokens
 */
export interface StyleTokens {
  readonly colors: ColorTokens;
  readonly spacing: SpacingTokens;
  readonly typography: TypographyTokens;
  readonly effects: EffectTokens;
}

/**
 * Style Tokens 常量
 *
 * 使用 CSS 变量引用，确保主题切换时自动更新
 *
 * @example
 * ```tsx
 * import { styleTokens } from '@/styles/tokens';
 *
 * <div style={{ padding: styleTokens.spacing.md }}>
 *   内容
 * </div>
 * ```
 */
export const styleTokens: Readonly<StyleTokens> = {
  colors: {
    bg: {
      primary: 'var(--color-bg-primary)',
      secondary: 'var(--color-bg-secondary)',
      elevated: 'var(--color-bg-elevated)',
      canvas: 'var(--color-bg-canvas)',
      overlay: 'var(--color-bg-overlay)',
      backdrop: 'var(--color-bg-backdrop)',
    },
    text: {
      primary: 'var(--color-text-primary)',
      secondary: 'var(--color-text-secondary)',
      tertiary: 'var(--color-text-tertiary)',
      muted: 'var(--color-text-muted)',
      disabled: 'var(--color-text-disabled)',
      inverse: 'var(--color-text-inverse)',
    },
    brand: {
      primary: 'var(--color-brand-primary)',
      secondary: 'var(--color-brand-secondary)',
    },
    status: {
      success: 'var(--color-status-success)',
      warning: 'var(--color-status-warning)',
      error: 'var(--color-status-error)',
      info: 'var(--color-status-info)',
    },
    border: {
      default: 'var(--color-border-default)',
      subtle: 'var(--color-border-subtle)',
      strong: 'var(--color-border-strong)',
      focused: 'var(--color-border-focused)',
      error: 'var(--color-border-error)',
    },
  },
  spacing: {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    '2xl': 'var(--spacing-2xl)',
    '3xl': 'var(--spacing-3xl)',
  },
  typography: {
    fontSize: {
      xs: 'var(--font-size-xs)',
      sm: 'var(--font-size-sm)',
      md: 'var(--font-size-md)',
      lg: 'var(--font-size-lg)',
      xl: 'var(--font-size-xl)',
      '2xl': 'var(--font-size-2xl)',
      '3xl': 'var(--font-size-3xl)',
      '4xl': 'var(--font-size-4xl)',
    },
    fontWeight: {
      normal: 'var(--font-weight-normal)',
      medium: 'var(--font-weight-medium)',
      semibold: 'var(--font-weight-semibold)',
      bold: 'var(--font-weight-bold)',
    },
    lineHeight: {
      tight: 'var(--line-height-tight)',
      normal: 'var(--line-height-normal)',
      relaxed: 'var(--line-height-relaxed)',
    },
    fontFamily: {
      base: 'var(--font-family-base)',
      mono: 'var(--font-family-mono)',
    },
  },
  effects: {
    radius: {
      xs: 'var(--radius-xs)',
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      '2xl': 'var(--radius-2xl)',
      full: 'var(--radius-full)',
    },
    shadow: {
      xs: 'var(--shadow-xs)',
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
      '2xl': 'var(--shadow-2xl)',
      dropdown: 'var(--shadow-dropdown)',
      modal: 'var(--shadow-modal)',
      tooltip: 'var(--shadow-tooltip)',
    },
  },
} as const;
