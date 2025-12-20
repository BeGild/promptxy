import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

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
  activeTab: "rules" | "requests" | "preview" | "settings";

  // 操作
  openRuleEditor: (ruleId?: string | null) => void;
  closeRuleEditor: () => void;
  openRequestDetail: (requestId: string) => void;
  closeRequestDetail: () => void;
  openPreview: () => void;
  closePreview: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setActiveTab: (tab: "rules" | "requests" | "preview" | "settings") => void;
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
  sidebarCollapsed: false,
  activeTab: "rules" as const,
};

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        openRuleEditor: (ruleId?: string | null) =>
          set({
            isRuleEditorOpen: true,
            selectedRuleId: ruleId || null,
          }),

        closeRuleEditor: () =>
          set({
            isRuleEditorOpen: false,
            selectedRuleId: null,
          }),

        openRequestDetail: (requestId: string) =>
          set({
            isRequestDetailOpen: true,
            selectedRequestId: requestId,
          }),

        closeRequestDetail: () =>
          set({
            isRequestDetailOpen: false,
            selectedRequestId: null,
          }),

        openPreview: () => set({ isPreviewOpen: true }),
        closePreview: () => set({ isPreviewOpen: false }),

        openSettings: () => set({ isSettingsOpen: true }),
        closeSettings: () => set({ isSettingsOpen: false }),

        setActiveTab: (tab) => set({ activeTab: tab }),

        toggleSidebar: () =>
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

        reset: () => set(initialState),
      }),
      {
        name: "promptxy-ui-state",
        partialize: (state) => ({
          sidebarCollapsed: state.sidebarCollapsed,
          activeTab: state.activeTab,
        }),
      }
    )
  )
);
