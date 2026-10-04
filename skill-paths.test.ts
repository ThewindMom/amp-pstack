import { describe, expect, test } from 'bun:test'

const FIX = 'Write `bun <loaded-skill-base>/scripts/...` or `bash <loaded-skill-base>/scripts/...`, as skills/poteto-mode/playbooks/worktree-cleanup.md does.'

export function findPathViolations(file: string, text: string): string[] {
	const violations: string[] = []
	let fenced = false
	text.split('\n').forEach((line, index) => {
		const where = `${file}:${index + 1}`
		if (line.trimStart().startsWith('```')) {
			fenced = !fenced
			return
		}
		if (line.includes('.cursor/')) {
			violations.push(`${where}: names a Cursor install path (.cursor/). Amp installs have no .cursor directory; use the loaded skill base directory.`)
		}
		const spans: Array<{ code: string; before: string }> = fenced
			? [{ code: line.trim(), before: '' }]
			: [...line.matchAll(/`([^`]+)`/g)].map((match) => ({ code: match[1], before: line.slice(0, match.index) }))
		for (const { code, before } of spans) {
			const interpreted = code.match(/^(?:bash|bun|sh|node|source)\s+(\S+)/)
			const runsBareScript =
				/^(?:\.\/)?(?:skills\/[\w-]+\/)?scripts\//.test(code) && (/\s/.test(code) || /\b(?:run|execute|invoke)\s*$/i.test(before))
			if ((interpreted && interpreted[1].includes('scripts/') && !interpreted[1].startsWith('<loaded-skill-base>/')) || runsBareScript) {
				violations.push(`${where}: \`${code}\` runs a bundled script relative to the user's working directory, which does not exist on an installed plugin. ${FIX}`)
			}
		}
	})
	return violations
}

describe('skill prose paths', () => {
	test('flags the cwd-relative script invocations that b756918 had to fix', () => {
		expect(findPathViolations('show-me-your-work/SKILL.md', 'Use the helper `scripts/log.sh <logfile> <phase>`. Then run `scripts/worktree-audit.sh` or `bun skills/poteto-mode/scripts/check-plan.mjs <plan.md>`.')).toEqual([
			`show-me-your-work/SKILL.md:1: \`scripts/log.sh <logfile> <phase>\` runs a bundled script relative to the user's working directory, which does not exist on an installed plugin. ${FIX}`,
			`show-me-your-work/SKILL.md:1: \`scripts/worktree-audit.sh\` runs a bundled script relative to the user's working directory, which does not exist on an installed plugin. ${FIX}`,
			`show-me-your-work/SKILL.md:1: \`bun skills/poteto-mode/scripts/check-plan.mjs <plan.md>\` runs a bundled script relative to the user's working directory, which does not exist on an installed plugin. ${FIX}`,
		])
		expect(findPathViolations('a.md', 'Status comes from `scripts/watch-pr/watch-pr`. Run `bun <loaded-skill-base>/scripts/watch-pr/watch-pr`.')).toEqual([])
	})

	test('skills and agent templates resolve bundled files from the loaded skill base', async () => {
		const root = new URL('.', import.meta.url).pathname
		const violations: string[] = []
		for (const pattern of ['skills/**/*.md', 'agents/*.md']) {
			for await (const file of new Bun.Glob(pattern).scan(root)) {
				violations.push(...findPathViolations(file, await Bun.file(root + file).text()))
			}
		}
		expect(violations).toEqual([])
	})
})
