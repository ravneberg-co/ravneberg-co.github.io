import * as header from './header.js'
import * as navIndicator from './nav-indicator.js'
import * as scrollNav from './scroll-nav.js'

export function init() {
	document.addEventListener('page-change', (e) => {
		const { index } = e.detail
		const onHero = index === 0

		header[onHero ? 'hide' : 'show']()
		navIndicator[onHero ? 'hide' : 'show']()
		navIndicator.update(index)
		scrollNav.update(index)
	})

	document.addEventListener('route-change', (e) => {
		const isHome = e.detail.path === '/'

		if (isHome) {
			scrollNav.enable()
		} else {
			scrollNav.disable()
			header.show()
			navIndicator.hide()
		}
	})
}
