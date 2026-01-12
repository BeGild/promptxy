# Tasks

- [x] 调研现有路由/模型映射与约束校验逻辑（gateway/config/types/frontend UI）
- [x] 更新后端配置 schema：Route 使用 defaultSupplierId，移除 transformer，更新 modelMapping 规则结构
- [x] 更新网关运行时路由选择：按模型规则选择 supplier + 可选 targetModel（空则透传）
- [x] 实现 transformer 自动推断与入口协议约束校验（codex/gemini 不允许跨协议）
- [x] 更新前端路由配置页：默认上游选择 + 规则级 targetSupplierId/targetModel 编辑
- [x] 更新配置迁移脚本：旧 routes/supplierId/transformer/modelMapping 结构 → 新结构（含备份）
- [x] 更新/新增测试：覆盖
  - [x] 未命中规则走 defaultSupplierId
  - [x] 命中规则切换 supplier
  - [x] targetModel 为空时 model 透传
  - [x] codex/gemini 入口跨协议时返回 400
- [x] 更新文档：配置字段与示例
- [x] 运行构建与测试套件确认通过
