import type { PluginThread, ThreadMessage, ThreadState } from '@ampcode/plugin'
import { cliRunStatus, collectCliRun, launchCliRun, stopCliRun, type CliRunOptions, type RunResult } from './cli-backends'

export type DelegateThread = Pick<PluginThread, 'appendUserMessage' | 'cancel' | 'messages'> & {
	id: string
	state: { get(): Promise<ThreadState>; subscribe(listener: (state: ThreadState) => void): { unsubscribe(): void } }
	waitForResponse(options?: { timeoutMs?: number }): Promise<{ content: unknown }>
}

export function cliReport(result: RunResult): string {
	return [`CLI run ${result.id}: ${result.verdict} (${result.backend ?? 'no backend'})`, result.finalText,
		...result.attempts.filter((a) => a.classification !== 'ok').map((a) => a.evidence),
		result.patchPath ? `Review before applying: ${result.patchPath}\n${result.diffstat}` : '',
	].filter(Boolean).join('\n\n')
}

export function cliDelegate(id: string, options: CliRunOptions = {}): DelegateThread {
	const state = async () => {
		const status = cliRunStatus(id, options)
		return status.state === 'running' ? 'running' as const : status.result.verdict === 'ok' ? 'idle' as const : 'error' as const
	}
	return {
		id,
		state: {
			get: state,
			subscribe(listener) {
				listener('running')
				let busy = false
				const timer = setInterval(async () => {
					if (busy) return
					busy = true
					try { listener(await state()) } catch { /* Retry transient supervisor errors. */ }
					finally { busy = false }
				}, 1000)
				return { unsubscribe: () => clearInterval(timer) }
			},
		},
		// Ownership is attached before this initial launch. The persisted brief cannot be re-steered.
		async appendUserMessage() { launchCliRun(id, options) },
		async cancel() { stopCliRun(id, options) },
		async messages(query) {
			if (query?.offset) return []
			const status = cliRunStatus(id, options)
			if (status.state !== 'done') return []
			return [{ role: 'assistant', id: `cli-report-${id}`, content: [{ type: 'text', text: cliReport(status.result) }] }] as ThreadMessage[]
		},
		async waitForResponse(query) {
			const collected = await collectCliRun(id, { ...options, timeoutMs: query?.timeoutMs ?? 600_000 })
			if (collected.status === 'timeout') throw new Error(`CLI run ${id} remains running.`)
			if (collected.result.verdict !== 'ok') throw new Error(cliReport(collected.result))
			return { content: [{ type: 'text', text: cliReport(collected.result) }] }
		},
	}
}
