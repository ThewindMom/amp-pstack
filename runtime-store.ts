import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'
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
type BackgroundChildRow = Readonly<{
	thread_id: string
	parent_thread_id: string
	role: string
	active: number
	reported: number
	notified: number
}>
type NativeBackgroundReservationRow = Readonly<{
	reservation_id: string
	parent_thread_id: string
	role: string
	expected_json: string
	tool_use_id: string | null
}>

export type BackgroundChild = Readonly<{
	threadID: string
	parentThreadID: string
	role: string
	active: boolean
	reported: boolean
	notified: boolean
}>

export type NativeBackgroundReservation = Readonly<{
	reservationID: string
	parentThreadID: string
	role: string
	expectedNative: Record<string, unknown>
	toolUseID?: string
}>

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
			;
			CREATE TABLE IF NOT EXISTS background_children (
				thread_id TEXT PRIMARY KEY,
				parent_thread_id TEXT NOT NULL,
				role TEXT NOT NULL DEFAULT 'background',
				active INTEGER NOT NULL DEFAULT 0,
				reported INTEGER NOT NULL DEFAULT 0,
				notified INTEGER NOT NULL DEFAULT 0
			)
			;
			CREATE TABLE IF NOT EXISTS native_background_reservations (
				reservation_id TEXT PRIMARY KEY,
				parent_thread_id TEXT NOT NULL,
				role TEXT NOT NULL,
				expected_json TEXT NOT NULL,
				tool_use_id TEXT
			)
		`)
		const reservationColumns = this.database
			.query<Readonly<{ name: string }>, []>('PRAGMA table_info(native_background_reservations)')
			.all()
		if (!reservationColumns.some((column) => column.name === 'reservation_id')) {
			this.database.exec(`
				ALTER TABLE native_background_reservations RENAME TO native_background_reservations_legacy;
				CREATE TABLE native_background_reservations (
					reservation_id TEXT PRIMARY KEY,
					parent_thread_id TEXT NOT NULL,
					role TEXT NOT NULL,
					expected_json TEXT NOT NULL,
					tool_use_id TEXT
				);
				INSERT INTO native_background_reservations
					(reservation_id, parent_thread_id, role, expected_json, tool_use_id)
				SELECT 'legacy:' || parent_thread_id, parent_thread_id, role, expected_json, tool_use_id
				FROM native_background_reservations_legacy;
				DROP TABLE native_background_reservations_legacy;
			`)
		}
		const backgroundColumns = this.database
			.query<Readonly<{ name: string }>, []>('PRAGMA table_info(background_children)')
			.all()
		if (!backgroundColumns.some((column) => column.name === 'active')) {
			this.database.exec('ALTER TABLE background_children ADD COLUMN active INTEGER NOT NULL DEFAULT 0')
		}
		if (!backgroundColumns.some((column) => column.name === 'role')) {
			this.database.exec("ALTER TABLE background_children ADD COLUMN role TEXT NOT NULL DEFAULT 'background'")
		}
	}

	listNativeBackgroundReservations(): NativeBackgroundReservation[] {
		return this.database
			.query<NativeBackgroundReservationRow, []>(
				'SELECT reservation_id, parent_thread_id, role, expected_json, tool_use_id FROM native_background_reservations ORDER BY rowid',
			)
			.all()
			.map((row) => {
				const expectedNative: unknown = JSON.parse(row.expected_json)
				if (!isRecord(expectedNative)) throw new Error('Stored native background input must be an object.')
				return {
					reservationID: row.reservation_id,
					parentThreadID: row.parent_thread_id,
					role: row.role,
					expectedNative,
					toolUseID: row.tool_use_id ?? undefined,
				}
			})
	}

	saveNativeBackgroundReservation(reservation: Omit<NativeBackgroundReservation, 'reservationID'>): string {
		const reservationID = randomUUID()
		this.database
			.query(
				`INSERT INTO native_background_reservations
					(reservation_id, parent_thread_id, role, expected_json, tool_use_id)
				 VALUES (?, ?, ?, ?, ?)`,
			)
			.run(
				reservationID,
				reservation.parentThreadID,
				reservation.role,
				JSON.stringify(reservation.expectedNative),
				reservation.toolUseID ?? null,
			)
		return reservationID
	}

	setNativeBackgroundToolUse(reservationID: string, toolUseID: string): boolean {
		const result = this.database
			.query(
				'UPDATE native_background_reservations SET tool_use_id = ? WHERE reservation_id = ? AND tool_use_id IS NULL',
			)
			.run(toolUseID, reservationID)
		return result.changes === 1
	}

	deleteNativeBackgroundReservation(reservationID: string): void {
		this.database
			.query('DELETE FROM native_background_reservations WHERE reservation_id = ?')
			.run(reservationID)
	}

	listBackgroundChildren(): BackgroundChild[] {
		return this.database
			.query<BackgroundChildRow, []>(
				'SELECT thread_id, parent_thread_id, role, active, reported, notified FROM background_children ORDER BY thread_id',
			)
			.all()
			.map((row) => ({
				threadID: row.thread_id,
				parentThreadID: row.parent_thread_id,
				role: row.role,
				active: row.active === 1,
				reported: row.reported === 1,
				notified: row.notified === 1,
			}))
	}

	markBackgroundActive(threadID: string): void {
		this.database.query('UPDATE background_children SET active = 1 WHERE thread_id = ?').run(threadID)
	}

	backgroundChild(threadID: string): BackgroundChild | undefined {
		return this.listBackgroundChildren().find((child) => child.threadID === threadID)
	}

	saveBackgroundChild(threadID: string, parentThreadID: string, role: string): void {
		this.database
			.query('INSERT OR IGNORE INTO background_children (thread_id, parent_thread_id, role) VALUES (?, ?, ?)')
			.run(threadID, parentThreadID, role)
	}

	markBackgroundReported(threadID: string, parentThreadID: string): void {
		this.database
			.query(
				'UPDATE background_children SET reported = 1 WHERE thread_id = ? AND parent_thread_id = ?',
			)
			.run(threadID, parentThreadID)
	}

	deleteBackgroundChild(threadID: string): void {
		this.database.query('DELETE FROM background_children WHERE thread_id = ?').run(threadID)
	}

	deleteReportedBackgroundChild(threadID: string): void {
		this.database
			.query('DELETE FROM background_children WHERE thread_id = ? AND reported = 1')
			.run(threadID)
	}

	claimBackgroundNotification(threadID: string): boolean {
		const result = this.database
			.query('UPDATE background_children SET notified = 1 WHERE thread_id = ? AND reported = 0 AND notified = 0')
			.run(threadID)
		return result.changes === 1
	}

	releaseBackgroundNotification(threadID: string): void {
		this.database
			.query('UPDATE background_children SET notified = 0 WHERE thread_id = ? AND reported = 0')
			.run(threadID)
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
