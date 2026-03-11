import express from 'express'
import { readFileSync } from 'fs'
import { handleBeacon, getStats } from './analytics.js'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const app = express()
app.set('trust proxy', true)
const PORT = process.env.PORT || 3000
const isDev = process.env.NODE_ENV !== 'production'

app.locals.appName = pkg.name.charAt(0).toUpperCase() + pkg.name.slice(1)
app.locals.appVersion = pkg.version

app.set('view engine', 'ejs')
app.set('views', './views')

if (isDev) {
	const livereload = (await import('livereload')).default
	const lr = livereload.createServer({ host: '0.0.0.0', exts: ['ejs', 'css', 'js'], delay: 200 })
	lr.server.on('error', () => {})
	lr.watch(['views', 'styles', 'js', 'public'])
}

app.locals.isDev = isDev

app.use((req, res, next) => {
	res.set({
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
		'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
	})
	next()
})

app.use(express.json())
app.use('/js', express.static('js'))
app.use('/styles', express.static('styles'))
app.use(express.static('public'))

// --- Analytics ---

app.post('/api/beacon', (req, res) => {
	try {
		handleBeacon(req)
	} catch (e) {
		console.error('Beacon error:', e.message)
	}
	res.status(204).end()
})

app.get('/api/stats', (req, res) => {
	const days = parseInt(req.query.days) || 30
	res.json(getStats(days))
})

app.get('/stats', (req, res) => {
	res.render('stats')
})

// --- Routes ---

app.get('/{*path}', (req, res, next) => {
	if (req.path.startsWith('/api/')) return next()
	res.render('index')
})

app.listen(PORT, () => console.log(`http://localhost:${PORT}`))
