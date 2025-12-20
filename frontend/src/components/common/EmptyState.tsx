import React from "react";
import { Button, Card, CardBody } from "@heroui/react";

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
    <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
      <CardBody className="p-8 text-center space-y-4">
        <div className="text-6xl">{icon}</div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {description}
          </p>
        </div>
        {actionText && onAction && (
          <Button
            color="primary"
            onPress={onAction}
            className="shadow-md hover:shadow-lg transition-shadow"
            radius="lg"
            size="lg"
          >
            {actionText}
          </Button>
        )}
      </CardBody>
    </Card>
  );
};
