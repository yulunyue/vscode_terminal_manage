# VSCode Terminal Manage 插件开发计划

## 项目概述

开发一个轻量级 VSCode 终端管理插件。核心功能：通过本地 JSON 配置文件，根据终端标题自动匹配规则，设置终端的标签颜色和标题后缀，方便快速区分多个终端。

## 核心功能

读取项目（或用户目录）下的一个 JSON 配置文件，其中定义匹配规则列表。当终端打开或标题变更时，遍历规则，按终端标题进行匹配（支持精确匹配、前缀匹配、正则匹配），命中后自动：
1. **设置终端颜色** — 终端标签页图标变为指定颜色
2. **追加标题后缀** — 终端标题后追加标识文字

## 配置文件设计

### 路径查找顺序

1. 工作区根目录：`.vscode/terminal-manage.json`
2. 用户 Home 目录：`~/.config/vscode-terminal-manage/rules.json`
3. VSCode 全局设置中的 `terminalManage.rules` 配置项（可选）

插件启动时，三个来源的规则合并，工作区规则优先级最高。

### JSON Schema

```json
{
  "$schema": "terminal-manage-schema.json",
  "version": "1.0",
  "rules": [
    {
      "title": "规则名称（用于在设置界面显示）",
      "match": {
        "type": "regex",
        "pattern": "^npm run dev"
      },
      "color": "#ff6b35",
      "suffix": " [DEV]",
      "enabled": true
    },
    {
      "title": "SSH 生产服务器",
      "match": {
        "type": "prefix",
        "pattern": "ssh prod"
      },
      "color": "#ff0000",
      "suffix": " [PROD]",
      "enabled": true
    },
    {
      "title": "Docker 容器终端",
      "match": {
        "type": "exact",
        "pattern": "docker-compose up"
      },
      "color": "#2496ed",
      "suffix": " [DOCKER]",
      "enabled": true
    },
    {
      "title": "日志监控",
      "match": {
        "type": "regex",
        "pattern": "^tail -f|^kubectl logs"
      },
      "color": "#00aa00",
      "suffix": " [LOG]",
      "enabled": true
    }
  ]
}
```

### 规则字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 规则名称，便于识别 |
| `match.type` | enum | 匹配方式：`exact` 精确匹配 / `prefix` 前缀匹配 / `regex` 正则匹配 |
| `match.pattern` | string | 匹配模式字符串 |
| `color` | string | 终端标签颜色（Hex 色值，如 `#ff0000`） |
| `suffix` | string | 匹配成功后追加到终端标题的尾缀 |
| `enabled` | boolean | 是否启用该规则，默认 true |

### 匹配逻辑

1. 终端 `name`（即标题）改变时触发匹配检查
2. **`exact`**：`terminalName === pattern`
3. **`prefix`**：`terminalName.startsWith(pattern)`
4. **`regex`**：`new RegExp(pattern).test(terminalName)`
5. 多个规则命中时，取**第一个匹配**的规则生效
6. 首次匹配后锁定，避免标题被 suffix 追加后反复匹配

## 技术架构

```
vscode_terminal_manage/
├── package.json                    # 插件清单
├── tsconfig.json
├── src/
│   ├── extension.ts                # 插件入口
│   │   ├── 激活时：加载配置、监听终端事件
│   │   ├── 注册命令：reloadConfig、openConfigFile
│   │   └── 对已有终端应用规则（恢复场景）
│   ├── config/
│   │   ├── ConfigLoader.ts         # JSON 配置加载与合并
│   │   └── ConfigWatcher.ts        # 监听配置文件变更，热更新
│   ├── matcher/
│   │   └── RuleMatcher.ts          # 规则匹配引擎
│   ├── terminal/
│   │   ├── TerminalDecorator.ts    # 终端装饰器（color + suffix）
│   │   └── TermColorManager.ts     # 终端颜色管理（VSCode 1.68+ 的 color API）
│   ├── models/
│   │   └── Rule.ts                 # 规则数据模型
│   └── utils/
│       └── fs.ts                   # 文件查找工具
├── schemas/
│   └── terminal-manage-schema.json # JSON Schema 定义
├── resources/
│   └── icon.svg
├── test/
│   └── ...
└── docs/
    └── ...
```

### 核心流程

```
终端标题变更 (onDidChangeTerminalState)
        │
        ▼
  RuleMatcher.match(terminalName, rules)
        │
        ├── 未命中 → 结束
        │
        ├── 命中（已锁定且标题未变） → 跳过
        │
        └── 命中（新匹配）
                │
                ├── TerminalDecorator.setColor(color)  → VSCode terminal color API
                └── TerminalDecorator.setSuffix(suffix)→ 修改终端标题


配置文件变更 (fs.watch / FileSystemWatcher)
        │
        ▼
  ConfigLoader.reload()  →  重新解析 JSON
        │
        ▼
  对所有终端重新执行规则匹配  →  颜色/标题即时生效
```

### 三方脚本集成

配置文件即 API。三方脚本只需修改 JSON 文件即可动态控制终端外观：

```bash
# 示例：通过 jq 修改规则，将某个终端标红
jq '.rules[0].color = "#ff0000"' .vscode/terminal-manage.json | sponge .vscode/terminal-manage.json

# 示例：脚本添加一条临时规则
cat >> .vscode/terminal-manage.json <<'EOF'
// 由外部脚本注入（仅示意，实际应使用 jq 等工具维护有效 JSON）
EOF
```

**保障机制：**

1. **文件监听** — 插件启动后通过 `chokidar` / `vscode.workspace.createFileSystemWatcher` 持续监听配置文件，变更后亚秒级热更新
2. **容错处理** — JSON 解析失败时不崩溃，仅在输出面板打警告，保持上次有效规则继续运行
3. **atomic write 兼容** — 脚本若使用「写临时文件 + rename」方式更新，watcher 依然能感知
4. **规则变更后全量重匹配** — 配置文件变更后，对当前所有已打开终端重新执行规则匹配，确保即时生效
5. **debounce** — 短时间内连续写入只触发一次重载，避免频繁刷新

### 关键 API

| API | 用途 | 最低版本 |
|-----|------|----------|
| `vscode.window.terminals` | 获取所有终端 | 1.0 |
| `vscode.window.onDidOpenTerminal` | 监听新终端打开 | 1.0 |
| `vscode.window.onDidCloseTerminal` | 监听终端关闭 | 1.0 |
| `vscode.Terminal.name` | 读取/设置终端标题 | 1.0 |
| `vscode.window.onDidChangeTerminalState` | 监听终端状态变化（含标题变更） | 1.55 |
| `vscode.ThemeColor` / `TerminalOptions.color` | 设置终端标签颜色 | 1.68 |

## 开发路线图

### Phase 1：最小可用原型 (v0.1.0)

- [ ] 初始化项目脚手架（`yo code`）
- [ ] 实现 `ConfigLoader`：读取 JSON 配置文件，解析规则
- [ ] 实现 `ConfigWatcher`：文件监听 + 热更新（`chokidar` 或 VS Code 原生 `FileSystemWatcher`）
- [ ] 实现 `RuleMatcher`：exact/prefix/regex 三种匹配
- [ ] 实现 `extension.ts` 入口：监听终端打开 + 标题变更，应用匹配规则
- [ ] 实现颜色设置、标题 suffix 追加
- [ ] 实现锁机制（避免 suffix 循环匹配）
- [ ] JSON 解析容错：无效 JSON 不崩溃，输出警告，保持上次有效规则

### Phase 2：三方脚本集成增强 (v0.2.0)

- [ ] 实现 debounce 重载（短时间连续写入合并为一次）
- [ ] 实现多源配置合并（工作区 > 用户目录 > 全局设置）
- [ ] 配置文件变更后，对已打开终端全量重匹配
- [ ] 命令：`Terminal Manage: Reload Config` 手动重载（供脚本触发）
- [ ] 命令：`Terminal Manage: Open Config File` 打开当前生效的配置文件

### Phase 3：交互增强 (v0.3.0)

- [ ] 状态栏显示当前匹配规则数 / 错误状态
- [ ] 输出面板日志（规则命中/未命中、配置加载成功/失败）
- [ ] JSON Schema 自动补全支持
- [ ] 配置校验与错误提示

### Phase 4：发布 (v1.0.0)

- [ ] 单元测试
- [ ] 文档（README、使用示例、脚本集成示例）
- [ ] 发布到 VSCode Marketplace

## 命令列表

| 命令 ID | 标题 | 描述 |
|---------|------|------|
| `terminalManage.reloadConfig` | 重载配置 | 重新加载配置文件 |
| `terminalManage.openConfig` | 打开配置文件 | 在编辑器中打开当前生效的配置文件 |
| `terminalManage.showRules` | 显示规则列表 | 在快速选择中展示当前所有规则 |

## 配置项（VSCode Settings）

在 `package.json` 的 `contributes.configuration` 中注册：

```json
{
  "terminalManage.configPath": {
    "type": "string",
    "default": "",
    "description": "自定义配置文件路径（绝对路径，留空则自动查找）"
  },
  "terminalManage.enable": {
    "type": "boolean",
    "default": true,
    "description": "启用/禁用插件"
  }
}
```

## 注意事项

1. 终端颜色通过 `vscode.TerminalOptions.color` 设置，需要 VSCode 1.68+
2. 终端标题多次变更会触发重新匹配，需通过锁定机制避免 suffix 追加导致的循环匹配
3. 配置文件 JSON Schema 自动补全依赖 VSCode 的 `$schema` 字段约定，也可以在 `package.json` 中通过 `jsonValidation` 贡献点注册
4. 考虑 Windows/Linux/macOS 三平台的路径兼容性
