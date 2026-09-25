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
		role: 'feature',
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

	test('persists report suppression and atomically claims one terminal notification', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-store-'))
		const path = join(root, 'runtime.sqlite')
		try {
			const first = new RuntimeStore(path)
			first.saveBackgroundChild('T-child', 'T-parent', 'how-explorer')
			first.markBackgroundActive('T-child')
			expect(first.claimBackgroundNotification('T-child')).toBe(true)
			expect(first.claimBackgroundNotification('T-child')).toBe(false)
			first.releaseBackgroundNotification('T-child')
			expect(first.claimBackgroundNotification('T-child')).toBe(true)
			first.close()

			const reopened = new RuntimeStore(path)
			expect(reopened.claimBackgroundNotification('T-child')).toBe(false)
			expect(reopened.listBackgroundChildren()).toEqual([
				{ threadID: 'T-child', parentThreadID: 'T-parent', role: 'how-explorer', active: true, reported: false, notified: true },
			])
			reopened.deleteBackgroundChild('T-child')
			expect(reopened.backgroundChild('T-child')).toBeUndefined()
			reopened.close()
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('durably pairs native background reservations by parent and tool use ID', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-native-background-'))
		const path = join(root, 'runtime.sqlite')
		try {
			const first = new RuntimeStore(path)
			const reservationID = first.saveNativeBackgroundReservation({
				parentThreadID: 'T-parent',
				role: 'why-investigator',
				expectedNative: { executor: 'orb', prompt: 'investigate' },
			})
			expect(first.setNativeBackgroundToolUse('T-other', 'toolu-wrong')).toBe(false)
			expect(first.setNativeBackgroundToolUse(reservationID, 'toolu-native')).toBe(true)
			first.close()

			const reopened = new RuntimeStore(path)
			expect(reopened.listNativeBackgroundReservations()).toEqual([
				{
					reservationID,
					parentThreadID: 'T-parent',
					role: 'why-investigator',
					expectedNative: { executor: 'orb', prompt: 'investigate' },
					toolUseID: 'toolu-native',
				},
			])
			reopened.deleteNativeBackgroundReservation('missing')
			expect(reopened.listNativeBackgroundReservations()).toHaveLength(1)
			reopened.deleteNativeBackgroundReservation(reservationID)
			expect(reopened.listNativeBackgroundReservations()).toEqual([])
			reopened.close()
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('keeps multiple identical native background reservations for one parent independently pairable', () => {
		const store = new RuntimeStore(':memory:')
		const input = { executor: 'orb', prompt: 'same' }
		const first = store.saveNativeBackgroundReservation({ parentThreadID: 'T-parent', role: 'why-investigator', expectedNative: input })
		const second = store.saveNativeBackgroundReservation({ parentThreadID: 'T-parent', role: 'why-investigator', expectedNative: input })
		expect(first).not.toBe(second)
		expect(store.listNativeBackgroundReservations()).toHaveLength(2)
		expect(store.setNativeBackgroundToolUse(first, 'toolu-1')).toBe(true)
		expect(store.setNativeBackgroundToolUse(second, 'toolu-2')).toBe(true)
		expect(store.listNativeBackgroundReservations().map(({ toolUseID }) => toolUseID)).toEqual(['toolu-1', 'toolu-2'])
		store.close()
	})

	test('keeps strict read-only guards across reopen and background cleanup and rejects identity collisions', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-readonly-guard-store-'))
		const path = join(root, 'runtime.sqlite')
		const guard = { threadID: 'T-reader', parentThreadID: 'T-parent', role: 'how-explorer' }
		try {
			const first = new RuntimeStore(path)
			first.saveBackgroundChild('T-reader', 'T-parent', 'how-explorer')
			first.claimReadonlyGuard(guard)
			first.deleteBackgroundChild('T-reader')
			expect(first.listBackgroundChildren()).toEqual([])
			first.close()

			const reopened = new RuntimeStore(path)
			expect(reopened.readonlyGuard('T-reader')).toEqual(guard)
			expect(reopened.readonlyGuard('T-other')).toBeUndefined()
			reopened.claimReadonlyGuard(guard)
			expect(() => reopened.claimReadonlyGuard({ ...guard, role: 'comment-reviewer' })).toThrow(
				'Thread T-reader is already guarded as strict read-only role how-explorer for parent T-parent.',
			)
			expect(() => reopened.claimReadonlyGuard({ ...guard, parentThreadID: 'T-other-parent' })).toThrow(
				'already guarded',
			)
			expect(reopened.readonlyGuard('T-reader')).toEqual(guard)
			reopened.close()
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})
})
