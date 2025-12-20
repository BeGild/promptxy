import React, { useState } from "react";
import { Card, Text, Grid, Row, Button, Spacer } from "@heroui/react";
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
      <Card variant="flat" css={{ p: "$4", textAlign: "center" }}>
        <Text color="$textSecondary">无修改 - 请求未被规则改变</Text>
      </Card>
    );
  }

  return (
    <div>
      <Row justify="space-between" align="center" css={{ mb: "$2" }}>
        <Text size="$sm" color="$textSecondary">
          {viewMode === "side-by-side" ? "左右对比视图" : "JSON 格式化视图"}
        </Text>
        <Row gap={1}>
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
        </Row>
      </Row>

      {viewMode === "side-by-side" ? (
        <Grid.Container gap={1}>
          <Grid xs={6}>
            <Card variant="bordered" css={{ height: "400px", overflow: "auto" }}>
              <Card.Header css={{ bg: "$background", borderBottom: "1px solid $border" }}>
                <Text b size="$sm">原始请求</Text>
              </Card.Header>
              <Card.Body css={{ fontFamily: "monospace", fontSize: "$xs", lineHeight: "1.5" }}>
                {left.map((line, i) => (
                  <div key={i} style={{
                    color: line.startsWith("-") ? "var(--heroui-colors-danger)" :
                           line.startsWith("~") ? "var(--heroui-colors-warning)" : "inherit"
                  }}>
                    {line}
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Grid>
          <Grid xs={6}>
            <Card variant="bordered" css={{ height: "400px", overflow: "auto" }}>
              <Card.Header css={{ bg: "$background", borderBottom: "1px solid $border" }}>
                <Text b size="$sm">修改后请求</Text>
              </Card.Header>
              <Card.Body css={{ fontFamily: "monospace", fontSize: "$xs", lineHeight: "1.5" }}>
                {right.map((line, i) => (
                  <div key={i} style={{
                    color: line.startsWith("+") ? "var(--heroui-colors-success)" :
                           line.startsWith("~") ? "var(--heroui-colors-warning)" : "inherit"
                  }}>
                    {line}
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Grid>
        </Grid.Container>
      ) : (
        <Grid.Container gap={1}>
          <Grid xs={6}>
            <Card variant="bordered" css={{ height: "400px", overflow: "auto" }}>
              <Card.Header css={{ bg: "$background", borderBottom: "1px solid $border" }}>
                <Text b size="$sm">原始</Text>
              </Card.Header>
              <Card.Body css={{ fontFamily: "monospace", fontSize: "$xs" }}>
                <pre>{originalStr}</pre>
              </Card.Body>
            </Card>
          </Grid>
          <Grid xs={6}>
            <Card variant="bordered" css={{ height: "400px", overflow: "auto" }}>
              <Card.Header css={{ bg: "$background", borderBottom: "1px solid $border" }}>
                <Text b size="$sm">修改后</Text>
              </Card.Header>
              <Card.Body css={{ fontFamily: "monospace", fontSize: "$xs" }}>
                <pre>{modifiedStr}</pre>
              </Card.Body>
            </Card>
          </Grid>
        </Grid.Container>
      )}
    </div>
  );
};
