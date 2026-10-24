import 'reflect-metadata'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupMemoryDatabase, teardownMemoryDatabase } from '../../../tests/api-helper'
import { queryActiveUnfixedHighRisk, queryUnfixedHighRisk } from './high-risk'
import { ensureDatabaseInitialized } from '#server/database'
import { Repository } from '#server/entities/repository'
import { ScanResult } from '#server/entities/scan-result'
import { ScanRun } from '#server/entities/scan-run'

describe('queryUnfixedHighRisk', () => {
    let runId: string
    let repositoryId: string
    let repositoryName: string
    let seq = 0

    beforeEach(async () => {
        setupMemoryDatabase()
        const ds = await ensureDatabaseInitialized()
        repositoryName = `acme-${++seq}`
        const repo = await ds.getRepository(Repository).save(ds.getRepository(Repository).create({
            owner: repositoryName,
            name: 'app',
        }))
        repositoryId = repo.id
        const run = await ds.getRepository(ScanRun).save(ds.getRepository(ScanRun).create({
            repositoryId: repo.id,
            mode: 'fix',
            severityThreshold: 'high',
            executorKind: 'container',
            status: 'completed',
            summaryJson: JSON.stringify({ alertsFound: 5, alertsTruncated: 3, alertsTruncatedBySeverity: { critical: 1, high: 2 } }),
        }))
        runId = run.id
        const resultRepo = ds.getRepository(ScanResult)
        const now = new Date()
        await resultRepo.save([
            resultRepo.create({ scanRunId: run.id, repositoryId: repo.id, upstreamId: 'dependabot:1', source: 'dependabot', severity: 'critical', packageName: 'a', fixStatus: 'not-tried', firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: run.id, repositoryId: repo.id, upstreamId: 'dependabot:2', source: 'dependabot', severity: 'high', packageName: 'b', fixStatus: 'failed', firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: run.id, repositoryId: repo.id, upstreamId: 'dependabot:3', source: 'dependabot', severity: 'high', packageName: 'c', fixStatus: 'success', firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: run.id, repositoryId: repo.id, upstreamId: 'dependabot:4', source: 'dependabot', severity: 'high', packageName: 'd', fixStatus: 'skipped', supersededAt: now, firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: run.id, repositoryId: repo.id, upstreamId: 'dependabot:5', source: 'dependabot', severity: 'medium', packageName: 'e', fixStatus: 'not-tried', firstSeenAt: now, lastSeenAt: now }),
        ])
    })

    afterEach(() => teardownMemoryDatabase())

    it('只统计未修复 critical/high（排除 success / superseded / 低级别），并聚合截断', async () => {
        const summary = await queryUnfixedHighRisk([runId], 'high')
        expect(summary.rows.map((row) => row.upstreamId).sort()).toEqual(['dependabot:1', 'dependabot:2'])
        expect(summary.counts).toEqual({ critical: 1, high: 1, total: 2 })
        expect(summary.byRepository).toEqual([{ repositoryId, repository: `${repositoryName}/app`, critical: 1, high: 1, total: 2 }])
        expect(summary.truncated).toEqual({ critical: 1, high: 2, total: 3 })
        expect(summary.fingerprint).toHaveLength(16)
    })

    it('阈值 critical 时只统计 critical，截断也只计 critical', async () => {
        const summary = await queryUnfixedHighRisk([runId], 'critical')
        expect(summary.rows.map((row) => row.upstreamId)).toEqual(['dependabot:1'])
        expect(summary.truncated).toEqual({ critical: 1, high: 0, total: 1 })
    })

    it('空 run id / 无匹配 → 空摘要', async () => {
        expect((await queryUnfixedHighRisk([], 'high')).rows).toEqual([])
        expect((await queryUnfixedHighRisk(['none'], 'high')).counts.total).toBe(0)
    })
})

describe('queryActiveUnfixedHighRisk（周报全局快照）', () => {
    beforeEach(async () => {
        setupMemoryDatabase()
        // DataSource 在同一测试文件内复用：先清空前序 describe 的仓库 / 运行 / 结果
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(ScanResult).clear()
        await ds.getRepository(ScanRun).clear()
        await ds.getRepository(Repository).clear()
    })

    afterEach(() => teardownMemoryDatabase())

    const seedRepoWithRun = async (index: number, summary: Record<string, unknown>) => {
        const ds = await ensureDatabaseInitialized()
        const repo = await ds.getRepository(Repository).save(ds.getRepository(Repository).create({
            owner: `digest-${index}`,
            name: 'app',
        }))
        const run = await ds.getRepository(ScanRun).save(ds.getRepository(ScanRun).create({
            repositoryId: repo.id,
            mode: 'fix',
            severityThreshold: 'high',
            executorKind: 'container',
            status: 'completed',
            summaryJson: JSON.stringify(summary),
        }))
        return { ds, repo, run }
    }

    it('跨仓库汇总活跃未修复；截断 / converged 取快照运行汇总', async () => {
        const a = await seedRepoWithRun(1, { alertsConverged: 2, alertsTruncatedBySeverity: { critical: 2, high: 1 } })
        const b = await seedRepoWithRun(2, { alertsConverged: 1, alertsTruncatedBySeverity: { critical: 0, high: 3 } })
        const resultRepo = a.ds.getRepository(ScanResult)
        const now = new Date()
        await resultRepo.save([
            resultRepo.create({ scanRunId: a.run.id, repositoryId: a.repo.id, upstreamId: 'dependabot:1', source: 'dependabot', severity: 'critical', packageName: 'a', fixStatus: 'not-tried', firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: a.run.id, repositoryId: a.repo.id, upstreamId: 'dependabot:2', source: 'dependabot', severity: 'high', packageName: 'b', fixStatus: 'converged', firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: b.run.id, repositoryId: b.repo.id, upstreamId: 'dependabot:3', source: 'dependabot', severity: 'high', packageName: 'c', fixStatus: 'failed', firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: b.run.id, repositoryId: b.repo.id, upstreamId: 'dependabot:4', source: 'dependabot', severity: 'critical', packageName: 'd', fixStatus: 'success', firstSeenAt: now, lastSeenAt: now }),
        ])

        const summary = await queryActiveUnfixedHighRisk('high')
        expect(summary.counts).toEqual({ critical: 1, high: 1, total: 2 })
        expect(summary.byRepository.map((group) => group.repository).sort()).toEqual(['digest-1/app', 'digest-2/app'])
        // converged 来自 run summary 汇总（2 + 1）；明细行里的 converged 行不参与未修复计数
        expect(summary.exempted).toBe(3)
        // 截断来自两个 run 之和：critical 2 + 0，high 1 + 3
        expect(summary.truncated).toEqual({ critical: 2, high: 4, total: 6 })
        expect(summary.fingerprint).toHaveLength(16)
    })

    it('阈值 critical：未修复与截断只统计 critical；converged 为运行级汇总不受阈值影响', async () => {
        const a = await seedRepoWithRun(3, { alertsConverged: 4, alertsTruncatedBySeverity: { critical: 1, high: 5 } })
        const resultRepo = a.ds.getRepository(ScanResult)
        const now = new Date()
        await resultRepo.save([
            resultRepo.create({ scanRunId: a.run.id, repositoryId: a.repo.id, upstreamId: 'dependabot:1', source: 'dependabot', severity: 'critical', packageName: 'a', fixStatus: 'not-tried', firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: a.run.id, repositoryId: a.repo.id, upstreamId: 'dependabot:2', source: 'dependabot', severity: 'high', packageName: 'b', fixStatus: 'not-tried', firstSeenAt: now, lastSeenAt: now }),
            resultRepo.create({ scanRunId: a.run.id, repositoryId: a.repo.id, upstreamId: 'dependabot:3', source: 'dependabot', severity: 'critical', packageName: 'c', fixStatus: 'converged', firstSeenAt: now, lastSeenAt: now }),
        ])

        const summary = await queryActiveUnfixedHighRisk('critical')
        expect(summary.counts).toEqual({ critical: 1, high: 0, total: 1 })
        expect(summary.exempted).toBe(4)
        expect(summary.truncated).toEqual({ critical: 1, high: 0, total: 1 })
    })

    it('全局无活跃告警 → 空明细且不虚构截断 / 豁免', async () => {
        const a = await seedRepoWithRun(4, { alertsConverged: 9, alertsTruncatedBySeverity: { critical: 9, high: 9 } })
        const resultRepo = a.ds.getRepository(ScanResult)
        const now = new Date()
        await resultRepo.save([
            resultRepo.create({ scanRunId: a.run.id, repositoryId: a.repo.id, upstreamId: 'dependabot:1', source: 'dependabot', severity: 'high', packageName: 'a', fixStatus: 'converged', firstSeenAt: now, lastSeenAt: now }),
        ])

        const summary = await queryActiveUnfixedHighRisk('high')
        expect(summary.rows).toEqual([])
        expect(summary.counts.total).toBe(0)
        // 无活跃行 → 没有快照运行可归属截断 / 豁免（不虚构）
        expect(summary.truncated.total).toBe(0)
        expect(summary.exempted).toBe(0)
    })
})
