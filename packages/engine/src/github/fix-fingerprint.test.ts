import { describe, expect, it } from 'vitest'
import {
    ATTEMPT_KEY_LENGTH,
    FAILURE_SIGNATURE_INPUT_LIMIT,
    collectAttemptMarkers,
    computeAttemptKey,
    computeFailureSignature,
    formatAttemptMarker,
    parseAttemptMarkers,
    type AttemptKeyInput,
} from './fix-fingerprint'

const BASE_INPUT: AttemptKeyInput = {
    source: 'dependabot',
    packageName: 'lodash',
    targetVersion: '4.17.21',
    planStrategy: 'direct-upgrade',
}

describe('computeAttemptKey', () => {
    it('同一输入稳定且为 16 位 hex', () => {
        const first = computeAttemptKey(BASE_INPUT)
        expect(first).toBe(computeAttemptKey({ ...BASE_INPUT }))
        expect(first).toMatch(/^[0-9a-f]{16}$/)
        expect(first).toHaveLength(ATTEMPT_KEY_LENGTH)
    })

    it('目标版本 / 策略 / 包名 / 源任一变化即改变键', () => {
        const base = computeAttemptKey(BASE_INPUT)
        expect(computeAttemptKey({ ...BASE_INPUT, targetVersion: '4.17.20' })).not.toBe(base)
        expect(computeAttemptKey({ ...BASE_INPUT, planStrategy: 'override' })).not.toBe(base)
        expect(computeAttemptKey({ ...BASE_INPUT, packageName: 'express' })).not.toBe(base)
        expect(computeAttemptKey({ ...BASE_INPUT, source: 'pnpm-audit' })).not.toBe(base)
    })

    it('字段拼接不产生歧义（分隔符参与摘要）', () => {
        // 拼接歧义防护：`a` + `bc` 与 `ab` + `c` 不得同键
        const left = computeAttemptKey({ ...BASE_INPUT, packageName: 'ab', targetVersion: 'c' })
        const right = computeAttemptKey({ ...BASE_INPUT, packageName: 'a', targetVersion: 'bc' })
        expect(left).not.toBe(right)
    })
})

describe('computeFailureSignature', () => {
    it('空白差异归一化为同一签名', () => {
        expect(computeFailureSignature('pnpm test', 'Error:\n  FAIL  foo'))
            .toBe(computeFailureSignature('pnpm   test', 'Error: FAIL foo'))
    })

    it('超出 2KB 的尾部内容不参与签名', () => {
        const head = 'E'.repeat(FAILURE_SIGNATURE_INPUT_LIMIT)
        expect(computeFailureSignature('pnpm test', `${head}tail-a`))
            .toBe(computeFailureSignature('pnpm test', `${head}tail-b`))
    })

    it('不同失败文本产生不同签名', () => {
        expect(computeFailureSignature('pnpm test', 'FAIL a')).not.toBe(computeFailureSignature('pnpm test', 'FAIL b'))
        expect(computeFailureSignature('pnpm test', 'FAIL a')).toMatch(/^[0-9a-f]{8}$/)
    })
})

describe('formatAttemptMarker / parseAttemptMarkers', () => {
    it('往返解析最小标记（n / 未知结果）', () => {
        const marker = { key: computeAttemptKey(BASE_INPUT), n: 2 }
        const body = `# PR\n\n${formatAttemptMarker(marker)}\n`
        expect(parseAttemptMarkers(body)).toEqual([marker])
    })

    it('往返解析带失败签名与结果的标记', () => {
        const marker = {
            key: computeAttemptKey(BASE_INPUT),
            n: 3,
            failureSignature: computeFailureSignature('pnpm test', 'FAIL'),
            failed: 1 as const,
        }
        expect(parseAttemptMarkers(`body\n${formatAttemptMarker(marker)}`)).toEqual([marker])
    })

    it('同一正文的多条标记全部解析（一次修复覆盖多条告警）', () => {
        const first = { key: computeAttemptKey(BASE_INPUT), n: 1 }
        const second = { key: computeAttemptKey({ ...BASE_INPUT, packageName: 'express' }), n: 2 }
        const body = `${formatAttemptMarker(first)}\n${formatAttemptMarker(second)}\n# body`
        expect(parseAttemptMarkers(body)).toEqual([first, second])
    })

    it('缺省正文 / 无标记 → 空数组（fail-open）', () => {
        expect(parseAttemptMarkers(undefined)).toEqual([])
        expect(parseAttemptMarkers(null)).toEqual([])
        expect(parseAttemptMarkers('')).toEqual([])
        expect(parseAttemptMarkers('# no markers here')).toEqual([])
    })

    it('非法键 / 非法序数 / 人工改写 → 丢弃该条而不报错', () => {
        const body = [
            '<!-- dependfix:attempt key=not-a-key n=2 -->',
            `<!-- dependfix:attempt key=${computeAttemptKey(BASE_INPUT)} n=two -->`,
            `<!-- dependfix:attempt key=${computeAttemptKey(BASE_INPUT)} n=0 -->`,
            '<!-- dependfix:attempt n=2 -->',
            `<!-- dependfix:attempt key=${computeAttemptKey(BASE_INPUT)} n=4 -->`,
        ].join('\n')
        expect(parseAttemptMarkers(body)).toEqual([{ key: computeAttemptKey(BASE_INPUT), n: 4 }])
    })

    it('非法签名 / 非法结果被忽略，其余字段仍生效', () => {
        const key = computeAttemptKey(BASE_INPUT)
        const parsed = parseAttemptMarkers(`<!-- dependfix:attempt key=${key} n=2 fp=zzz failed=9 -->`)
        expect(parsed).toEqual([{ key, n: 2 }])
    })

    it('序数只接受十进制 1-9999（1e3 / 0x10 / 超上界一律丢弃）', () => {
        const key = computeAttemptKey(BASE_INPUT)
        const body = ['1e3', '0x10', '12345', '-1', '3'].map((n) => `<!-- dependfix:attempt key=${key} n=${n} -->`).join('\n')
        expect(parseAttemptMarkers(body)).toEqual([{ key, n: 3 }])
    })

    it('同一标记内重复属性按 last-wins', () => {
        const key = computeAttemptKey(BASE_INPUT)
        expect(parseAttemptMarkers(`<!-- dependfix:attempt key=${key} n=2 n=3 -->`)).toEqual([{ key, n: 3 }])
    })

    it('kind 前后的空白容错与原正则一致（换行 / 制表符）', () => {
        const key = computeAttemptKey(BASE_INPUT)
        const body = `<!--\n\tdependfix:attempt \t key=${key} n=2 -->`
        expect(parseAttemptMarkers(body)).toEqual([{ key, n: 2 }])
    })

    it('kind 后缺空白不算标记（`\\s+` 语义）', () => {
        const key = computeAttemptKey(BASE_INPUT)
        expect(parseAttemptMarkers(`<!-- dependfix:attemptkey=${key} n=1 -->`)).toEqual([])
    })

    it('属性区不跨 `>`：含 `>` 的标记整体丢弃，后续标记仍解析', () => {
        const key = computeAttemptKey(BASE_INPUT)
        const body = [
            `<!-- dependfix:attempt key=${key} n=1 a>b -->`,
            `<!-- dependfix:attempt key=${key} n=2 -->`,
        ].join('\n')
        expect(parseAttemptMarkers(body)).toEqual([{ key, n: 2 }])
    })

    it('无关 HTML 注释后仍能重同步到合法标记', () => {
        const key = computeAttemptKey(BASE_INPUT)
        const body = [
            '<!-- dependfix:pr-check -->',
            '<!-- other comment -->',
            `<!-- dependfix:attempt key=${key} n=1 -->`,
        ].join('\n')
        expect(parseAttemptMarkers(body)).toEqual([{ key, n: 1 }])
    })

    it('属性区起点即 `>` 时丢弃该条（不产生空属性标记）', () => {
        const key = computeAttemptKey(BASE_INPUT)
        const body = [
            `<!-- dependfix:attempt >${key} n=1 -->`,
            `<!-- dependfix:attempt key=${key} n=2 -->`,
        ].join('\n')
        expect(parseAttemptMarkers(body)).toEqual([{ key, n: 2 }])
    })
})

describe('parseAttemptMarkers 恶意输入（线性扫描）', () => {
    it('大量制表符 / 未闭合标记在 100KB 级仍线性（单次 < 50ms）', () => {
        // CodeQL js/polynomial-redos 的原始见证：kind 后接大量制表符、正文无 `-->`
        const bodies = [
            `<!--dependfix:attempt${'\t'.repeat(100_000)}`,
            `<!--dependfix:attempt\t${'\t\t'.repeat(50_000)}`,
            '<!--dependfix:attempt key=aaaaaaaaaaaaaaaa n=1 '.repeat(2_500),
        ]
        for (const body of bodies) {
            expect(body.length).toBeGreaterThanOrEqual(100_000)
            const startedAt = performance.now()
            expect(parseAttemptMarkers(body)).toEqual([])
            expect(performance.now() - startedAt).toBeLessThan(50)
        }
    })

    it('重复合法标记全部解析（扫描不跳条）', () => {
        const key = computeAttemptKey(BASE_INPUT)
        const body = `<!-- dependfix:attempt key=${key} n=1 -->\n`.repeat(1_000)
        expect(parseAttemptMarkers(body)).toHaveLength(1_000)
    })
})

describe('collectAttemptMarkers', () => {
    it('跳过记录不写标记，同键取最大序号', () => {
        const markers = collectAttemptMarkers([
            { repository: 'owner/repo', packageName: 'lodash', key: 'aaaaaaaaaaaaaaaa', attempt: 1, status: 'attempt' },
            { repository: 'owner/repo', packageName: 'lodash', key: 'aaaaaaaaaaaaaaaa', attempt: 2, status: 'attempt' },
            { repository: 'owner/repo', packageName: 'express', key: 'bbbbbbbbbbbbbbbb', attempt: 3, status: 'skipped' },
            { repository: 'owner/repo', packageName: 'vite', key: 'cccccccccccccccc', attempt: 3, status: 'forced' },
        ])
        expect(markers).toEqual([
            { key: 'aaaaaaaaaaaaaaaa', n: 2 },
            { key: 'cccccccccccccccc', n: 3 },
        ])
    })

    it('空记录 → 空标记集', () => {
        expect(collectAttemptMarkers([])).toEqual([])
    })

    it('给定执行动作时只写真正执行过的键（计划记录未执行 → 不消耗额度）', () => {
        const records = [
            { repository: 'owner/repo', packageName: 'lodash', key: 'aaaaaaaaaaaaaaaa', attempt: 1, status: 'attempt' as const },
            { repository: 'owner/repo', packageName: 'express', key: 'bbbbbbbbbbbbbbbb', attempt: 2, status: 'attempt' as const },
        ]
        const executed = [
            { type: 'dependency-upgrade' as const, repository: 'owner/repo', target: 'lodash', noOp: false },
            // noOp 动作不算执行（如 overrides 保护名单命中）
            { type: 'dependency-upgrade' as const, repository: 'owner/repo', target: 'express', noOp: true },
        ]
        expect(collectAttemptMarkers(records, executed)).toEqual([{ key: 'aaaaaaaaaaaaaaaa', n: 1 }])
        // 不传执行集时按计划记录全量写入（既有行为）
        expect(collectAttemptMarkers(records)).toHaveLength(2)
    })
})
