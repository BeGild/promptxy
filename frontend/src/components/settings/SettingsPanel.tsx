import React, { useState } from "react";
import {
  Card,
  Text,
  Spacer,
  Button,
  Grid,
  Row,
  Input,
  Divider,
  Badge,
  Loading,
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
        <div style={{ display: "flex", justifyContent: "center", padding: "$8" }}>
          <Loading size="lg">加载配置中...</Loading>
        </div>
      ) : (
        <>
          {/* 统计信息 */}
          <Card variant="bordered" css={{ p: "$4", mb: "$3" }}>
            <Text h4 css={{ mb: "$2" }}>
              📊 统计信息
            </Text>
            <Grid.Container gap={1} css={{ fontSize: "$sm" }}>
              <Grid xs={6}>
                <Text color="$textSecondary">总请求数:</Text>
                <Text b css={{ ml: "$2" }}>
                  {stats?.total || 0}
                </Text>
              </Grid>
              <Grid xs={6}>
                <Text color="$textSecondary">今日请求:</Text>
                <Text b css={{ ml: "$2" }}>
                  {stats?.recent || 0}
                </Text>
              </Grid>
              <Grid xs={12}>
                <Text color="$textSecondary">按客户端:</Text>
                <Row css={{ ml: "$2", gap: "$1", flexWrap: "wrap" }}>
                  {stats?.byClient &&
                    Object.entries(stats.byClient).map(([client, count]) => (
                      <Badge key={client} color="primary" variant="flat" size="sm">
                        {client}: {count}
                      </Badge>
                    ))}
                </Row>
              </Grid>
              <Grid xs={12}>
                <Text color="$textSecondary">数据库路径:</Text>
                <Text
                  size="$xs"
                  css={{ ml: "$2", fontFamily: "monospace", wordBreak: "break-all" }}
                >
                  {stats?.database?.path}
                </Text>
              </Grid>
              <Grid xs={6}>
                <Text color="$textSecondary">数据库大小:</Text>
                <Text b css={{ ml: "$2" }}>
                  {stats?.database?.size ? formatBytes(stats.database.size) : "0 B"}
                </Text>
              </Grid>
              <Grid xs={6}>
                <Text color="$textSecondary">记录数:</Text>
                <Text b css={{ ml: "$2" }}>
                  {stats?.database?.recordCount || 0}
                </Text>
              </Grid>
            </Grid.Container>
          </Card>

          {/* 配置管理 */}
          <Card variant="bordered" css={{ p: "$4", mb: "$3" }}>
            <Text h4 css={{ mb: "$2" }}>
              ⚙️ 配置管理
            </Text>
            <Row gap={1}>
              <Button
                color="primary"
                onPress={handleExport}
                isLoading={exportMutation.isPending}
                auto
              >
                导出配置
              </Button>
              <Button
                color="secondary"
                onPress={handleImport}
                isLoading={importMutation.isPending}
                auto
              >
                导入配置
              </Button>
            </Row>
            <Spacer y={1} />
            <Text size="$sm" color="$textSecondary">
              导出包含所有规则配置，导入会覆盖当前规则。
            </Text>
          </Card>

          {/* 数据清理 */}
          <Card variant="bordered" css={{ p: "$4", mb: "$3" }}>
            <Text h4 css={{ mb: "$2" }}>
              🗑️ 数据清理
            </Text>
            <Grid.Container gap={1}>
              <Grid xs={8}>
                <Input
                  label="保留最近条数"
                  placeholder="100"
                  value={keepCount}
                  onChange={(e) => setKeepCount(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid xs={4} style={{ display: "flex", alignItems: "flex-end" }}>
                <Button
                  color="danger"
                  onPress={handleCleanup}
                  isLoading={cleanupMutation.isPending}
                  fullWidth
                >
                  清理
                </Button>
              </Grid>
            </Grid.Container>
            <Spacer y={1} />
            <Text size="$sm" color="$textSecondary">
              自动清理: 每小时清理一次，保留最近100条（可在配置中修改）
            </Text>
          </Card>

          {/* 关于 */}
          <Card variant="bordered" css={{ p: "$4" }}>
            <Text h4 css={{ mb: "$2" }}>
              ℹ️ 关于
            </Text>
            <Text size="$sm" color="$textSecondary">
              PromptXY v2.0 - 本地HTTP代理规则管理器
            </Text>
            <Spacer y={0.5} />
            <Text size="$sm" color="$textSecondary">
              功能: 规则管理、请求捕获、实时监控、差异对比
            </Text>
            <Spacer y={0.5} />
            <Text size="$sm" color="$textSecondary">
              端口: Gateway(7070) | API(7071)
            </Text>
          </Card>
        </>
      )}
    </div>
  );
};
