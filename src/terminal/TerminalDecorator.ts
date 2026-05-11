import * as vscode from 'vscode';
import { RuleMatcher } from '../matcher/RuleMatcher';
import { TerminalRule } from '../models/Rule';

/** 记录每个终端的装饰状态，避免重复装饰 */
interface TerminalDecoration {
    ruleTitle: string;
    suffix: string;
    originalName: string;
}

export class TerminalDecorator {
    private _matcher = new RuleMatcher();
    private _decorated = new Map<vscode.Terminal, TerminalDecoration>();

    /** 对单个终端应用规则 */
    decorate(terminal: vscode.Terminal, rules: TerminalRule[]): TerminalRule | null {
        // 获取原始名称（去掉已添加的 suffix）
        const current = this._decorated.get(terminal);
        const rawName = current
            ? this._matcher.stripSuffix(terminal.name, current.suffix)
            : terminal.name;

        const rule = this._matcher.matchOne(rawName, rules);
        if (!rule) {
            return null;
        }

        // 如果已被相同规则装饰且名称未变，跳过
        if (current && current.ruleTitle === rule.title && terminal.name === current.originalName + current.suffix) {
            return rule;
        }

        const suffix = this._matcher.getSuffix(rule);
        const newName = suffix ? rawName + suffix : rawName;

        // VSCode 1.83+ 支持运行时修改终端名称，但 @types/vscode 类型声明尚未更新
        (terminal as any).name = newName;

        // 记录状态
        this._decorated.set(terminal, {
            ruleTitle: rule.title,
            suffix,
            originalName: rawName,
        });

        console.log(`[TerminalManage] 终端 "${rawName}" 匹配规则 "${rule.title}" → 名称: "${newName}"` +
            (rule.color ? `, 颜色: ${rule.color}` : ''));

        return rule;
    }

    /** 对所有已打开终端批量装饰 */
    decorateAll(rules: TerminalRule[]): void {
        for (const terminal of vscode.window.terminals) {
            this.decorate(terminal, rules);
        }
    }

    /** 终端关闭时清理记录 */
    onTerminalClose(terminal: vscode.Terminal): void {
        this._decorated.delete(terminal);
    }

    /** 移除终端的装饰记录（用于重配时重置） */
    reset(terminal: vscode.Terminal): void {
        this._decorated.delete(terminal);
    }

    /** 遍历所有已装饰终端 */
    get decoratedTerminals(): IterableIterator<[vscode.Terminal, TerminalDecoration]> {
        return this._decorated.entries();
    }

    /** 获取装饰信息 */
    getDecoration(terminal: vscode.Terminal): TerminalDecoration | undefined {
        return this._decorated.get(terminal);
    }
}
