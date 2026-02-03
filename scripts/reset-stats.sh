#!/bin/bash
# 重置统计数据脚本

echo "正在重置 PromptXY 统计数据..."

# 备份现有数据
BACKUP_DIR="$HOME/.local/promptxy/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f "$HOME/.local/promptxy/indexes/stats.json" ]; then
    cp "$HOME/.local/promptxy/indexes/stats.json" "$BACKUP_DIR/"
    echo "已备份 stats.json 到 $BACKUP_DIR"
fi

if [ -f "$HOME/.local/promptxy/indexes/stats-detailed.json" ]; then
    cp "$HOME/.local/promptxy/indexes/stats-detailed.json" "$BACKUP_DIR/"
    echo "已备份 stats-detailed.json 到 $BACKUP_DIR"
fi

# 删除统计缓存文件
rm -f "$HOME/.local/promptxy/indexes/stats.json"
rm -f "$HOME/.local/promptxy/indexes/stats-detailed.json"

echo "统计数据已重置"
echo "请重启 PromptXY 服务以应用更改"
