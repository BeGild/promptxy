import { heroui } from '@heroui/react';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // HeroUI 组件内部会引用 @heroui/theme/dist 中定义的 Tailwind class
    // 在不同的 npm/安装结构下，@heroui/theme 可能被嵌套安装到依赖的 node_modules 中；
    // 这里同时覆盖顶层与嵌套路径，确保生产/开发环境都能稳定生成所需样式（例如 modal/ripple 的定位相关 class）。
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
    './node_modules/@heroui/**/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* 背景色 */
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          elevated: 'var(--color-bg-elevated)',
          canvas: 'var(--color-bg-canvas)',
          overlay: 'var(--color-bg-overlay)',
          backdrop: 'var(--color-bg-backdrop)',
        },
        /* 文本色 */
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          muted: 'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
        },
        /* 品牌色 */
        brand: {
          primary: 'var(--color-brand-primary)',
          secondary: 'var(--color-brand-secondary)',
        },
        /* 强调色 */
        accent: {
          purple: 'var(--color-accent-purple)',
          pink: 'var(--color-accent-pink)',
        },
        /* 状态色 */
        success: 'var(--color-status-success)',
        warning: 'var(--color-status-warning)',
        error: 'var(--color-status-error)',
        info: 'var(--color-status-info)',
        /* 边框色 */
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
        sans: 'var(--font-family-base)',
        mono: 'var(--font-family-mono)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
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
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        smooth: 'var(--ease-smooth)',
        bounce: 'var(--ease-bounce)',
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: 'var(--color-bg-primary)',
            foreground: 'var(--color-text-primary)',
            primary: {
              DEFAULT: 'var(--color-brand-primary)',
              foreground: 'var(--color-brand-primary-on-primary)',
            },
            success: {
              DEFAULT: 'var(--color-status-success)',
              foreground: '#ffffff',
            },
            warning: {
              DEFAULT: 'var(--color-status-warning)',
              foreground: '#ffffff',
            },
            danger: {
              DEFAULT: 'var(--color-status-error)',
              foreground: '#ffffff',
            },
          },
        },
        dark: {
          colors: {
            background: 'var(--color-bg-primary)',
            foreground: 'var(--color-text-primary)',
            primary: {
              DEFAULT: 'var(--color-brand-primary)',
              foreground: 'var(--color-brand-primary-on-primary)',
            },
            success: {
              DEFAULT: 'var(--color-status-success)',
              foreground: '#ffffff',
            },
            warning: {
              DEFAULT: 'var(--color-status-warning)',
              foreground: '#ffffff',
            },
            danger: {
              DEFAULT: 'var(--color-status-error)',
              foreground: '#ffffff',
            },
          },
        },
      },
    }),
  ],
};
