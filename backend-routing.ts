import { DEFAULT_BACKENDS, type BackendConfig, type CliBackendId } from './cli-backends'

export const BACKEND_CONFIG_KEY = 'pstack.backends'
export type BackendPreferences = { opus: 'claude-code' | 'amp'; grokBuild: boolean }
export const DEFAULT_BACKEND_PREFERENCES: BackendPreferences = { opus: 'claude-code', grokBuild: false }

export function cliSeat(backend: CliBackendId, model: string, effort?: string): BackendConfig {
	if (backend === 'claude-code' && model.startsWith('anthropic/claude-opus-')) {
		if (effort && !['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw new Error(`Claude Code does not support effort ${effort}. Select a supported effort or native Opus.`)
		return { ...DEFAULT_BACKENDS[backend], model: model === 'anthropic/claude-opus-5-5' ? 'opus' : model.slice('anthropic/'.length), effort }
	}
	if (model === 'xai/grok-4.7' && backend !== 'claude-code' && (!effort || effort === 'xhigh')) return DEFAULT_BACKENDS[backend]
	throw new Error(`No verified ${backend} mapping for ${model} at ${effort ?? 'default'} effort. Select a supported seat; no replacement was launched.`)
}

export function backendPreferences(value: unknown): BackendPreferences {
	if (value === undefined) return { ...DEFAULT_BACKEND_PREFERENCES }
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('pstack.backends must be an object.')
	const config = value as Record<string, unknown>
	if (Object.keys(config).some((key) => !['opus', 'grokBuild'].includes(key)) ||
		(config.opus !== undefined && config.opus !== 'amp' && config.opus !== 'claude-code') ||
		(config.grokBuild !== undefined && typeof config.grokBuild !== 'boolean')) {
		throw new Error('Backend preferences accept opus: claude-code | amp and grokBuild: boolean.')
	}
	return { opus: config.opus as BackendPreferences['opus'] ?? 'claude-code', grokBuild: config.grokBuild as boolean ?? false }
}

type Provider = { type: string; active: boolean; priority: number; config?: { modelMapping?: unknown } }

function servesGrok(provider: Provider): boolean | undefined {
	const mapping = provider.config?.modelMapping
	if (mapping == null || mapping === '') {
		return !['model_provider_openai_chatgpt', 'model_provider_claude_sub', 'model_provider_cursor_sub'].includes(provider.type)
	}
	if (typeof mapping !== 'string') return undefined
	let included = false
	for (const line of mapping.split(/\r?\n/).map((line) => line.split('#')[0]!).join('\n').split(/\n|,/)) {
		const rule = line.trim()
		if (!rule) continue
		const exclude = rule.startsWith('-')
		const pattern = rule.split('->')[0]!.trim().replace(/^-/, '')
		if (!/^[a-zA-Z0-9._/*-]+$/.test(pattern)) return undefined
		const regex = new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
		if (regex.test('xai/grok-4.7')) included = !exclude
	}
	return included
}

export function grokSubscriptionWins(value: unknown): boolean {
	if (!Array.isArray(value)) return false
	if (value.some((p) => !p || typeof p.type !== 'string' || typeof p.active !== 'boolean' || !Number.isFinite(p.priority))) return false
	const providers = value as Provider[]
	const subscription = providers.find((p) => p.type === 'model_provider_xai_grok' && p.active && servesGrok(p) === true)
	if (!subscription) return false
	return providers.every((p, index) => {
		if (p === subscription || !p.active) return true
		if (servesGrok(p) === false) return true
		return providers.indexOf(subscription) < index && subscription.priority < p.priority
	})
}

export async function selectBackend(model: string, preferences: BackendPreferences): Promise<'amp' | CliBackendId> {
	if (model === 'xai/grok-4.7') {
		const run = Bun.spawn(['amp', 'config', 'model-providers', 'list', '--json'], { stdout: 'pipe', stderr: 'pipe' })
		const [output, , code] = await Promise.all([new Response(run.stdout).text(), new Response(run.stderr).text(), run.exited])
		let safe = false
		try { safe = code === 0 && grokSubscriptionWins(JSON.parse(output)) } catch {}
		return safe ? 'amp' : preferences.grokBuild ? 'grok-build' : 'cursor-cli'
	}
	return model.startsWith('anthropic/claude-opus-') ? preferences.opus : 'amp'
}
