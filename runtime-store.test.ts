import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { RuntimeStore } from './runtime-store'
import type { ImplementationOwner } from './workflow-parity'

function owner(
	resourceKey: string,
	logicalKey: string,
	workspaceKey: string,
	scopePaths: string[],
): ImplementationOwner {
	return {
		state: 'running',
		parentThreadID: 'T-parent',
		role: 'feature-refactoring',
		scope: logicalKey,
		resourceKey,
		logicalKey,
		workspaceKey,
		scopePaths,
		threadID: `T-${resourceKey}`,
	}
}

describe('RuntimeStore', () => {
	test('retains active owners across close and reopen', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-store-'))
		const path = join(root, 'runtime.sqlite')
		const expected = owner('resource-a', 'alpha', 'workspace', ['src/alpha.ts'])
		try {
			const first = new RuntimeStore(path)
			first.claimOwner(expected)
			first.close()

			const reopened = new RuntimeStore(path)
			expect(reopened.listOwners()).toEqual([expected])
			reopened.close()
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('serializes conflicting claims and keeps independent claims', () => {
		const store = new RuntimeStore(':memory:')
		const alpha = owner('resource-a', 'alpha', 'workspace', ['src'])
		const beta = owner('resource-b', 'beta', 'workspace', ['docs'])
		store.claimOwner(alpha)
		store.claimOwner(beta)

		expect(store.listOwners()).toEqual([alpha, beta])
		expect(() =>
			store.claimOwner(owner('resource-c', 'gamma', 'workspace', ['src/file.ts'])),
		).toThrow('conflicts with')
		expect(() =>
			store.claimOwner(owner('resource-d', 'alpha', 'isolated-workspace', ['other.ts'])),
		).toThrow('conflicts with')
		expect(store.listOwners()).toEqual([alpha, beta])
		store.close()
	})

	test('releases only the named resource', () => {
		const store = new RuntimeStore(':memory:')
		const alpha = owner('resource-a', 'alpha', 'workspace', ['src/alpha.ts'])
		const beta = owner('resource-b', 'beta', 'workspace', ['src/beta.ts'])
		store.claimOwner(alpha)
		store.claimOwner(beta)

		store.releaseOwner(alpha.resourceKey)

		expect(store.listOwners()).toEqual([beta])
		store.close()
	})

	test('retains and releases design gates', () => {
		const store = new RuntimeStore(':memory:')
		const run = {
			state: 'judging' as const,
			parentThreadID: 'T-parent',
			panel: 'architect-runners',
			candidateThreadIDs: ['T-candidate'],
			judgeThreadID: 'T-judge',
		}

		store.saveDesignRun(run)
		expect(store.listDesignRuns()).toEqual([run])
		store.releaseDesignRun(run.parentThreadID)
		expect(store.listDesignRuns()).toEqual([])
		store.close()
	})
})
