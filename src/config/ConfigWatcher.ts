import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ConfigWatcher {
    private _watcher: vscode.FileSystemWatcher | null = null;
    private _debounceTimer: NodeJS.Timeout | null = null;
    private _onChangeCallback: (() => void) | null = null;
    private _debounceMs: number;

    constructor(debounceMs: number = 300) {
        this._debounceMs = debounceMs;
    }

    /** 开始监听配置文件变更 */
    watch(configPath: string, onChange: () => void): void {
        this.dispose();

        this._onChangeCallback = onChange;

        // 确保目录存在
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 确保文件存在（方便 watcher 创建）
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify({ version: '1.0', rules: [] }, null, 2), 'utf-8');
        }

        // 使用 VS Code 原生的 FileSystemWatcher
        this._watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(path.dirname(configPath), path.basename(configPath))
        );

        this._watcher.onDidChange(() => this._debounce());
        this._watcher.onDidCreate(() => this._debounce());

        console.log(`[TerminalManage] 正在监听配置文件: ${configPath}`);
    }

    dispose(): void {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        if (this._watcher) {
            this._watcher.dispose();
            this._watcher = null;
        }
    }

    private _debounce(): void {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        this._debounceTimer = setTimeout(() => {
            console.log('[TerminalManage] 检测到配置文件变更，重新加载...');
            this._onChangeCallback?.();
        }, this._debounceMs);
    }
}
