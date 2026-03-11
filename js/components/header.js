import { scrollToElement } from '../core/scroll.js'
import { navigate } from '../core/router.js'

const el = document.getElementById('page-header')
const heroPage = document.querySelector('.page--hero')

el.addEventListener('click', (e) => {
	e.preventDefault()
	if (document.documentElement.classList.contains('route--home')) {
		scrollToElement(heroPage)
	} else {
		navigate('/')
	}
})

export function show() {
	el.classList.add('visible')
}

export function hide() {
	el.classList.remove('visible')
}
