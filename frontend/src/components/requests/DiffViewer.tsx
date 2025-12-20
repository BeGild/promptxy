import React, { useState } from "react";
import { Card, CardBody, CardHeader, Button, Spacer } from "@heroui/react";
import { generateJSONDiff, highlightDiff } from "@/utils";

interface DiffViewerProps {
  original: any;
  modified: any;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ original, modified }) => {
  const [viewMode, setViewMode] = useState<"side-by-side" | "json">("side-by-side");

  const diff = generateJSONDiff(original, modified);
  const { left, right } = highlightDiff(diff);

  const originalStr = JSON.stringify(original, null, 2);
  const modifiedStr = JSON.stringify(modified, null, 2);

  // 检查是否有差异
  const hasChanges = diff.some((d) => d.type !== "same");

  if (!hasChanges) {
    return (
      <Card>
        <CardBody style={{ padding: "16px", textAlign: "center", color: "var(--heroui-colors-text-secondary)" }}>
          无修改 - 请求未被规则改变
        </CardBody>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "14px", color: "var(--heroui-colors-text-secondary)" }}>
          {viewMode === "side-by-side" ? "左右对比视图" : "JSON 格式化视图"}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <Button
            size="sm"
            variant={viewMode === "side-by-side" ? "flat" : "light"}
            onPress={() => setViewMode("side-by-side")}
          >
            对比
          </Button>
          <Button
            size="sm"
            variant={viewMode === "json" ? "flat" : "light"}
            onPress={() => setViewMode("json")}
          >
            JSON
          </Button>
        </div>
      </div>

      {viewMode === "side-by-side" ? (
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <Card>
              <CardHeader style={{ background: "var(--heroui-colors-background)", borderBottom: "1px solid var(--heroui-colors-border)" }}>
                <b style={{ fontSize: "14px" }}>原始请求</b>
              </CardHeader>
              <CardBody style={{ fontFamily: "monospace", fontSize: "12px", lineHeight: "1.5", height: "400px", overflow: "auto" }}>
                {left.map((line, i) => (
                  <div key={i} style={{
                    color: line.startsWith("-") ? "var(--heroui-colors-danger)" :
                           line.startsWith("~") ? "var(--heroui-colors-warning)" : "inherit"
                  }}>
                    {line}
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
          <div style={{ flex: 1 }}>
            <Card>
              <CardHeader style={{ background: "var(--heroui-colors-background)", borderBottom: "1px solid var(--heroui-colors-border)" }}>
                <b style={{ fontSize: "14px" }}>修改后请求</b>
              </CardHeader>
              <CardBody style={{ fontFamily: "monospace", fontSize: "12px", lineHeight: "1.5", height: "400px", overflow: "auto" }}>
                {right.map((line, i) => (
                  <div key={i} style={{
                    color: line.startsWith("+") ? "var(--heroui-colors-success)" :
                           line.startsWith("~") ? "var(--heroui-colors-warning)" : "inherit"
                  }}>
                    {line}
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <Card>
              <CardHeader style={{ background: "var(--heroui-colors-background)", borderBottom: "1px solid var(--heroui-colors-border)" }}>
                <b style={{ fontSize: "14px" }}>原始</b>
              </CardHeader>
              <CardBody style={{ fontFamily: "monospace", fontSize: "12px", height: "400px", overflow: "auto" }}>
                <pre>{originalStr}</pre>
              </CardBody>
            </Card>
          </div>
          <div style={{ flex: 1 }}>
            <Card>
              <CardHeader style={{ background: "var(--heroui-colors-background)", borderBottom: "1px solid var(--heroui-colors-border)" }}>
                <b style={{ fontSize: "14px" }}>修改后</b>
              </CardHeader>
              <CardBody style={{ fontFamily: "monospace", fontSize: "12px", height: "400px", overflow: "auto" }}>
                <pre>{modifiedStr}</pre>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
