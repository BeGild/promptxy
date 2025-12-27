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
        /* 基础间距 */
        xxs: 'var(--spacing-xxs)',
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        xmd: 'var(--spacing-xmd)',
        md: 'var(--spacing-md)',
        '3xs': 'var(--spacing-3xs)',
        xlg: 'var(--spacing-xlg)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        '3xl': 'var(--spacing-3xl)',
        /* 特殊尺寸 - 用于特定场景 */
        h14: 'var(--spacing-h14)',
        w20: 'var(--spacing-w20)',
        w16: 'var(--spacing-w16)',
        wsidebar: 'var(--spacing-wsidebar)',
        /* 额外间距 - 用于特殊场景 */
        '2xs': 'var(--spacing-2xs)',
        d25: 'var(--spacing-d25)',
        /* 小尺寸 - 用于固定宽高 */
        w2: 'var(--spacing-w2)',
        w3: 'var(--spacing-w3)',
        w4: 'var(--spacing-w4)',
        w6: 'var(--spacing-w6)',
        w8: 'var(--spacing-w8)',
        w10: 'var(--spacing-w10)',
        w12: 'var(--spacing-w12)',
        w24: 'var(--spacing-w24)',
        h2: 'var(--spacing-h2)',
        h3: 'var(--spacing-h3)',
        h4: 'var(--spacing-h4)',
        h6: 'var(--spacing-h6)',
        h7: 'var(--spacing-h7)',
        h8: 'var(--spacing-h8)',
        h10: 'var(--spacing-h10)',
        h12: 'var(--spacing-h12)',
        /* px/py 映射 */
        px1: 'var(--spacing-px1)',
        px2: 'var(--spacing-px2)',
        px3: 'var(--spacing-px3)',
        px4: 'var(--spacing-px4)',
        py1: 'var(--spacing-py1)',
        py2: 'var(--spacing-py2)',
        py3: 'var(--spacing-py3)',
        /* gap 映射 */
        gap1: 'var(--spacing-gap1)',
        gap2: 'var(--spacing-gap2)',
        gap3: 'var(--spacing-gap3)',
        /* 特殊小数值 */
        '35': 'var(--spacing-35)',
        '15': 'var(--spacing-15)',
        '25': 'var(--spacing-25)',
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
            background: '#ffffff',
            foreground: '#1a1a1a',
            primary: {
              DEFAULT: '#007acc',
              foreground: '#ffffff',
            },
            success: {
              DEFAULT: '#4ec9b0',
              foreground: '#ffffff',
            },
            warning: {
              DEFAULT: '#ce9178',
              foreground: '#ffffff',
            },
            danger: {
              DEFAULT: '#f48771',
              foreground: '#ffffff',
            },
          },
        },
        dark: {
          colors: {
            background: '#1a1a1a',
            foreground: '#ffffff',
            primary: {
              DEFAULT: '#007acc',
              foreground: '#ffffff',
            },
            success: {
              DEFAULT: '#4ec9b0',
              foreground: '#ffffff',
            },
            warning: {
              DEFAULT: '#ce9178',
              foreground: '#ffffff',
            },
            danger: {
              DEFAULT: '#f48771',
              foreground: '#ffffff',
            },
          },
        },
      },
    }),
  ],
};
