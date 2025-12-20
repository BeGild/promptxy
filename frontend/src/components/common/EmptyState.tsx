import React from "react";
import { Button, Card } from "@heroui/react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "📭",
  title,
  description,
  actionText,
  onAction,
}) => {
  return (
    <Card style={{ padding: "32px", textAlign: "center" }}>
      <h3 style={{ marginBottom: "8px" }}>
        {icon} {title}
      </h3>
      <p style={{ marginBottom: "24px", color: "var(--heroui-colors-text-secondary)" }}>
        {description}
      </p>
      {actionText && onAction && (
        <Button color="primary" onPress={onAction}>
          {actionText}
        </Button>
      )}
    </Card>
  );
};
