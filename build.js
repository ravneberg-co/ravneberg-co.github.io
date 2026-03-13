import ejs from 'ejs'
import { readFileSync, mkdirSync, cpSync, writeFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const dist = './dist'

mkdirSync(dist, { recursive: true })

const data = {
	appName: pkg.name.charAt(0).toUpperCase() + pkg.name.slice(1),
	appVersion: pkg.version,
	isDev: false,
}

const html = await ejs.renderFile('./views/index.ejs', data)
writeFileSync(`${dist}/index.html`, html)

cpSync('./public', dist, { recursive: true })
cpSync('./styles', `${dist}/styles`, { recursive: true })
cpSync('./js', `${dist}/js`, { recursive: true })

console.log('Built to dist/')
