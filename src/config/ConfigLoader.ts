import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TerminalManageConfig, TerminalRule, DEFAULT_CONFIG } from '../models/Rule';

export class ConfigLoader {
    private static readonly CONFIG_FILE_NAME = 'terminal-manage.json';
    private static readonly WORKSPACE_CONFIG_DIR = '.vscode';
    private static readonly USER_CONFIG_DIR =
        process.platform === 'win32'
            ? path.join(os.homedir(), 'AppData', 'Local', 'vscode-terminal-manage')
            : path.join(os.homedir(), '.config', 'vscode-terminal-manage');

    private _lastError: string | null = null;

    get lastError(): string | null {
        return this._lastError;
    }

    /** 加载并合并所有来源的配置 */
    load(): TerminalManageConfig {
        this._lastError = null;

        const rules: TerminalRule[] = [];
        const seen = new Set<string>();

        // 1. 用户目录配置（优先级最低）
        const userConfigPath = path.join(ConfigLoader.USER_CONFIG_DIR, ConfigLoader.CONFIG_FILE_NAME);
        this.mergeRules(rules, seen, this.loadFromFile(userConfigPath));

        // 2. 全局 settings 中的规则（中优先级）
        const globalRules = this.loadFromSettings();
        this.mergeRules(rules, seen, globalRules);

        // 3. 工作区配置（优先级最高）
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            // 支持多个工作区文件夹时，取第一个的 .vscode/ 目录
            for (const folder of workspaceFolders) {
                const workspaceConfigPath = path.join(
                    folder.uri.fsPath,
                    ConfigLoader.WORKSPACE_CONFIG_DIR,
                    ConfigLoader.CONFIG_FILE_NAME
                );
                this.mergeRules(rules, seen, this.loadFromFile(workspaceConfigPath));
            }
        }

        return {
            version: '1.0',
            rules,
        };
    }

    /** 获取当前生效的配置文件路径（用于打开和监听） */
    getActiveConfigPath(): string | null {
        // 优先返回工作区配置
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            for (const folder of workspaceFolders) {
                const p = path.join(
                    folder.uri.fsPath,
                    ConfigLoader.WORKSPACE_CONFIG_DIR,
                    ConfigLoader.CONFIG_FILE_NAME
                );
                if (fs.existsSync(p)) {
                    return p;
                }
            }
        }

        // 其次用户目录配置
        const userPath = path.join(ConfigLoader.USER_CONFIG_DIR, ConfigLoader.CONFIG_FILE_NAME);
        if (fs.existsSync(userPath)) {
            return userPath;
        }

        // 返回默认工作区路径（即使不存在）
        if (workspaceFolders && workspaceFolders.length > 0) {
            return path.join(
                workspaceFolders[0].uri.fsPath,
                ConfigLoader.WORKSPACE_CONFIG_DIR,
                ConfigLoader.CONFIG_FILE_NAME
            );
        }

        return null;
    }

    /** 从文件加载配置 */
    private loadFromFile(filePath: string): TerminalRule[] {
        try {
            if (!fs.existsSync(filePath)) {
                return [];
            }

            const raw = fs.readFileSync(filePath, 'utf-8');
            const config = JSON.parse(raw) as TerminalManageConfig;

            if (!config.rules || !Array.isArray(config.rules)) {
                this._lastError = `配置文件 ${filePath} 缺少 rules 字段`;
                return [];
            }

            return config.rules.filter(r => {
                if (!r.match || !r.match.type || !r.match.pattern) {
                    console.warn(`[TerminalManage] 规则 "${r.title}" 缺少 match 字段，已跳过`);
                    return false;
                }
                return true;
            });
        } catch (e: any) {
            this._lastError = `解析配置文件失败 (${filePath}): ${e.message}`;
            console.error(`[TerminalManage] ${this._lastError}`);
            return [];
        }
    }

    /** 从 VSCode 全局设置中加载规则 */
    private loadFromSettings(): TerminalRule[] {
        try {
            const config = vscode.workspace.getConfiguration('terminalManage');
            const settingsRules = config.get<TerminalRule[]>('rules');
            return Array.isArray(settingsRules) ? settingsRules : [];
        } catch {
            return [];
        }
    }

    /** 合并规则，按 title 去重（后加载的覆盖先加载的） */
    private mergeRules(target: TerminalRule[], seen: Set<string>, source: TerminalRule[]): void {
        for (const rule of source) {
            if (!rule.enabled) {
                continue;
            }
            if (seen.has(rule.title)) {
                continue;
            }
            seen.add(rule.title);
            target.push(rule);
        }
    }
}
