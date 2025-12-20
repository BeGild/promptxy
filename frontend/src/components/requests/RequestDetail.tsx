import React from "react";
import { Card, CardBody, CardHeader, Spacer, Chip, Button, Badge, Spinner } from "@heroui/react";
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
      <div style={{ display: "flex", justifyContent: "center", padding: "32px" }}>
        <Spinner>加载详情中...</Spinner>
      </div>
    );
  }

  if (!request) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div>未找到请求详情</div>
        <Spacer y={1} />
        <Button onPress={onClose}>关闭</Button>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "4px" }}>
      {/* 基本信息 */}
      <Card>
        <CardBody style={{ padding: "16px" }}>
          <h4 style={{ marginBottom: "8px" }}>基本信息</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "14px" }}>
            <div>
              <span style={{ color: "var(--heroui-colors-text-secondary)" }}>ID:</span>
              <span style={{ fontFamily: "monospace", marginLeft: "8px" }}>{request.id}</span>
            </div>
            <div>
              <span style={{ color: "var(--heroui-colors-text-secondary)" }}>时间:</span>
              <span style={{ marginLeft: "8px" }}>{formatTime(request.timestamp)}</span>
            </div>
            <div>
              <span style={{ color: "var(--heroui-colors-text-secondary)" }}>客户端:</span>
              <span style={{ marginLeft: "8px" }}>
                <Badge color="primary" variant="flat" size="sm">
                  {formatClient(request.client)}
                </Badge>
              </span>
            </div>
            <div>
              <span style={{ color: "var(--heroui-colors-text-secondary)" }}>路径:</span>
              <div style={{ fontFamily: "monospace", fontSize: "11px", marginTop: "2px", wordBreak: "break-all" }}>
                {request.path}
              </div>
            </div>
            <div>
              <span style={{ color: "var(--heroui-colors-text-secondary)" }}>方法:</span>
              <span style={{ marginLeft: "8px" }}>
                <Chip size="sm" variant="flat">
                  {request.method}
                </Chip>
              </span>
            </div>
            <div>
              <span style={{ color: "var(--heroui-colors-text-secondary)" }}>状态:</span>
              <span style={{ marginLeft: "8px" }}>
                <Chip
                  size="sm"
                  color={getStatusColor(request.responseStatus)}
                  variant="flat"
                >
                  {request.responseStatus || "N/A"}
                </Chip>
              </span>
            </div>
            <div>
              <span style={{ color: "var(--heroui-colors-text-secondary)" }}>耗时:</span>
              <span style={{ marginLeft: "8px" }}>
                {request.durationMs ? formatDuration(request.durationMs) : "-"}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 匹配规则 */}
      {request.matchedRules && request.matchedRules.length > 0 && (
        <>
          <Spacer y={1} />
          <Card>
            <CardBody style={{ padding: "16px" }}>
              <h4 style={{ marginBottom: "8px" }}>匹配规则</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {request.matchedRules.map((match, i) => (
                  <div key={i} style={{ display: "flex", gap: "4px" }}>
                    <Badge color="secondary" variant="flat" size="sm">
                      {match.ruleId}
                    </Badge>
                    <Badge color="warning" variant="flat" size="sm">
                      {match.opType}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <Spacer y={1} />

      {/* 差异对比 */}
      <h4 style={{ marginBottom: "8px" }}>请求差异</h4>
      <DiffViewer original={request.originalBody} modified={request.modifiedBody} />

      {/* 错误信息 */}
      {request.error && (
        <>
          <Spacer y={1} />
          <Card>
            <CardBody style={{ padding: "16px", background: "var(--heroui-colors-danger-100)" }}>
              <div style={{ fontWeight: "bold", color: "var(--heroui-colors-danger)", marginBottom: "4px" }}>
                错误信息
              </div>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--heroui-colors-danger)" }}>
                {request.error}
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* 响应头 */}
      {request.responseHeaders && (
        <>
          <Spacer y={1} />
          <Card>
            <CardBody style={{ padding: "16px" }}>
              <h5 style={{ marginBottom: "8px" }}>响应头</h5>
              <div style={{ fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(request.responseHeaders, null, 2)}
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <Spacer y={2} />

      {/* 操作按钮 */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        {onReplay && (
          <Button color="warning" variant="flat" onPress={onReplay}>
            重放请求
          </Button>
        )}
        <Button onPress={onClose}>关闭</Button>
      </div>
    </div>
  );
};
