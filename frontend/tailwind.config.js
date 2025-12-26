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
    extend: {},
  },
  darkMode: 'class',
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: '#1e1e1e',
            foreground: '#e0e0e0',
            primary: {
              50: '#e6f3ff',
              100: '#cce6ff',
              200: '#99ccff',
              300: '#66b3ff',
              400: '#3399ff',
              500: '#007acc',
              600: '#0066b3',
              700: '#005599',
              800: '#004477',
              900: '#003355',
              DEFAULT: '#007acc',
            },
            success: {
              50: '#e6fff9',
              100: '#ccfff2',
              200: '#99ffe6',
              300: '#66ffd9',
              400: '#33ffcc',
              500: '#4ec9b0',
              600: '#3eb39c',
              700: '#2e8d7a',
              800: '#1e6758',
              900: '#0e4136',
              DEFAULT: '#4ec9b0',
            },
          },
        },
      },
    }),
  ],
};
