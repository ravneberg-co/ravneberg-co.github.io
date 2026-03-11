import { scrambleDecode } from '../core/scramble.js'

export function init() {
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					scrambleDecode(entry.target)
				}
			})
		},
		{ threshold: 0.5 }
	)

	document.querySelectorAll('h2').forEach((h2) => observer.observe(h2))
}
