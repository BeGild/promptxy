import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useMemo } from 'react';

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
  activeTab: 'rules' | 'requests' | 'preview' | 'settings';

  // 操作
  openRuleEditor: (ruleId?: string | null) => void;
  closeRuleEditor: () => void;
  openRequestDetail: (requestId: string) => void;
  closeRequestDetail: () => void;
  openPreview: () => void;
  closePreview: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setActiveTab: (tab: 'rules' | 'requests' | 'preview' | 'settings') => void;
  toggleSidebar: () => void;
  reset: () => void;
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

          toggleSidebar: () =>
            dedupedSet((state: UIState) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

          reset: () => dedupedSet(initialState),
        };
      },
      {
        name: 'promptxy-ui-state',
        partialize: state => ({
          activeTab: state.activeTab,
        }),
      },
    ),
  ),
);

/**
 * UI Store 的 Memoized 选择器 - 避免不必要的重新渲染
 * 使用 useMemo 缓存计算结果，只有当依赖项变化时才重新计算
 */

/**
 * 获取模态框状态的 Memoized 选择器
 */
export const useModalSelector = () => {
  const isRuleEditorOpen = useUIStore(state => state.isRuleEditorOpen);
  const isRequestDetailOpen = useUIStore(state => state.isRequestDetailOpen);
  const isPreviewOpen = useUIStore(state => state.isPreviewOpen);
  const isSettingsOpen = useUIStore(state => state.isSettingsOpen);

  return useMemo(
    () => ({
      isRuleEditorOpen,
      isRequestDetailOpen,
      isPreviewOpen,
      isSettingsOpen,
    }),
    [isRuleEditorOpen, isRequestDetailOpen, isPreviewOpen, isSettingsOpen],
  );
};

/**
 * 获取选中项状态的 Memoized 选择器
 */
export const useSelectedSelector = () => {
  const selectedRuleId = useUIStore(state => state.selectedRuleId);
  const selectedRequestId = useUIStore(state => state.selectedRequestId);

  return useMemo(
    () => ({
      selectedRuleId,
      selectedRequestId,
    }),
    [selectedRuleId, selectedRequestId],
  );
};

/**
 * 获取 UI 状态的 Memoized 选择器
 */
export const useUIStateSelector = () => {
  const sidebarCollapsed = useUIStore(state => state.sidebarCollapsed);
  const activeTab = useUIStore(state => state.activeTab);

  return useMemo(
    () => ({
      sidebarCollapsed,
      activeTab,
    }),
    [sidebarCollapsed, activeTab],
  );
};

/**
 * 获取所有 UI 状态的 Memoized 选择器（完整版）
 */
export const useFullUISelector = () => {
  const state = useUIStore();

  return useMemo(
    () => ({
      ...state,
    }),
    [
      state.isRuleEditorOpen,
      state.isRequestDetailOpen,
      state.isPreviewOpen,
      state.isSettingsOpen,
      state.selectedRuleId,
      state.selectedRequestId,
      state.sidebarCollapsed,
      state.activeTab,
    ],
  );
};
