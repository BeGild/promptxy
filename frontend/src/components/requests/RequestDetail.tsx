import React from "react";
import { Card, Text, Spacer, Grid, Chip, Button, Row, Loading, Badge } from "@heroui/react";
import { RequestRecord } from "@/types";
import { formatTime, formatDuration, getStatusColor, formatClient } from "@/utils";
import { DiffViewer } from "./DiffViewer";

interface RequestDetailProps {
  request: RequestRecord | null;
  isLoading: boolean;
  onClose: () => void;
  onReplay?: () => void;
}

export const RequestDetail: React.FC<RequestDetailProps> = ({
  request,
  isLoading,
  onClose,
  onReplay,
}) => {
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "$8" }}>
        <Loading size="lg">加载详情中...</Loading>
      </div>
    );
  }

  if (!request) {
    return (
      <div style={{ padding: "$8", textAlign: "center" }}>
        <Text>未找到请求详情</Text>
        <Spacer y={1} />
        <Button onPress={onClose}>关闭</Button>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "4px" }}>
      {/* 基本信息 */}
      <Card variant="flat" css={{ p: "$4", mb: "$3" }}>
        <Text h4 css={{ mb: "$2" }}>
          基本信息
        </Text>
        <Grid.Container gap={1} css={{ fontSize: "$sm" }}>
          <Grid xs={12} md={6}>
            <Text color="$textSecondary">ID:</Text>
            <Text css={{ fontFamily: "monospace", ml: "$2" }}>{request.id}</Text>
          </Grid>
          <Grid xs={12} md={6}>
            <Text color="$textSecondary">时间:</Text>
            <Text css={{ ml: "$2" }}>{formatTime(request.timestamp)}</Text>
          </Grid>
          <Grid xs={12} md={6}>
            <Text color="$textSecondary">客户端:</Text>
            <Badge color="primary" variant="flat" size="sm" css={{ ml: "$2" }}>
              {formatClient(request.client)}
            </Badge>
          </Grid>
          <Grid xs={12} md={6}>
            <Text color="$textSecondary">路径:</Text>
            <Text css={{ fontFamily: "monospace", ml: "$2", fontSize: "$xs" }}>
              {request.path}
            </Text>
          </Grid>
          <Grid xs={12} md={6}>
            <Text color="$textSecondary">方法:</Text>
            <Chip size="sm" variant="flat" css={{ ml: "$2" }}>
              {request.method}
            </Chip>
          </Grid>
          <Grid xs={12} md={6}>
            <Text color="$textSecondary">状态:</Text>
            <Chip
              size="sm"
              color={getStatusColor(request.responseStatus)}
              variant="flat"
              css={{ ml: "$2" }}
            >
              {request.responseStatus || "N/A"}
            </Chip>
          </Grid>
          <Grid xs={12} md={6}>
            <Text color="$textSecondary">耗时:</Text>
            <Text css={{ ml: "$2" }}>
              {request.durationMs ? formatDuration(request.durationMs) : "-"}
            </Text>
          </Grid>
        </Grid.Container>
      </Card>

      {/* 匹配规则 */}
      {request.matchedRules && request.matchedRules.length > 0 && (
        <>
          <Card variant="flat" css={{ p: "$4", mb: "$3" }}>
            <Text h4 css={{ mb: "$2" }}>
              匹配规则
            </Text>
            <Grid.Container gap={1}>
              {request.matchedRules.map((match, i) => (
                <Grid key={i} xs={12}>
                  <Badge color="secondary" variant="flat" size="sm">
                    {match.ruleId}
                  </Badge>
                  <Badge color="warning" variant="flat" size="sm" css={{ ml: "$2" }}>
                    {match.opType}
                  </Badge>
                </Grid>
              ))}
            </Grid.Container>
          </Card>
          <Spacer y={1} />
        </>
      )}

      {/* 差异对比 */}
      <Text h4 css={{ mb: "$2" }}>
        请求差异
      </Text>
      <DiffViewer original={request.originalBody} modified={request.modifiedBody} />

      {/* 错误信息 */}
      {request.error && (
        <>
          <Spacer y={1} />
          <Card variant="flat" color="danger" css={{ p: "$4" }}>
            <Text color="danger" b>
              错误信息
            </Text>
            <Text color="danger" size="$sm" css={{ fontFamily: "monospace" }}>
              {request.error}
            </Text>
          </Card>
        </>
      )}

      {/* 响应头 */}
      {request.responseHeaders && (
        <>
          <Spacer y={1} />
          <Card variant="flat" css={{ p: "$4" }}>
            <Text h5 css={{ mb: "$2" }}>
              响应头
            </Text>
            <Text size="$sm" css={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(request.responseHeaders, null, 2)}
            </Text>
          </Card>
        </>
      )}

      <Spacer y={2} />

      {/* 操作按钮 */}
      <Row gap={1} justify="flex-end">
        {onReplay && (
          <Button color="warning" variant="flat" onPress={onReplay}>
            重放请求
          </Button>
        )}
        <Button onPress={onClose}>关闭</Button>
      </Row>
    </div>
  );
};
