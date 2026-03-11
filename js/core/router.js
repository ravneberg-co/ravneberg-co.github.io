const ROUTES = ['/']

export function navigate(path) {
	if (path === window.location.pathname) return
	history.pushState(null, '', path)
	dispatch(path)
}

export function init() {
	document.addEventListener('click', (e) => {
		const link = e.target.closest('[data-route]')
		if (!link) return
		e.preventDefault()
		navigate(link.getAttribute('href'))
	})

	window.addEventListener('popstate', () => dispatch(window.location.pathname))

	dispatch(window.location.pathname)
}

function dispatch(path) {
	if (!ROUTES.includes(path)) path = '/'
	document.dispatchEvent(new CustomEvent('route-change', { detail: { path } }))
}
