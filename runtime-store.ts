import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import {
	ownedPathsOverlap,
	type DesignRun,
	type ImplementationOwner,
} from './workflow-parity'

type OwnerRow = Readonly<{
	resource_key: string
	owner_json: string
}>

type WakeRegistrationRow = Readonly<{
	amp_key: string
	owner_thread_id: string
	user_key: string
	instruction: string
}>

type WakeEventRow = Readonly<{ state: string }>
type DesignRow = Readonly<{ run_json: string }>

export type WakeRegistration = Readonly<{
	ampKey: string
	ownerThreadID: string
	userKey: string
	instruction: string
}>

export type WakeEventState = 'pending' | 'delivered'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: Record<string, unknown>, field: string): string {
	const candidate = value[field]
	if (typeof candidate !== 'string' || !candidate) {
		throw new Error(`Stored implementation owner is missing ${field}.`)
	}
	return candidate
}

function parseOwner(value: unknown): ImplementationOwner {
	if (!isRecord(value)) throw new Error('Stored implementation owner must be an object.')
	const state = value.state
	if (state !== 'reserving' && state !== 'running') {
		throw new Error('Stored implementation owner has an invalid state.')
	}
	if (
		!Array.isArray(value.scopePaths) ||
		value.scopePaths.length === 0 ||
		!value.scopePaths.every((path) => typeof path === 'string' && path.length > 0)
	) {
		throw new Error('Stored implementation owner has invalid scopePaths.')
	}
	const scopePaths: string[] = []
	for (const path of value.scopePaths) {
		if (typeof path !== 'string' || !path) {
			throw new Error('Stored implementation owner has invalid scopePaths.')
		}
		scopePaths.push(path)
	}
	const common = {
		parentThreadID: requiredString(value, 'parentThreadID'),
		role: requiredString(value, 'role'),
		scope: requiredString(value, 'scope'),
		resourceKey: requiredString(value, 'resourceKey'),
		logicalKey: requiredString(value, 'logicalKey'),
		workspaceKey: requiredString(value, 'workspaceKey'),
		scopePaths,
	}
	if (state === 'running') {
		if (typeof value.threadID !== 'string' || !value.threadID) {
			throw new Error('Running implementation owner is missing threadID.')
		}
		return { state, ...common, threadID: value.threadID }
	}
	const expectedNative = isRecord(value.expectedNative) ? value.expectedNative : undefined
	const nativeToolUseID =
		typeof value.nativeToolUseID === 'string' ? value.nativeToolUseID : undefined
	return { state, ...common, expectedNative, nativeToolUseID }
}

function stringArray(value: unknown, field: string): string[] {
	if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
		throw new Error(`Stored design run has invalid ${field}.`)
	}
	return value
}

function parseDesign(value: unknown): DesignRun {
	if (!isRecord(value)) throw new Error('Stored design run must be an object.')
	const state = value.state
	const parentThreadID = requiredString(value, 'parentThreadID')
	const panel = requiredString(value, 'panel')
	const candidateThreadIDs = stringArray(value.candidateThreadIDs, 'candidateThreadIDs')
	if (state === 'candidates-running') {
		return {
			state,
			parentThreadID,
			panel,
			candidateThreadIDs,
			pendingCandidateThreadIDs: stringArray(
				value.pendingCandidateThreadIDs,
				'pendingCandidateThreadIDs',
			),
			completedCandidateThreadIDs: stringArray(
				value.completedCandidateThreadIDs,
				'completedCandidateThreadIDs',
			),
			failedCandidateThreadIDs: stringArray(
				value.failedCandidateThreadIDs,
				'failedCandidateThreadIDs',
			),
		}
	}
	if (state === 'judge-required') {
		return {
			state,
			parentThreadID,
			panel,
			candidateThreadIDs,
			judgeReserved: value.judgeReserved === true || undefined,
			expectedNative: isRecord(value.expectedNative) ? value.expectedNative : undefined,
			nativeToolUseID:
				typeof value.nativeToolUseID === 'string' ? value.nativeToolUseID : undefined,
		}
	}
	if (state === 'judging') {
		return {
			state,
			parentThreadID,
			panel,
			candidateThreadIDs,
			judgeThreadID: requiredString(value, 'judgeThreadID'),
		}
	}
	throw new Error('Stored design run has an invalid state.')
}

export class RuntimeStore {
	private database: Database

	constructor(path: string) {
		if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
		this.database = new Database(path, { create: true, strict: true })
		this.database.exec('PRAGMA journal_mode = WAL')
		this.database.exec('PRAGMA busy_timeout = 5000')
		this.database.exec(`
			CREATE TABLE IF NOT EXISTS implementation_owners (
				resource_key TEXT PRIMARY KEY,
				logical_key TEXT NOT NULL UNIQUE,
				workspace_key TEXT NOT NULL,
				owner_json TEXT NOT NULL
			)
		`)
		this.database.exec(`
			CREATE TABLE IF NOT EXISTS wake_registrations (
				amp_key TEXT PRIMARY KEY,
				owner_thread_id TEXT NOT NULL,
				user_key TEXT NOT NULL,
				instruction TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS wake_events (
				amp_key TEXT NOT NULL,
				event_id TEXT NOT NULL,
				state TEXT NOT NULL CHECK (state IN ('pending', 'delivered')),
				PRIMARY KEY (amp_key, event_id),
				FOREIGN KEY (amp_key) REFERENCES wake_registrations(amp_key)
			);
			CREATE TABLE IF NOT EXISTS design_runs (
				parent_thread_id TEXT PRIMARY KEY,
				run_json TEXT NOT NULL
			)
		`)
	}

	listOwners(): ImplementationOwner[] {
		const rows = this.database
			.query<OwnerRow, []>(
				'SELECT resource_key, owner_json FROM implementation_owners ORDER BY resource_key',
			)
			.all()
		return rows.map((row) => {
			const owner = parseOwner(JSON.parse(row.owner_json))
			if (owner.resourceKey !== row.resource_key) {
				throw new Error('Stored implementation owner resource key does not match its row.')
			}
			return owner
		})
	}

	claimOwner(owner: ImplementationOwner): void {
		const claim = this.database.transaction((candidate: ImplementationOwner) => {
			for (const existing of this.listOwners()) {
				const overlaps =
					existing.logicalKey === candidate.logicalKey ||
					(existing.workspaceKey === candidate.workspaceKey &&
						existing.scopePaths.some((owned) =>
							candidate.scopePaths.some((requested) =>
								ownedPathsOverlap(owned, requested),
							),
						))
				if (overlaps) {
					const thread =
						existing.state === 'running' ? existing.threadID : 'not started yet'
					throw new Error(
						`Implementation resource ${candidate.resourceKey} conflicts with role ${existing.role}, scope ${existing.scope}, thread ${thread}, resource ${existing.resourceKey}.`,
					)
				}
			}
			this.database
				.query(
					`INSERT INTO implementation_owners
						(resource_key, logical_key, workspace_key, owner_json)
					VALUES (?, ?, ?, ?)`,
				)
				.run(
					candidate.resourceKey,
					candidate.logicalKey,
					candidate.workspaceKey,
					JSON.stringify(candidate),
				)
		})
		claim.immediate(owner)
	}

	saveOwner(owner: ImplementationOwner): void {
		this.database
			.query(
				`UPDATE implementation_owners
			 SET logical_key = ?, workspace_key = ?, owner_json = ?
			 WHERE resource_key = ?`,
			)
			.run(
				owner.logicalKey,
				owner.workspaceKey,
				JSON.stringify(owner),
				owner.resourceKey,
			)
	}

	releaseOwner(resourceKey: string): void {
		this.database
			.query('DELETE FROM implementation_owners WHERE resource_key = ?')
			.run(resourceKey)
	}

	listWakeRegistrations(): WakeRegistration[] {
		return this.database
			.query<WakeRegistrationRow, []>(
				`SELECT amp_key, owner_thread_id, user_key, instruction
				 FROM wake_registrations ORDER BY amp_key`,
			)
			.all()
			.map((row) => ({
				ampKey: row.amp_key,
				ownerThreadID: row.owner_thread_id,
				userKey: row.user_key,
				instruction: row.instruction,
			}))
	}

	saveWakeRegistration(registration: WakeRegistration): void {
		this.database
			.query(
				`INSERT INTO wake_registrations
					(amp_key, owner_thread_id, user_key, instruction)
				 VALUES (?, ?, ?, ?)
				 ON CONFLICT(amp_key) DO UPDATE SET
					owner_thread_id = excluded.owner_thread_id,
					user_key = excluded.user_key,
					instruction = excluded.instruction`,
			)
			.run(
				registration.ampKey,
				registration.ownerThreadID,
				registration.userKey,
				registration.instruction,
			)
	}

	claimWakeEvent(ampKey: string, eventID: string): WakeEventState {
		const claim = this.database.transaction((registrationKey: string, id: string) => {
			this.database
				.query(
					`INSERT OR IGNORE INTO wake_events (amp_key, event_id, state)
					 VALUES (?, ?, 'pending')`,
				)
				.run(registrationKey, id)
			const row = this.database
				.query<WakeEventRow, [string, string]>(
					'SELECT state FROM wake_events WHERE amp_key = ? AND event_id = ?',
				)
				.get(registrationKey, id)
			if (!row || (row.state !== 'pending' && row.state !== 'delivered')) {
				throw new Error('Wake event claim did not produce a valid state.')
			}
			return row.state
		})
		return claim.immediate(ampKey, eventID)
	}

	markWakeDelivered(ampKey: string, eventID: string): void {
		this.database
			.query(
				`UPDATE wake_events SET state = 'delivered'
				 WHERE amp_key = ? AND event_id = ?`,
			)
			.run(ampKey, eventID)
	}

	listDesignRuns(): DesignRun[] {
		return this.database
			.query<DesignRow, []>('SELECT run_json FROM design_runs ORDER BY parent_thread_id')
			.all()
			.map((row) => parseDesign(JSON.parse(row.run_json)))
	}

	saveDesignRun(run: DesignRun): void {
		this.database
			.query(
				`INSERT INTO design_runs (parent_thread_id, run_json)
				 VALUES (?, ?)
				 ON CONFLICT(parent_thread_id) DO UPDATE SET run_json = excluded.run_json`,
			)
			.run(run.parentThreadID, JSON.stringify(run))
	}

	releaseDesignRun(parentThreadID: string): void {
		this.database
			.query('DELETE FROM design_runs WHERE parent_thread_id = ?')
			.run(parentThreadID)
	}

	close(): void {
		this.database.close()
	}
}
