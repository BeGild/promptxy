import React, { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Spacer,
  Button,
  Input,
  Badge,
  Spinner,
} from "@heroui/react";
import { useConfig, useExportConfig, useImportConfig, useDownloadConfig, useUploadConfig } from "@/hooks";
import { useCleanupRequests, useStats } from "@/hooks/useRequests";
import { formatBytes } from "@/utils";

export const SettingsPanel: React.FC = () => {
  const { config, isLoading: configLoading } = useConfig();
  const { stats, isLoading: statsLoading } = useStats();
  const exportMutation = useExportConfig();
  const importMutation = useImportConfig();
  const { download } = useDownloadConfig();
  const { upload } = useUploadConfig();
  const cleanupMutation = useCleanupRequests();

  const [keepCount, setKeepCount] = useState("100");

  // 导出配置
  const handleExport = async () => {
    const conf = await exportMutation.mutateAsync();
    download(conf, `promptxy-config-${Date.now()}.json`);
  };

  // 导入配置
  const handleImport = async () => {
    try {
      const conf = await upload();
      if (conf) {
        await importMutation.mutateAsync(conf);
        alert("配置导入成功！");
      }
    } catch (error: any) {
      alert(`导入失败: ${error?.message}`);
    }
  };

  // 清理数据
  const handleCleanup = async () => {
    const count = parseInt(keepCount) || 100;
    if (confirm(`确定要清理旧数据吗？将保留最近 ${count} 条请求。`)) {
      const result = await cleanupMutation.mutateAsync(count);
      alert(`清理完成！删除了 ${result.deleted} 条记录，剩余 ${result.remaining} 条。`);
    }
  };

  const isLoading = configLoading || statsLoading;

  return (
    <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "4px" }}>
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
          <Spinner>加载配置中...</Spinner>
        </div>
      ) : (
        <>
          {/* 统计信息 */}
          <Card>
            <CardBody style={{ padding: "16px" }}>
              <h4 style={{ marginBottom: "8px" }}>📊 统计信息</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "14px" }}>
                <div>
                  <span style={{ color: "var(--heroui-colors-text-secondary)" }}>总请求数:</span>
                  <b style={{ marginLeft: "8px" }}>{stats?.total || 0}</b>
                </div>
                <div>
                  <span style={{ color: "var(--heroui-colors-text-secondary)" }}>今日请求:</span>
                  <b style={{ marginLeft: "8px" }}>{stats?.recent || 0}</b>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--heroui-colors-text-secondary)" }}>按客户端:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                    {stats?.byClient &&
                      Object.entries(stats.byClient).map(([client, count]) => (
                        <Badge key={client} color="primary" variant="flat" size="sm">
                          {client}: {count}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--heroui-colors-text-secondary)" }}>数据库路径:</span>
                  <div style={{ fontSize: "11px", fontFamily: "monospace", wordBreak: "break-all", marginTop: "2px" }}>
                    {stats?.database?.path}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--heroui-colors-text-secondary)" }}>数据库大小:</span>
                  <b style={{ marginLeft: "8px" }}>
                    {stats?.database?.size ? formatBytes(stats.database.size) : "0 B"}
                  </b>
                </div>
                <div>
                  <span style={{ color: "var(--heroui-colors-text-secondary)" }}>记录数:</span>
                  <b style={{ marginLeft: "8px" }}>{stats?.database?.recordCount || 0}</b>
                </div>
              </div>
            </CardBody>
          </Card>

          <Spacer y={1} />

          {/* 配置管理 */}
          <Card>
            <CardBody style={{ padding: "16px" }}>
              <h4 style={{ marginBottom: "8px" }}>⚙️ 配置管理</h4>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button
                  color="primary"
                  onPress={handleExport}
                >
                  {exportMutation.isPending ? "导出中..." : "导出配置"}
                </Button>
                <Button
                  color="secondary"
                  onPress={handleImport}
                >
                  {importMutation.isPending ? "导入中..." : "导入配置"}
                </Button>
              </div>
              <Spacer y={1} />
              <div style={{ fontSize: "14px", color: "var(--heroui-colors-text-secondary)" }}>
                导出包含所有规则配置，导入会覆盖当前规则。
              </div>
            </CardBody>
          </Card>

          <Spacer y={1} />

          {/* 数据清理 */}
          <Card>
            <CardBody style={{ padding: "16px" }}>
              <h4 style={{ marginBottom: "8px" }}>🗑️ 数据清理</h4>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px" }}>
                <Input
                  label="保留最近条数"
                  placeholder="100"
                  value={keepCount}
                  onChange={(e) => setKeepCount(e.target.value)}
                  style={{ width: "100%" }}
                />
                <Button
                  color="danger"
                  onPress={handleCleanup}
                  style={{ width: "100%" }}
                >
                  {cleanupMutation.isPending ? "清理中..." : "清理"}
                </Button>
              </div>
              <Spacer y={1} />
              <div style={{ fontSize: "14px", color: "var(--heroui-colors-text-secondary)" }}>
                自动清理: 每小时清理一次，保留最近100条（可在配置中修改）
              </div>
            </CardBody>
          </Card>

          <Spacer y={1} />

          {/* 关于 */}
          <Card>
            <CardBody style={{ padding: "16px" }}>
              <h4 style={{ marginBottom: "8px" }}>ℹ️ 关于</h4>
              <div style={{ fontSize: "14px", color: "var(--heroui-colors-text-secondary)", marginBottom: "4px" }}>
                PromptXY v2.0 - 本地HTTP代理规则管理器
              </div>
              <div style={{ fontSize: "14px", color: "var(--heroui-colors-text-secondary)", marginBottom: "4px" }}>
                功能: 规则管理、请求捕获、实时监控、差异对比
              </div>
              <div style={{ fontSize: "14px", color: "var(--heroui-colors-text-secondary)" }}>
                端口: Gateway(7070) | API(7071)
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
};
