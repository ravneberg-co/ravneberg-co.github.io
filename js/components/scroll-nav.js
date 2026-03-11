import { scrollToElement } from '../core/scroll.js'

const scrollUp = document.getElementById('scroll-up')
const scrollDown = document.getElementById('scroll-down')
const pages = document.querySelectorAll('.page')

let currentPageIndex = 0
let observerActive = true

function blockWheel(e) { e.preventDefault() }
function blockKeys(e) {
	if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault()
}

function lockInput() {
	window.addEventListener('wheel', blockWheel, { passive: false })
	window.addEventListener('keydown', blockKeys)
}

function unlockInput() {
	window.removeEventListener('wheel', blockWheel)
	window.removeEventListener('keydown', blockKeys)
}

document.addEventListener('scrollsnapchanging', () => {
	if (observerActive) lockInput()
})

document.addEventListener('scrollsnapchange', () => {
	unlockInput()
})

const pageObserver = new IntersectionObserver(
	(entries) => {
		if (!observerActive) return
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				currentPageIndex = Array.from(pages).indexOf(entry.target)
				document.dispatchEvent(new CustomEvent('page-change', { detail: { index: currentPageIndex } }))
				const id = entry.target.id
				if (id && id !== 'home') {
					history.replaceState(null, '', `#${id}`)
				} else if (id === 'home') {
					history.replaceState(null, '', window.location.pathname)
				}
			}
		})
	},
	{ threshold: 0.5 },
)

pages.forEach((page) => pageObserver.observe(page))

scrollDown.addEventListener('click', () => {
	if (currentPageIndex < pages.length - 1) {
		lockInput()
		scrollToElement(pages[currentPageIndex + 1])
	}
})

scrollUp.addEventListener('click', () => {
	if (currentPageIndex > 0) {
		lockInput()
		scrollToElement(pages[currentPageIndex - 1])
	}
})

export function update(index) {
	const onLast = index === pages.length - 1
	scrollUp.classList.toggle('visible', index > 0)
	scrollDown.classList.toggle('visible', !onLast)
}

export function enable() {
	observerActive = true
}

export function disable() {
	observerActive = false
	unlockInput()
	scrollUp.classList.remove('visible')
	scrollDown.classList.remove('visible')
}
