import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIState {
  // 模态框状态
  isRuleEditorOpen: boolean;
  isRequestDetailOpen: boolean;
  isPreviewOpen: boolean;
  isSettingsOpen: boolean;

  // 当前选中项
  selectedRuleId: string | null;
  selectedRequestId: string | null;

  // UI 状态
  sidebarCollapsed: boolean;
  activeTab: 'rules' | 'requests' | 'preview' | 'supplier-management' | 'route-config' | 'settings';
  theme: 'light' | 'dark' | 'system';

  // 请求侧边栏状态
  isRequestSidebarOpen: boolean;
  sidebarMode: 'original' | 'detail' | 'response' | 'rule';
  sidebarWidth: number; // 记忆用户偏好 (vw)

  // 操作
  openRuleEditor: (ruleId?: string | null) => void;
  closeRuleEditor: () => void;
  openRequestDetail: (requestId: string) => void;
  closeRequestDetail: () => void;
  openPreview: () => void;
  closePreview: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setActiveTab: (tab: 'rules' | 'requests' | 'preview' | 'supplier-management' | 'route-config' | 'settings') => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  reset: () => void;

  // 侧边栏操作
  openRequestSidebar: (requestId: string) => void;
  closeRequestSidebar: () => void;
  setSidebarMode: (mode: 'original' | 'detail' | 'response' | 'rule') => void;
  setSidebarWidth: (width: number) => void;
}

const initialState = {
  isRuleEditorOpen: false,
  isRequestDetailOpen: false,
  isPreviewOpen: false,
  isSettingsOpen: false,
  selectedRuleId: null,
  selectedRequestId: null,
  sidebarCollapsed: true,
  activeTab: 'rules' as const,
  theme: 'system' as const,
  // 侧边栏初始状态
  isRequestSidebarOpen: false,
  sidebarMode: 'detail' as 'original' | 'detail' | 'response' | 'rule',
  sidebarWidth: 40, // 默认 40vw
};

/**
 * 状态更新去重辅助函数
 * 避免设置相同的状态值导致不必要的重新渲染
 */
const createDedupedSet = (set: any, getState: any) => {
  return (partial: any, replace?: boolean) => {
    const currentState = getState();
    const newState = typeof partial === 'function' ? partial(currentState) : partial;

    // 检查是否有实际变化
    const hasChanges = Object.keys(newState).some(key => {
      const currentValue = currentState[key];
      const newValue = newState[key];

      // 处理对象和数组的深度比较
      if (
        typeof currentValue === 'object' &&
        currentValue !== null &&
        typeof newValue === 'object' &&
        newValue !== null
      ) {
        return JSON.stringify(currentValue) !== JSON.stringify(newValue);
      }

      return currentValue !== newValue;
    });

    // 只有当状态真正变化时才更新
    if (hasChanges) {
      set(newState, replace);
    }
  };
};

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => {
        // 使用去重的 set 函数
        const dedupedSet = createDedupedSet(set, get);

        return {
          ...initialState,
          theme: 'system', // 默认跟随系统

          openRuleEditor: (ruleId?: string | null) =>
            dedupedSet({
              isRuleEditorOpen: true,
              selectedRuleId: ruleId || null,
            }),

          closeRuleEditor: () =>
            dedupedSet({
              isRuleEditorOpen: false,
              selectedRuleId: null,
            }),

          openRequestDetail: (requestId: string) =>
            dedupedSet({
              isRequestDetailOpen: true,
              selectedRequestId: requestId,
            }),

          closeRequestDetail: () =>
            dedupedSet({
              isRequestDetailOpen: false,
              selectedRequestId: null,
            }),

          openPreview: () => dedupedSet({ isPreviewOpen: true }),
          closePreview: () => dedupedSet({ isPreviewOpen: false }),

          openSettings: () => dedupedSet({ isSettingsOpen: true }),
          closeSettings: () => dedupedSet({ isSettingsOpen: false }),

          setActiveTab: tab => dedupedSet({ activeTab: tab }),

          setTheme: theme => dedupedSet({ theme }),

          toggleSidebar: () =>
            dedupedSet((state: UIState) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

          // 侧边栏操作
          openRequestSidebar: (requestId: string) =>
            dedupedSet({
              isRequestSidebarOpen: true,
              selectedRequestId: requestId,
              sidebarMode: 'detail',
            }),

          closeRequestSidebar: () =>
            dedupedSet({
              isRequestSidebarOpen: false,
              // 不清除 selectedRequestId，保持选中状态
            }),

          setSidebarMode: (mode: 'original' | 'detail' | 'response' | 'rule') =>
            dedupedSet({ sidebarMode: mode }),

          setSidebarWidth: (width: number) => dedupedSet({ sidebarWidth: width }),

          reset: () => dedupedSet(initialState),
        };
      },
      {
        name: 'promptxy-ui-state',
        partialize: state => ({
          activeTab: state.activeTab,
          theme: state.theme,
        }),
      },
    ),
  ),
);

/**
 * UI Store 的选择器 - 直接使用 Zustand 的选择器
 *
 * Zustand 已经提供了状态订阅和浅比较优化，
 * 额外的 useMemo 反而会增加开销且没有收益。
 */

/**
 * 获取模态框状态的选择器
 */
export const useModalSelector = () =>
  useUIStore(state => ({
    isRuleEditorOpen: state.isRuleEditorOpen,
    isRequestDetailOpen: state.isRequestDetailOpen,
    isPreviewOpen: state.isPreviewOpen,
    isSettingsOpen: state.isSettingsOpen,
  }));

/**
 * 获取选中项状态的选择器
 */
export const useSelectedSelector = () =>
  useUIStore(state => ({
    selectedRuleId: state.selectedRuleId,
    selectedRequestId: state.selectedRequestId,
  }));

/**
 * 获取 UI 状态的选择器
 */
export const useUIStateSelector = () =>
  useUIStore(state => ({
    sidebarCollapsed: state.sidebarCollapsed,
    activeTab: state.activeTab,
    theme: state.theme,
  }));

/**
 * 获取侧边栏状态的选择器
 */
export const useSidebarSelector = () =>
  useUIStore(state => ({
    isRequestSidebarOpen: state.isRequestSidebarOpen,
    sidebarMode: state.sidebarMode,
    sidebarWidth: state.sidebarWidth,
  }));

/**
 * 获取所有 UI 状态的选择器（完整版）
 * 注意：这个选择器返回整个 store，请谨慎使用
 */
export const useFullUISelector = () => useUIStore();
