export type MatchType = 'exact' | 'prefix' | 'regex';

export interface MatchRule {
    type: MatchType;
    pattern: string;
    /** 编译后的正则对象（regex 类型时使用），不对 JSON 暴露 */
    _regex?: RegExp;
}

export interface TerminalRule {
    title: string;
    match: MatchRule;
    color?: string;
    suffix?: string;
    enabled: boolean;
}

export interface TerminalManageConfig {
    version: string;
    rules: TerminalRule[];
}

export const DEFAULT_CONFIG: TerminalManageConfig = {
    version: '1.0',
    rules: [],
};
