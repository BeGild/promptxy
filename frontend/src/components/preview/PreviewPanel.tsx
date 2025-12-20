import React, { useState } from "react";
import {
  Textarea,
  Select,
  SelectItem,
  Input,
  Button,
  Spacer,
  Grid,
  Card,
  Text,
  Row,
  Loading,
} from "@heroui/react";
import { usePreviewRule } from "@/hooks";
import { PromptxyClient, PromptxyField } from "@/types";

const CLIENT_OPTIONS = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini" },
];

const FIELD_OPTIONS = [
  { value: "system", label: "System" },
  { value: "instructions", label: "Instructions" },
];

export const PreviewPanel: React.FC = () => {
  const [input, setInput] = useState("");
  const [client, setClient] = useState<PromptxyClient>("claude");
  const [field, setField] = useState<PromptxyField>("system");
  const [model, setModel] = useState("");
  const [path, setPath] = useState("/v1/messages");
  const [method, setMethod] = useState("POST");

  const previewMutation = usePreviewRule();

  const handlePreview = async () => {
    if (!input.trim()) return;

    const body: any = {};
    if (field === "system") {
      body.system = input;
    } else {
      body.instructions = input;
    }
    if (model) body.model = model;

    previewMutation.mutate({
      body,
      client,
      field,
      model,
      path,
      method,
    });
  };

  const result = previewMutation.data;

  return (
    <Grid.Container gap={2}>
      {/* 输入区域 */}
      <Grid xs={12} md={6}>
        <Card variant="bordered" css={{ p: "$4", height: "100%" }}>
          <Text h4 css={{ mb: "$3" }}>
            测试输入
          </Text>

          <Grid.Container gap={1}>
            <Grid xs={12} md={6}>
              <Select
                label="客户端"
                selectedKeys={[client]}
                onChange={(e) => setClient(e.target.value as PromptxyClient)}
                fullWidth
              >
                {CLIENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </Grid>
            <Grid xs={12} md={6}>
              <Select
                label="字段"
                selectedKeys={[field]}
                onChange={(e) => setField(e.target.value as PromptxyField)}
                fullWidth
              >
                {FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </Grid>
            <Grid xs={12}>
              <Input
                label="模型 (可选)"
                placeholder="claude-3-sonnet-20240229"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid xs={12}>
              <Input
                label="路径"
                placeholder="/v1/messages"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid xs={12}>
              <Input
                label="HTTP方法"
                placeholder="POST"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid xs={12}>
              <Textarea
                label="输入文本"
                placeholder="在此输入要测试的文本..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                fullWidth
                minRows={8}
              />
            </Grid>
          </Grid.Container>

          <Spacer y={1} />

          <Row justify="flex-end">
            <Button
              color="primary"
              onPress={handlePreview}
              isDisabled={!input.trim()}
              isLoading={previewMutation.isPending}
            >
              预览效果
            </Button>
          </Row>
        </Card>
      </Grid>

      {/* 输出区域 */}
      <Grid xs={12} md={6}>
        <Card variant="bordered" css={{ p: "$4", height: "100%" }}>
          <Text h4 css={{ mb: "$3" }}>
            预览结果
          </Text>

          {previewMutation.isPending && (
            <div style={{ display: "flex", justifyContent: "center", padding: "$8" }}>
              <Loading>处理中...</Loading>
            </div>
          )}

          {previewMutation.isError && (
            <Card variant="flat" color="danger" css={{ p: "$3" }}>
              <Text color="danger">
                {previewMutation.error?.message || "预览失败"}
              </Text>
            </Card>
          )}

          {result && (
            <>
              <Card variant="flat" css={{ p: "$3", mb: "$2" }}>
                <Text b size="$sm" css={{ mb: "$1" }}>
                  原始文本:
                </Text>
                <Text
                  size="$sm"
                  css={{
                    fontFamily: "monospace",
                    bg: "$background",
                    p: "$2",
                    borderRadius: "$sm",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {typeof result.original === "object"
                    ? JSON.stringify(result.original, null, 2)
                    : String(result.original)}
                </Text>
              </Card>

              <Card variant="flat" css={{ p: "$3", mb: "$2" }}>
                <Text b size="$sm" css={{ mb: "$1" }}>
                  修改后:
                </Text>
                <Text
                  size="$sm"
                  css={{
                    fontFamily: "monospace",
                    bg: "$background",
                    p: "$2",
                    borderRadius: "$sm",
                    whiteSpace: "pre-wrap",
                    color: "$success",
                  }}
                >
                  {typeof result.modified === "object"
                    ? JSON.stringify(result.modified, null, 2)
                    : String(result.modified)}
                </Text>
              </Card>

              {result.matches.length > 0 && (
                <Card variant="flat" css={{ p: "$3" }}>
                  <Text b size="$sm" css={{ mb: "$1" }}>
                    匹配规则:
                  </Text>
                  {result.matches.map((match, i) => (
                    <Text key={i} size="$sm" css={{ fontFamily: "monospace" }}>
                      • {match.ruleId} ({match.opType})
                    </Text>
                  ))}
                </Card>
              )}

              {result.matches.length === 0 && (
                <Card variant="flat" css={{ p: "$3" }}>
                  <Text color="$textSecondary" size="$sm">
                    无规则匹配
                  </Text>
                </Card>
              )}
            </>
          )}
        </Card>
      </Grid>
    </Grid.Container>
  );
};
