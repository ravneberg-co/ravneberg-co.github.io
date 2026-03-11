import { scrollToElement } from '../core/scroll.js'
import { scrambleDecode } from '../core/scramble.js'

const el = document.getElementById('nav-indicator')
const items = document.querySelectorAll('.nav-indicator__item')
const pages = document.querySelectorAll('.page')

items.forEach((item) => {
	item.addEventListener('click', () => {
		const pageIndex = parseInt(item.dataset.page)
		scrollToElement(pages[pageIndex])
	})
})

export function update(currentPageIndex) {
	items.forEach((item) => {
		const pageIndex = parseInt(item.dataset.page)
		const wasCurrent = item.classList.contains('nav-indicator__item--current')
		const isCurrent = pageIndex === currentPageIndex
		item.classList.toggle('nav-indicator__item--current', isCurrent)

		if (isCurrent && !wasCurrent) {
			const title = item.querySelector('.nav-indicator__title')
			if (title) scrambleDecode(title)
		}
	})
}

export function show() {
	el.classList.add('visible')
}

export function hide() {
	el.classList.remove('visible')
}
