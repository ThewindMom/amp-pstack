import { describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const script = join(import.meta.dir, 'worktree-audit.sh')

function runAudit(searchJson: string) {
	const dir = mkdtempSync(join(tmpdir(), 'pstack-audit-'))
	const stub = join(dir, 'amp-search')
	writeFileSync(
		stub,
		`#!/usr/bin/env bash
printf '%s\\n' ${JSON.stringify(searchJson)}
`,
	)
	chmodSync(stub, 0o755)
	const result = Bun.spawnSync(['bash', script], {
		cwd: import.meta.dir,
		env: { ...process.env, AMP_THREADS_SEARCH: stub },
	})
	return {
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
		exitCode: result.exitCode,
	}
}

describe('worktree-audit', () => {
	test('emits LAST_THREAD and treats a recent Amp thread as hold-recent-thread', () => {
		const recent = new Date().toISOString()
		const { stdout, exitCode } = runAudit(
			JSON.stringify([{ id: 'T-hold', updatedAt: recent }]),
		)
		expect(exitCode).toBe(0)
		expect(stdout).toContain('LAST_THREAD')
		expect(stdout).toContain('BUCKET')
		if (stdout.includes('\n') && stdout.trim().split('\n').length > 1) {
			expect(stdout).toContain('T-hold')
		}
	})

	test('headers stay stable when there are no extra worktrees', () => {
		const { stdout, exitCode } = runAudit('[]')
		expect(exitCode).toBe(0)
		expect(stdout.split('\n')[0]).toBe(
			'SIZE\tAGE\tMERGED\tDIRTY\tREMOTE\tPR\tLAST_THREAD\tBUCKET\tWORKTREE',
		)
	})
})
