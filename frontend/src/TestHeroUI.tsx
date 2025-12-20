import React from "react";
import { HeroUIProvider, Button, Card, Navbar, Chip, Badge, Spacer, Divider, CardBody, CardHeader, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";

export default function TestHeroUI() {
  return (
    <HeroUIProvider>
      <div style={{ padding: "20px", fontFamily: "system-ui" }}>
        <h1>HeroUI v2.8.6 测试</h1>

        <Spacer y={1} />

        <Card>
          <CardHeader>
            <h3>卡片标题</h3>
          </CardHeader>
          <CardBody>
            <p>这是一个 Card 组件</p>
            <Button color="primary">主要按钮</Button>
          </CardBody>
        </Card>

        <Spacer y={1} />

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Chip color="primary" variant="flat">测试 Chip</Chip>
          <Badge content="5" color="primary">通知</Badge>
        </div>

        <Spacer y={1} />

        <Navbar>
          <NavbarBrand>
            <p style={{ fontWeight: "bold" }}>测试导航栏</p>
          </NavbarBrand>
          <NavbarContent justify="end">
            <NavbarItem>
              <Button color="primary" size="sm">登录</Button>
            </NavbarItem>
          </NavbarContent>
        </Navbar>

        <Spacer y={1} />
        <Divider />
        <Spacer y={1} />

        <p>✅ 如果能看到这些组件，说明 HeroUI 工作正常</p>
        <p>❌ 如果空白，说明有导入或渲染问题</p>
      </div>
    </HeroUIProvider>
  );
}