export function init() {
	const toggle = document.querySelector('.theme-toggle')
	const root = document.documentElement

	function isCurrentlyLight() {
		if (root.classList.contains('light')) return true
		if (root.classList.contains('dark')) return false
		return window.matchMedia('(prefers-color-scheme: light)').matches
	}

	toggle.addEventListener('click', () => {
		if (isCurrentlyLight()) {
			root.classList.remove('light')
			root.classList.add('dark')
		} else {
			root.classList.remove('dark')
			root.classList.add('light')
		}
	})
}
