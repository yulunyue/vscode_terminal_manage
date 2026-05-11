import { TerminalRule, MatchRule } from '../models/Rule';

/** 存活的已编译正则，避免反复 new RegExp */
const regexCache = new Map<string, RegExp>();

function getRegex(pattern: string): RegExp {
    let cached = regexCache.get(pattern);
    if (!cached) {
        try {
            cached = new RegExp(pattern);
        } catch {
            console.error(`[TerminalManage] 无效的正则表达式: ${pattern}`);
            return /(?!)/; // 永不匹配
        }
        regexCache.set(pattern, cached);
    }
    return cached;
}

export class RuleMatcher {
    /** 按终端名匹配规则，返回第一个命中且启用的规则 */
    matchOne(terminalName: string, rules: TerminalRule[]): TerminalRule | null {
        for (const rule of rules) {
            if (!rule.enabled) {
                continue;
            }
            if (this._testMatch(terminalName, rule.match)) {
                return rule;
            }
        }
        return null;
    }

    /** 获取规则对应的有效后缀（去除可能递归匹配的部分） */
    getSuffix(rule: TerminalRule): string {
        return rule.suffix || '';
    }

    /** 从终端名中剥离已添加的后缀，还原原始名称用于匹配 */
    stripSuffix(terminalName: string, suffix: string): string {
        if (!suffix) {
            return terminalName;
        }
        // 检查当前名称是否以 suffix 结尾
        if (terminalName.endsWith(suffix)) {
            return terminalName.slice(0, -suffix.length);
        }
        return terminalName;
    }

    /** 测试单个匹配规则 */
    private _testMatch(name: string, match: MatchRule): boolean {
        switch (match.type) {
            case 'exact':
                return name === match.pattern;
            case 'prefix':
                return name.startsWith(match.pattern);
            case 'regex':
                return getRegex(match.pattern).test(name);
            default:
                console.warn(`[TerminalManage] 未知的匹配类型: ${(match as any).type}`);
                return false;
        }
    }
}
