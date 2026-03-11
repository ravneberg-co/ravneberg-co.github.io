import Database from 'better-sqlite3'
import crypto from 'crypto'
import geoip from 'geoip-lite'
import { mkdirSync } from 'fs'

mkdirSync('data', { recursive: true })

const db = new Database('data/analytics.db')
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

db.exec(`
	CREATE TABLE IF NOT EXISTS sessions (
		session_id TEXT PRIMARY KEY,
		visitor_hash TEXT NOT NULL,
		is_returning INTEGER NOT NULL DEFAULT 0,
		referrer TEXT,
		device TEXT,
		browser TEXT,
		country TEXT,
		region TEXT,
		language TEXT,
		accept TEXT,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS page_views (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		page TEXT NOT NULL,
		duration_ms INTEGER NOT NULL,
		timestamp INTEGER NOT NULL,
		FOREIGN KEY (session_id) REFERENCES sessions(session_id)
	);

	CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
	CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_hash);
	CREATE INDEX IF NOT EXISTS idx_pageviews_session ON page_views(session_id);
	CREATE INDEX IF NOT EXISTS idx_pageviews_timestamp ON page_views(timestamp);

	CREATE TABLE IF NOT EXISTS events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		event_type TEXT NOT NULL,
		timestamp INTEGER NOT NULL,
		FOREIGN KEY (session_id) REFERENCES sessions(session_id)
	);

	CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
	CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`)

// Migrate: add columns if missing
try { db.exec('ALTER TABLE sessions ADD COLUMN language TEXT') } catch {}
try { db.exec('ALTER TABLE sessions ADD COLUMN accept TEXT') } catch {}

const insertSession = db.prepare(`
	INSERT OR IGNORE INTO sessions (session_id, visitor_hash, is_returning, referrer, device, browser, country, region, language, accept, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertPageView = db.prepare(`
	INSERT INTO page_views (session_id, page, duration_ms, timestamp)
	VALUES (?, ?, ?, ?)
`)

const insertEvent = db.prepare(`
	INSERT INTO events (session_id, event_type, timestamp)
	VALUES (?, ?, ?)
`)

const processBeacon = db.transaction((session, pageViews, customEvents) => {
	insertSession.run(
		session.sid, session.visitorHash, session.is_returning ? 1 : 0,
		session.referrer, session.device, session.browser,
		session.country, session.region, session.language, session.accept, session.createdAt,
	)
	for (const pv of pageViews) {
		insertPageView.run(session.sid, pv.page, pv.duration, pv.ts)
	}
	for (const ev of customEvents) {
		insertEvent.run(session.sid, ev.type, ev.ts)
	}
})

function visitorHash(ip, ua) {
	const day = new Date().toISOString().slice(0, 10)
	return crypto.createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex').slice(0, 16)
}

function parseDevice(ua) {
	if (!ua) return { device: 'unknown', browser: 'unknown' }
	const mobile = /Mobile|Android|iPhone|iPad/i.test(ua)
	const device = mobile ? 'mobile' : 'desktop'

	let browser = 'other'
	if (/Firefox/i.test(ua)) browser = 'Firefox'
	else if (/Edg/i.test(ua)) browser = 'Edge'
	else if (/Chrome/i.test(ua)) browser = 'Chrome'
	else if (/Safari/i.test(ua)) browser = 'Safari'

	return { device, browser }
}

function geoLookup(ip) {
	const geo = geoip.lookup(ip)
	if (!geo) return { country: null, region: null }
	return { country: geo.country, region: geo.region }
}

export function handleBeacon(req) {
	const { sid, is_returning, referrer, events } = req.body
	if (!sid || !Array.isArray(events) || !events.length) return

	const ip = req.ip || req.socket?.remoteAddress || ''
	const ua = req.get('user-agent') || ''

	const { device, browser } = parseDevice(ua)
	const { country, region } = geoLookup(ip)
	const language = (req.get('accept-language') || '').split(',')[0] || null
	const accept = req.get('accept') || null

	const pageViews = events.filter(e => e.type === 'page_view' && e.page && e.duration > 0)
	const customEvents = events.filter(e => e.type !== 'page_view' && e.type && e.ts)
	if (!pageViews.length && !customEvents.length) return

	processBeacon({
		sid,
		visitorHash: visitorHash(ip, ua),
		is_returning: !!is_returning,
		referrer: referrer || '',
		device,
		browser,
		country,
		region,
		language,
		accept,
		createdAt: (pageViews[0]?.ts || customEvents[0]?.ts || Date.now()),
	}, pageViews, customEvents)
}

export function getStats(days = 30) {
	const since = Date.now() - days * 86400000

	const totals = db.prepare(`
		SELECT
			COUNT(DISTINCT session_id) as sessions,
			COUNT(DISTINCT visitor_hash) as unique_visitors,
			SUM(is_returning) as is_returning_visitors
		FROM sessions WHERE created_at > ?
	`).get(since)

	const pages = db.prepare(`
		SELECT page, COUNT(*) as views, AVG(duration_ms) as avg_duration
		FROM page_views WHERE timestamp > ?
		GROUP BY page ORDER BY views DESC
	`).all(since)

	const referrers = db.prepare(`
		SELECT referrer, COUNT(*) as count
		FROM sessions WHERE created_at > ? AND referrer != ''
		GROUP BY referrer ORDER BY count DESC LIMIT 20
	`).all(since)

	const countries = db.prepare(`
		SELECT country, COUNT(*) as count
		FROM sessions WHERE created_at > ? AND country IS NOT NULL
		GROUP BY country ORDER BY count DESC
	`).all(since)

	const browsers = db.prepare(`
		SELECT browser, COUNT(*) as count
		FROM sessions WHERE created_at > ?
		GROUP BY browser ORDER BY count DESC
	`).all(since)

	const devices = db.prepare(`
		SELECT device, COUNT(*) as count
		FROM sessions WHERE created_at > ?
		GROUP BY device ORDER BY count DESC
	`).all(since)

	const languages = db.prepare(`
		SELECT language, COUNT(*) as count
		FROM sessions WHERE created_at > ? AND language IS NOT NULL
		GROUP BY language ORDER BY count DESC
	`).all(since)

	const conversion = db.prepare(`
		SELECT event_type, COUNT(*) as count
		FROM events WHERE timestamp > ?
		GROUP BY event_type ORDER BY count DESC
	`).all(since)

	const daily = db.prepare(`
		SELECT DATE(created_at / 1000, 'unixepoch') as day, COUNT(DISTINCT session_id) as sessions, COUNT(DISTINCT visitor_hash) as visitors
		FROM sessions WHERE created_at > ?
		GROUP BY day ORDER BY day
	`).all(since)

	return { totals, pages, referrers, countries, browsers, devices, languages, conversion, daily }
}
