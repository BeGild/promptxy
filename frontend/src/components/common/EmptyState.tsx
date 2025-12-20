import React from "react";
import { Button, Card, Text } from "@heroui/react";

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
    <Card css={{ p: "$8", textAlign: "center" }}>
      <Text h3 css={{ mb: "$2" }}>
        {icon} {title}
      </Text>
      <Text color="$textSecondary" css={{ mb: "$6" }}>
        {description}
      </Text>
      {actionText && onAction && (
        <Button color="primary" onPress={onAction} auto>
          {actionText}
        </Button>
      )}
    </Card>
  );
};
