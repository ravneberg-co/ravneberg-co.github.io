import { init as initTerrain } from './components/terrain.js'
import { init as initTheme } from './components/theme-toggle.js'
import { init as initNav } from './components/navigation.js'
import { init as initFullscreen } from './components/fullscreen.js'
import { init as initHeadingScramble } from './components/heading-scramble.js'
import { init as initAnalytics } from './core/analytics.js'
import { init as initRouter } from './core/router.js'

document.addEventListener('route-change', (e) => {
	const { path } = e.detail
	document.documentElement.classList.toggle('route--home', path === '/')

	const hash = window.location.hash
	const hashTarget = hash && document.querySelector(hash)
	if (hashTarget) {
		requestAnimationFrame(() => hashTarget.scrollIntoView())
	} else {
		window.scrollTo(0, 0)
	}
})

initTerrain(document.getElementById('terrain-container'))
initTheme()
initNav()
initFullscreen()
initHeadingScramble()
initAnalytics()
initRouter()
