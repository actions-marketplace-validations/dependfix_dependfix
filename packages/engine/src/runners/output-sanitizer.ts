// output-sanitizer.ts — 子进程输出脱敏的单一事实源。
//
// 验证链与安装失败取证都会把子进程输出写进日志 / 报告；输出可能带 registry 凭据、
// Authorization 头、GitHub PAT 或环境变量赋值。脱敏器独立成纯函数模块，避免
// fixers 层为复用它而加载验证 runner 的完整运行时装配（network-audit / registry-discovery）。

/** 敏感输出匹配规则（顺序固定，后者可覆盖前者的部分结果）。 */
const SECRET_PATTERNS: [RegExp, string][] = [
    // 环境变量赋值（大写下划线变量 = 敏感值）
    [/^(GITHUB_TOKEN|NPM_TOKEN|NODE_AUTH_TOKEN|DOCKER_PASSWORD)=.+/gim, '$1=***'],
    // Token=xxx / secret=xxx 模式
    [/\b(token|secret|password|api[_-]?key)\s*[=:]\s*\S+/gi, '$1=***'],
    // URL 中的认证信息 user:pass@host
    [/\/\/[^@\n]+@/g, '//***@'],
    // npm_config 环境变量（可能包含 registry token）
    [/npm_config_[a-z_]+=\S+/g, 'npm_config_***=***'],
]

/** 对子进程输出做敏感信息脱敏（可安全写入日志 / 报告）。 */
export function sanitizeOutput(output: string): string {
    let result = output
    for (const [pattern, replacement] of SECRET_PATTERNS) {
        result = result.replace(pattern, replacement)
    }
    return result
}
