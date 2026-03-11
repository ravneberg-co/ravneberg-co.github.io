const DB_NAME = 'ravneberg_analytics'
const DB_VERSION = 1
const STORE_NAME = 'state'
const BEACON_URL = '/api/beacon'

let sessionId
let currentPage = null
let pageStart = null
let events = []

function generateId() {
	return crypto.randomUUID()
}

function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION)
		req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

async function getState(key) {
	const db = await openDB()
	return new Promise((resolve) => {
		const tx = db.transaction(STORE_NAME, 'readonly')
		const req = tx.objectStore(STORE_NAME).get(key)
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => resolve(undefined)
	})
}

async function setState(key, value) {
	const db = await openDB()
	return new Promise((resolve) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		tx.objectStore(STORE_NAME).put(value, key)
		tx.oncomplete = () => resolve()
		tx.onerror = () => resolve()
	})
}

async function getAndMarkReturning() {
	const visited = await getState('returning_visitor')
	if (visited) return true
	await setState('returning_visitor', 1)
	return false
}

async function drainPendingEvents() {
	const pending = await getState('pending_events')
	if (pending?.length) {
		events.unshift(...pending)
		await setState('pending_events', null)
	}
}

export function track(eventType, data = {}) {
	events.push({ type: eventType, ts: Date.now(), ...data })
}

function trackPageView(page) {
	const now = Date.now()
	if (currentPage && pageStart) {
		events.push({
			type: 'page_view',
			page: currentPage,
			duration: now - pageStart,
			ts: pageStart,
		})
	}
	currentPage = page
	pageStart = now
}

function flush() {
	if (currentPage && pageStart) {
		events.push({
			type: 'page_view',
			page: currentPage,
			duration: Date.now() - pageStart,
			ts: pageStart,
		})
		currentPage = null
		pageStart = null
	}

	if (!events.length) return

	const payload = JSON.stringify({
		sid: sessionId,
		returning: sessionStorage.getItem('returning') === '1',
		referrer: sessionStorage.getItem('referrer') || '',
		events,
	})

	const sent = navigator.sendBeacon(BEACON_URL, new Blob([payload], { type: 'application/json' }))

	if (!sent) {
		setState('pending_events', events).catch(() => {})
	}

	events = []
}

export async function init() {
	sessionId = sessionStorage.getItem('sid')
	if (!sessionId) {
		sessionId = generateId()
		sessionStorage.setItem('sid', sessionId)
		sessionStorage.setItem('referrer', document.referrer)

		const returning = await getAndMarkReturning()
		sessionStorage.setItem('returning', returning ? '1' : '0')
	}

	await drainPendingEvents()

	trackPageView(window.location.pathname + window.location.hash)

	document.addEventListener('route-change', (e) => {
		trackPageView(e.detail.path)
	})

	document.addEventListener('page-change', (e) => {
		const pages = document.querySelectorAll('.page')
		const page = pages[e.detail.index]
		if (page?.id) {
			trackPageView('/#' + page.id)
		}
	})

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flush()
	})

	window.addEventListener('pagehide', flush)
}
