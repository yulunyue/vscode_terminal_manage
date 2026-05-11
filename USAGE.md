# Terminal Manage 使用说明

根据终端标题自动设置终端标签颜色和标题后缀，由 JSON 配置文件驱动，支持第三方脚本动态修改。

## 安装

从 VS Code Marketplace 搜索 `Terminal Manage` 安装，或使用 `.vsix` 文件手动安装：

```bash
code --install-extension vscode-terminal-manage-0.1.0.vsix
```

## 快速开始

在项目根目录的 `.vscode/` 下创建 `terminal-manage.json`：

```json
{
  "version": "1.0",
  "rules": [
    {
      "title": "开发服务",
      "match": { "type": "regex", "pattern": "^npm run dev" },
      "color": "#00ff00",
      "suffix": " [DEV]"
    },
    {
      "title": "生产环境",
      "match": { "type": "prefix", "pattern": "ssh prod" },
      "color": "#ff0000",
      "suffix": " [生产]"
    },
    {
      "title": "日志监控",
      "match": { "type": "regex", "pattern": "tail|log" },
      "color": "#ffaa00",
      "suffix": " [LOG]"
    }
  ]
}
```

保存后扩展自动加载规则，已有终端立即生效。

## 配置文件

### 文件位置（按优先级从高到低）

| 优先级 | 位置 |
|--------|------|
| 最高 | `<工作区>/.vscode/terminal-manage.json` |
| 中等 | VS Code 设置中的 `terminalManage.rules` |
| 最低 | `~/.config/vscode-terminal-manage/terminal-manage.json` |

多源规则按 `title` 合并，同名规则高优先级覆盖低优先级。

### 规则字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 规则名称，也是多源合并的去重键 |
| `match.type` | enum | 是 | 匹配方式：`exact`（精确）, `prefix`（前缀）, `regex`（正则） |
| `match.pattern` | string | 是 | 匹配模式字符串 |
| `color` | string | 否 | 终端标签颜色，6位十六进制（如 `"#ff0000"`） |
| `suffix` | string | 否 | 追加到终端标题的文本 |
| `enabled` | boolean | 否 | 是否启用，默认 `true` |

### 三种匹配方式

- **exact** — 终端名称与 pattern 完全一致时命中
- **prefix** — 终端名称以 pattern 开头时命中
- **regex** — 终端名称匹配完整正则表达式时命中

## VS Code 设置

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `terminalManage.enable` | boolean | `true` | 启用/禁用扩展 |
| `terminalManage.configPath` | string | `""` | 自定义配置文件绝对路径 |

## 命令

在命令面板（`Ctrl+Shift+P`）中输入 `Terminal Manage`：

| 命令 | 说明 |
|------|------|
| `Terminal Manage: 重载配置` | 手动重新加载配置文件 |
| `Terminal Manage: 打开配置文件` | 在编辑器中打开当前配置文件 |
| `Terminal Manage: 显示规则列表` | 弹出下拉列表查看所有已加载规则 |

## 状态栏

状态栏左侧显示 `N/M`，表示 N 个已装饰终端 / M 个总终端。配置错误时状态栏变黄，悬停可查看错误详情。

## 热重载

修改 `terminal-manage.json` 后 300ms 内自动重载，无需手动刷新。第三方脚本可直接修改配置文件，扩展会自动感知。

## 终端生命周期

- 终端打开时自动匹配规则
- 终端标题变化时自动重新匹配
- 终端关闭时自动清理装饰记录
- 重复匹配时自动去除已追加的后缀，防止后缀累积

## 示例：SSH 多环境区分

```json
{
  "version": "1.0",
  "rules": [
    {
      "title": "开发服务器",
      "match": { "type": "prefix", "pattern": "ssh dev" },
      "color": "#3388ff",
      "suffix": " [DEV-SERVER]"
    },
    {
      "title": "测试服务器",
      "match": { "type": "prefix", "pattern": "ssh test" },
      "color": "#ffaa00",
      "suffix": " [TEST]"
    },
    {
      "title": "生产服务器",
      "match": { "type": "prefix", "pattern": "ssh prod" },
      "color": "#ff3333",
      "suffix": " [生产]"
    }
  ]
}
```

## 示例：npm 脚本标识

```json
{
  "version": "1.0",
  "rules": [
    {
      "title": "前端开发",
      "match": { "type": "regex", "pattern": "npm run (dev|start)" },
      "color": "#00cc66",
      "suffix": ""
    },
    {
      "title": "构建任务",
      "match": { "type": "regex", "pattern": "npm run build" },
      "color": "#cc6600",
      "suffix": " [BUILD]"
    },
    {
      "title": "代码检查",
      "match": { "type": "regex", "pattern": "npm run (lint|typecheck|test)" },
      "color": "#9966cc",
      "suffix": " [CHECK]"
    }
  ]
}
```
