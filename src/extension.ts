import * as vscode from 'vscode';
import { ConfigLoader } from './config/ConfigLoader';
import { ConfigWatcher } from './config/ConfigWatcher';
import { TerminalDecorator } from './terminal/TerminalDecorator';
import { TerminalRule } from './models/Rule';

let configWatcher: ConfigWatcher;
let terminalDecorator: TerminalDecorator;
let configLoader: ConfigLoader;
let currentRules: TerminalRule[] = [];
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    if (!vscode.workspace.getConfiguration('terminalManage').get<boolean>('enable', true)) {
        return;
    }

    outputChannel = vscode.window.createOutputChannel('Terminal Manage', { log: true });
    outputChannel.appendLine('Terminal Manage 插件已激活');

    configLoader = new ConfigLoader();
    terminalDecorator = new TerminalDecorator();
    configWatcher = new ConfigWatcher(300);

    // 状态栏
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'terminalManage.showRules';
    context.subscriptions.push(statusBarItem);
    updateStatusBar();

    // 注册命令
    context.subscriptions.push(
        vscode.commands.registerCommand('terminalManage.reloadConfig', reloadConfig),
        vscode.commands.registerCommand('terminalManage.openConfig', openConfigFile),
        vscode.commands.registerCommand('terminalManage.showRules', showRules),
    );

    // 初始加载
    reloadConfig();

    // 监听终端事件
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal(terminal => {
            terminalDecorator.decorate(terminal, currentRules);
            updateStatusBar();
        }),
        vscode.window.onDidCloseTerminal(terminal => {
            terminalDecorator.onTerminalClose(terminal);
            updateStatusBar();
        }),
        vscode.window.onDidChangeTerminalState(terminal => {
            // 标题变更时重新匹配
            terminalDecorator.decorate(terminal, currentRules);
        }),
    );
}

export function deactivate() {
    configWatcher?.dispose();
    statusBarItem?.dispose();
    outputChannel?.dispose();
}

function reloadConfig() {
    outputChannel.appendLine('加载配置...');

    currentRules = configLoader.load().rules;

    if (configLoader.lastError) {
        outputChannel.appendLine(`⚠️ ${configLoader.lastError}`);
        vscode.window.showWarningMessage(`Terminal Manage: ${configLoader.lastError}`);
    }

    outputChannel.appendLine(`已加载 ${currentRules.length} 条规则`);
    for (const rule of currentRules) {
        outputChannel.appendLine(`  - "${rule.title}" | ${rule.match.type}:${rule.match.pattern} | color=${rule.color || '-'} suffix=${rule.suffix || '-'}`);
    }

    // 重新装饰所有终端
    terminalDecorator.decorateAll(currentRules);
    updateStatusBar();

    // 设置文件监听
    const configPath = configLoader.getActiveConfigPath();
    if (configPath) {
        configWatcher.watch(configPath, reloadConfig);
    } else {
        outputChannel.appendLine('未找到可监听的配置文件');
    }
}

async function openConfigFile() {
    const configPath = configLoader.getActiveConfigPath();
    if (!configPath) {
        vscode.window.showErrorMessage('未找到配置文件。请创建 .vscode/terminal-manage.json');
        return;
    }

    const uri = vscode.Uri.file(configPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
}

function showRules() {
    if (currentRules.length === 0) {
        vscode.window.showInformationMessage('暂无规则。请配置 .vscode/terminal-manage.json');
        return;
    }

    const items = currentRules.map(rule => ({
        label: `$(symbol-color) ${rule.title}`,
        description: `${rule.match.type}: ${rule.match.pattern}`,
        detail: `颜色: ${rule.color || '无'} | 后缀: ${rule.suffix || '无'}`,
    }));

    vscode.window.showQuickPick(items, {
        placeHolder: `共 ${currentRules.length} 条规则`,
        matchOnDescription: true,
    });
}

function updateStatusBar() {
    const terminalCount = vscode.window.terminals.length;
    const decoratedCount = [...terminalDecorator.decoratedTerminals].length;

    let text = `$(terminal) ${decoratedCount}/${terminalCount}`;
    if (currentRules.length > 0) {
        text += ` | $(list-tree) ${currentRules.length}`;
    }

    statusBarItem.text = text;
    statusBarItem.tooltip = `终端管理: ${decoratedCount}/${terminalCount} 个终端已装饰, ${currentRules.length} 条规则`;

    if (configLoader.lastError) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip += `\n⚠️ ${configLoader.lastError}`;
    } else {
        statusBarItem.backgroundColor = undefined;
    }

    statusBarItem.show();
}
