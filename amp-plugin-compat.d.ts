interface SymbolConstructor {
	readonly observable: unique symbol
}

declare module '*.md' {
	const text: string
	export default text
}
