export function init() {
	const btn = document.querySelector('.fullscreen-toggle')
	if (!btn) return

	btn.addEventListener('click', () => {
		if (document.fullscreenElement) {
			document.exitFullscreen()
		} else {
			document.documentElement.requestFullscreen()
		}
	})
}
