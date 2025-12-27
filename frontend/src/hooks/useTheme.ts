/**
 * useTheme Hook
 *
 * 提供主题切换功能的封装
 * 支持 light/dark/system 三种主题模式
 */

import { useEffect, useCallback } from 'react';
import { useUIStore } from '@/store';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * 主题 Hook
 *
 * 提供主题相关的操作和状态
 *
 * @example
 * ```tsx
 * const { theme, setTheme, isDark, effectiveTheme } = useTheme();
 *
 * return (
 *   <button onClick={() => setTheme('dark')}>
 *     切换到深色模式
 *   </button>
 * );
 * ```
 */
export const useTheme = () => {
  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);

  /**
   * 获取当前有效的主题（处理 system 模式）
   */
  const getEffectiveTheme = useCallback((): 'light' | 'dark' => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  /**
   * 判断当前是否为深色模式
   */
  const isDark = useCallback((): boolean => {
    return getEffectiveTheme() === 'dark';
  }, [getEffectiveTheme]);

  /**
   * 切换主题（light <-> dark）
   */
  const toggleTheme = useCallback(() => {
    setTheme(isDark() ? 'light' : 'dark');
  }, [setTheme, isDark]);

  /**
   * 应用主题到 DOM
   * 在组件挂载和主题变化时自动执行
   */
  useEffect(() => {
    const root = window.document.documentElement;
    const effectiveTheme = getEffectiveTheme();

    // 移除所有主题类
    root.classList.remove('light', 'dark');

    // 添加有效主题类
    root.classList.add(effectiveTheme);

    // 设置 data-theme 属性（用于 CSS 选择器）
    root.setAttribute('data-theme', effectiveTheme);
  }, [theme, getEffectiveTheme]);

  return {
    /** 当前主题模式设置 */
    theme,
    /** 设置主题模式 */
    setTheme,
    /** 切换主题（light <-> dark） */
    toggleTheme,
    /** 当前有效的主题（处理 system 后的实际主题） */
    effectiveTheme: getEffectiveTheme(),
    /** 是否为深色模式 */
    isDark: isDark(),
  };
};

export default useTheme;
