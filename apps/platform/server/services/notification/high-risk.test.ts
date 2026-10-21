import 'reflect-metadata'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupMemoryDatabase, teardownMemoryDatabase } from '../../../tests/api-helper'
import { queryUnfixedHighRisk } from './high-risk'
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
