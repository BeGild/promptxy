import React from "react";
import { PreviewPanel } from "@/components/preview";

export const PreviewPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            实时预览
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            测试规则效果，实时查看请求修改结果
          </p>
        </div>
      </div>

      {/* 预览面板 */}
      <PreviewPanel />
    </div>
  );
};
