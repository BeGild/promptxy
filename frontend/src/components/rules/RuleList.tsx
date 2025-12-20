import React, { useState } from "react";
import { Input, Spacer, Button, Loading, Grid, Pagination } from "@heroui/react";
import { RuleCard } from "./RuleCard";
import { EmptyState } from "@/components/common";
import { PromptxyRule } from "@/types";

interface RuleListProps {
  rules: PromptxyRule[];
  isLoading: boolean;
  onEdit: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
  onNewRule: () => void;
}

export const RuleList: React.FC<RuleListProps> = ({
  rules,
  isLoading,
  onEdit,
  onDelete,
  onToggle,
  onNewRule,
}) => {
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // 过滤规则
  const filteredRules = rules.filter((rule) => {
    const matchSearch =
      rule.id.toLowerCase().includes(search.toLowerCase()) ||
      (rule.description || "").toLowerCase().includes(search.toLowerCase());
    const matchClient = filterClient === "all" || rule.when.client === filterClient;
    return matchSearch && matchClient;
  });

  // 分页
  const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedRules = filteredRules.slice(startIndex, startIndex + itemsPerPage);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "$8" }}>
        <Loading size="lg">加载规则中...</Loading>
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        title="暂无规则"
        description="创建你的第一条规则来开始修改请求"
        actionText="新建规则"
        onAction={onNewRule}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "$4", marginBottom: "$4" }}>
        <Input
          placeholder="搜索规则ID或描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          css={{ flex: 1 }}
          clearable
        />
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--heroui-colors-border)",
            background: "var(--heroui-colors-background)",
            color: "var(--heroui-colors-foreground)",
          }}
        >
          <option value="all">所有客户端</option>
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
          <option value="gemini">Gemini</option>
        </select>
        <Button color="primary" onPress={onNewRule}>
          新建规则
        </Button>
      </div>

      <Text color="$textSecondary" size="$sm" css={{ mb: "$3" }}>
        共 {filteredRules.length} 条规则
      </Text>

      <Grid.Container gap={1}>
        {paginatedRules.map((rule) => (
          <Grid xs={12} key={rule.id}>
            <RuleCard
              rule={rule}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          </Grid>
        ))}
      </Grid.Container>

      {totalPages > 1 && (
        <>
          <Spacer y={2} />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Pagination
              total={totalPages}
              page={page}
              onChange={setPage}
              color="primary"
            />
          </div>
        </>
      )}
    </div>
  );
};
