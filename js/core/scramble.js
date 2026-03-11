const GLYPHS = 'ABCDEF0123456789@#$%&*!?<>[]'

export function scrambleDecode(el, { holdTicks = 8, interval = 45 } = {}) {
	clearTimeout(el._scrambleTimer)
	const original = el.textContent
	const len = original.length
	let tick = 0

	const step = () => {
		const resolved = Math.max(0, tick - holdTicks)
		el.textContent = original
			.split('')
			.map((ch, i) => {
				if (ch === ' ') return ' '
				return i < resolved ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
			})
			.join('')
		tick++
		if (resolved <= len) {
			el._scrambleTimer = setTimeout(step, interval)
		}
	}
	step()
}
