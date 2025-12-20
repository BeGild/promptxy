import React from "react";
import { SettingsPanel } from "@/components/settings";

export const SettingsPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-600 to-gray-800 dark:from-gray-400 dark:to-gray-200 bg-clip-text text-transparent">
            系统设置
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            管理配置、统计数据和系统信息
          </p>
        </div>
      </div>

      {/* 设置面板 */}
      <SettingsPanel />
    </div>
  );
};
