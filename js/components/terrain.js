export function init(container) {
	if (!container || typeof THREE === 'undefined') return

	const HEIGHT = 200
	const worldWidth = 4000
	let scroll = 0
	let allLights = false

	const toggle = document.getElementById('all-lights-toggle')
	if (toggle) {
		toggle.addEventListener('change', function () {
			allLights = this.checked
		})
	}

	// Three.js setup
	const scene = new THREE.Scene()
	const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10)
	camera.position.z = 1

	const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
	renderer.setClearColor(0x000000, 0)
	container.appendChild(renderer.domElement)

	// Terrain blocks
	const terrainBlocks = []

	const WALL_T = 6

	function pushHollow(bx, by, bw, bh, doorSide) {
		if (bw < 25 || bh < 25) {
			terrainBlocks.push({ x: bx, y: by, w: bw, h: bh })
			return
		}
		const doorW = 10 + Math.random() * 8

		// Top edge
		terrainBlocks.push({ x: bx, y: by + bh - WALL_T, w: bw, h: WALL_T })
		// Bottom edge
		terrainBlocks.push({ x: bx, y: by, w: bw, h: WALL_T })
		// Left edge
		terrainBlocks.push({ x: bx, y: by + WALL_T, w: WALL_T, h: bh - WALL_T * 2 })
		// Right edge
		terrainBlocks.push({ x: bx + bw - WALL_T, y: by + WALL_T, w: WALL_T, h: bh - WALL_T * 2 })

		// Doorway — remove a section of the wall facing the corridor
		if (doorSide === 'bottom') {
			const doorX = bx + bw * 0.3 + Math.random() * bw * 0.4
			// Overwrite bottom edge with two parts leaving a gap
			const last = terrainBlocks.length - 3
			terrainBlocks[last] = { x: bx, y: by, w: doorX - bx, h: WALL_T }
			terrainBlocks.push({ x: doorX + doorW, y: by, w: bx + bw - doorX - doorW, h: WALL_T })
		} else if (doorSide === 'top') {
			const doorX = bx + bw * 0.3 + Math.random() * bw * 0.4
			const topIdx = terrainBlocks.length - 4
			terrainBlocks[topIdx] = { x: bx, y: by + bh - WALL_T, w: doorX - bx, h: WALL_T }
			terrainBlocks.push({ x: doorX + doorW, y: by + bh - WALL_T, w: bx + bw - doorX - doorW, h: WALL_T })
		}
	}

	function generateTerrain() {
		terrainBlocks.length = 0
		let x = 0
		let centerY = HEIGHT / 2

		while (x < worldWidth) {
			const isRoom = Math.random() < 0.25
			const corridorW = isRoom ? 70 + Math.random() * 50 : 25 + Math.random() * 20
			const len = isRoom ? 160 + Math.random() * 180 : 80 + Math.random() * 120

			// Wander the corridor center
			centerY += (Math.random() - 0.5) * 100
			centerY = Math.max(corridorW / 2 + 15, Math.min(HEIGHT - corridorW / 2 - 15, centerY))

			const wallTop = centerY + corridorW / 2
			const wallBottom = centerY - corridorW / 2

			// Top wall block (above corridor)
			if (wallTop < HEIGHT - 3) {
				const bh = HEIGHT - wallTop
				if (Math.random() < 0.5) {
					pushHollow(x, wallTop, len, bh, 'bottom')
				} else {
					terrainBlocks.push({ x, y: wallTop, w: len, h: bh })
				}
			}

			// Bottom wall block (below corridor)
			if (wallBottom > 3) {
				if (Math.random() < 0.5) {
					pushHollow(x, 0, len, wallBottom, 'top')
				} else {
					terrainBlocks.push({ x, y: 0, w: len, h: wallBottom })
				}
			}

			// Pillars inside wide corridor sections
			if (isRoom && corridorW > 60) {
				const pillarH = 8 + Math.random() * 12
				const pillarW = 6 + Math.random() * 10
				if (Math.random() < 0.5) {
					terrainBlocks.push({ x: x + len * 0.3 + Math.random() * len * 0.4, y: wallTop - pillarH, w: pillarW, h: pillarH })
				}
				if (Math.random() < 0.5) {
					terrainBlocks.push({ x: x + len * 0.2 + Math.random() * len * 0.5, y: wallBottom, w: pillarW, h: pillarH })
				}
			}

			// Gap between segments
			x += len + 50 + Math.random() * 30
		}
	}
	generateTerrain()

	// Easing
	function easeInOutCubic(t) {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
	}

	// Soldiers
	const soldiers = []
	const formationSpacing = 30
	for (let i = 0; i < 6; i++) {
		const y = HEIGHT / 2
		soldiers.push({
			x: 80 + i * formationSpacing,
			y,
			fromY: y,
			toY: y,
			tweenStart: 0,
			tweenDuration: 0,
			cooldownUntil: 0,
		})
	}

	// Collision detection
	function isBlocked(x, y, radius) {
		for (const b of terrainBlocks) {
			const bx = b.x - scroll
			if (x + radius > bx && x - radius < bx + b.w &&
				y + radius > b.y && y - radius < b.y + b.h) return true
		}
		return false
	}

	// Returns null if no move needed, or a target Y if wall ahead
	function findClearY(x, currentY) {
		const radius = 10
		for (let d = 10; d <= 40; d += 5) {
			if (isBlocked(x + d, currentY, radius)) {
				for (let offset = 5; offset < HEIGHT / 2; offset += 5) {
					if (currentY - offset > 15 && !isBlocked(x + d, currentY - offset, radius))
						return currentY - offset
					if (currentY + offset < HEIGHT - 15 && !isBlocked(x + d, currentY + offset, radius))
						return currentY + offset
				}
			}
		}
		return null // no wall, stay put
	}

	function startTween(s, toY, now) {
		const dist = Math.abs(toY - s.y)
		s.fromY = s.y
		s.toY = toY
		s.tweenStart = now
		s.tweenDuration = Math.max(0.8, dist * 0.02)
		s.cooldownUntil = now + s.tweenDuration + 1.5
	}

	// Custom shader material for raytraced shadows
	const shadowMaterial = new THREE.ShaderMaterial({
		transparent: true,
		uniforms: {
			u_resolution: { value: new THREE.Vector2(1, 1) },
			u_blocks: { value: new Float32Array(128) },
			u_numBlocks: { value: 0 },
			u_lights: { value: new Float32Array(16) },
			u_numLights: { value: 1 }
		},
		vertexShader: `
			varying vec2 v_uv;
			void main() {
				v_uv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			precision highp float;
			varying vec2 v_uv;
			uniform vec2 u_resolution;
			uniform float u_blocks[128];
			uniform int u_numBlocks;
			uniform float u_lights[16];
			uniform int u_numLights;

			bool inBlock(vec2 p) {
				for (int i = 0; i < 32; i++) {
					if (i >= u_numBlocks) break;
					float bx = u_blocks[i * 4];
					float by = u_blocks[i * 4 + 1];
					float bw = u_blocks[i * 4 + 2];
					float bh = u_blocks[i * 4 + 3];
					if (p.x >= bx && p.x <= bx + bw && p.y >= by && p.y <= by + bh) return true;
				}
				return false;
			}

			bool onBlockEdge(vec2 p, float edgeWidth) {
				for (int i = 0; i < 32; i++) {
					if (i >= u_numBlocks) break;
					float bx = u_blocks[i * 4];
					float by = u_blocks[i * 4 + 1];
					float bw = u_blocks[i * 4 + 2];
					float bh = u_blocks[i * 4 + 3];
					if (p.x >= bx - edgeWidth && p.x <= bx + bw + edgeWidth &&
						p.y >= by - edgeWidth && p.y <= by + bh + edgeWidth) {
						if (p.x < bx + edgeWidth || p.x > bx + bw - edgeWidth ||
							p.y < by + edgeWidth || p.y > by + bh - edgeWidth) {
							return true;
						}
					}
				}
				return false;
			}

			bool rayHitsBox(vec2 ro, vec2 rd, float bx, float by, float bw, float bh, float maxT) {
				vec2 invRd = 1.0 / rd;
				vec2 t1 = (vec2(bx, by) - ro) * invRd;
				vec2 t2 = (vec2(bx + bw, by + bh) - ro) * invRd;
				vec2 tmin = min(t1, t2);
				vec2 tmax = max(t1, t2);
				float tNear = max(tmin.x, tmin.y);
				float tFar = min(tmax.x, tmax.y);
				return tNear < tFar && tNear > 0.5 && tNear < maxT;
			}

			bool isLit(vec2 p) {
				for (int j = 0; j < 8; j++) {
					if (j >= u_numLights) break;
					vec2 light = vec2(u_lights[j * 2], u_lights[j * 2 + 1]);
					vec2 dir = p - light;
					float dist = length(dir);
					if (dist < 1.0) return true;
					vec2 rd = dir / dist;

					bool blocked = false;
					for (int i = 0; i < 32; i++) {
						if (i >= u_numBlocks) break;
						float bx = u_blocks[i * 4];
						float by = u_blocks[i * 4 + 1];
						float bw = u_blocks[i * 4 + 2];
						float bh = u_blocks[i * 4 + 3];
						if (rayHitsBox(light, rd, bx, by, bw, bh, dist)) {
							blocked = true;
							break;
						}
					}
					if (!blocked) return true;
				}
				return false;
			}

			float grid(vec2 p, float spacing) {
				vec2 g = abs(fract(p / spacing) - 0.5);
				float line = min(g.x, g.y);
				return step(line, 0.02);
			}

			float dither(vec2 p, float threshold) {
				vec2 cell = floor(p / 4.0);
				float pattern = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
				return step(threshold, pattern);
			}

			float scanline(vec2 p) {
				return 0.92 + 0.08 * step(0.5, fract(p.y / 3.0));
			}

			void main() {
				vec2 p = v_uv * u_resolution;
				float scan = scanline(p);

				if (inBlock(p)) {
					gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
				} else if (onBlockEdge(p, 1.5)) {
					gl_FragColor = vec4(0.25, 0.22, 0.18, 0.8) * scan;
				} else if (isLit(p)) {
					float g = grid(p, 20.0) * 0.06;
					vec3 litColor = vec3(0.18 + g, 0.16 + g, 0.12 + g);
					gl_FragColor = vec4(litColor * scan, 1.0);
				} else {
					float d = dither(p, 0.7);
					vec3 shadowColor = mix(vec3(0.04, 0.04, 0.05), vec3(0.07, 0.07, 0.08), d * 0.3);
					float g = grid(p, 20.0) * 0.03;
					gl_FragColor = vec4((shadowColor + g) * scan, 1.0);
				}
			}
		`
	})

	const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial)
	plane.position.set(0.5, 0.5, 0)
	scene.add(plane)

	// Soldier meshes
	const soldierGroup = new THREE.Group()
	scene.add(soldierGroup)
	const soldierMeshes = []
	const radioWaves = []

	const TEAL = 0x59e6d5
	const UNLIT = 0x556677

	for (let i = 0; i < soldiers.length; i++) {
		const geo = new THREE.PlaneGeometry(10, 10)
		const mat = new THREE.MeshBasicMaterial({ color: UNLIT })
		const mesh = new THREE.Mesh(geo, mat)
		mesh.position.z = 0.1
		soldierGroup.add(mesh)
		soldierMeshes.push(mesh)

		const waves = []
		for (let w = 0; w < 3; w++) {
			const edgesGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(16, 16))
			const lineMat = new THREE.LineBasicMaterial({
				color: TEAL,
				transparent: true,
				opacity: 0
			})
			const ring = new THREE.LineSegments(edgesGeo, lineMat)
			ring.position.z = 0.05
			ring.userData.phase = w * (Math.PI * 2 / 3)
			ring.userData.baseScale = 1
			soldierGroup.add(ring)
			waves.push(ring)
		}
		radioWaves.push(waves)
	}

	// HUD markers — AR-style data overlays
	const hudGroup = new THREE.Group()
	scene.add(hudGroup)
	const hudMarkers = []

	function makeTextSprite(text, color = '#59e6d5', fontSize = 10, maxChars = 0) {
		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')
		ctx.font = `${fontSize}px monospace`
		const charW = ctx.measureText('W').width
		const w = Math.ceil((maxChars > 0 ? charW * maxChars : ctx.measureText(text).width)) + 4
		canvas.width = w
		canvas.height = fontSize + 4
		ctx.font = `${fontSize}px monospace`
		ctx.fillStyle = color
		ctx.globalAlpha = 0.6
		ctx.fillText(text, 2, fontSize)
		const tex = new THREE.CanvasTexture(canvas)
		tex.minFilter = THREE.NearestFilter
		tex.magFilter = THREE.NearestFilter
		const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
		const sprite = new THREE.Sprite(mat)
		sprite.scale.set(w, fontSize + 4, 1)
		sprite.userData.canvas = canvas
		sprite.userData.color = color
		sprite.userData.fontSize = fontSize
		return sprite
	}

	function updateSpriteText(sprite, text) {
		const { canvas, color, fontSize } = sprite.userData
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		ctx.font = `${fontSize}px monospace`
		ctx.fillStyle = color
		ctx.globalAlpha = 0.6
		ctx.fillText(text, 2, fontSize)
		sprite.material.map.needsUpdate = true
	}

	const dataGenerators = [
		() => (Math.random() * 99.9).toFixed(1) + '%',
		() => Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255),
		() => '#' + Math.floor(Math.random() * 0xFFF).toString(16).padStart(3, '0'),
		() => 'T' + (Math.random() * 40 - 10).toFixed(1),
		() => '>' + Math.floor(Math.random() * 1024) + 'ms',
	]

	function makeCornerMarker(size = 6) {
		const points = []
		// top-left corner bracket
		points.push(new THREE.Vector3(-size, size / 2, 0))
		points.push(new THREE.Vector3(-size, size, 0))
		points.push(new THREE.Vector3(-size / 2, size, 0))
		const geo = new THREE.BufferGeometry().setFromPoints(points)
		const mat = new THREE.LineBasicMaterial({ color: 0x59e6d5, transparent: true, opacity: 0.4 })
		return new THREE.Line(geo, mat)
	}

	function generateHudMarkers() {
		hudGroup.clear()
		hudMarkers.length = 0

		for (const b of terrainBlocks) {
			const marker = { worldX: b.x, sprites: [] }

			// Coordinate label at top corner
			const coordGen = () => `[0x${Math.floor(b.x + Math.random() * 16).toString(16).toUpperCase().padStart(3,'0')},0x${Math.floor(b.y + Math.random() * 8).toString(16).toUpperCase().padStart(2,'0')}]`
			const coordSprite = makeTextSprite(coordGen(), '#59e6d5', 16, 12)
			hudGroup.add(coordSprite)
			marker.sprites.push({ sprite: coordSprite, offsetX: 2, offsetY: b.y < HEIGHT / 2 ? b.h + 14 : -8, type: 'coord', gen: coordGen })

			// Dimension label
			const dimGen = () => `${Math.floor(b.w + Math.random() * 8).toString(16).toUpperCase().padStart(2,'0')}x${Math.floor(b.h + Math.random() * 8).toString(16).toUpperCase().padStart(2,'0')}`
			const dimSprite = makeTextSprite(dimGen(), '#445566', 14, 10)
			hudGroup.add(dimSprite)
			marker.sprites.push({ sprite: dimSprite, offsetX: b.w / 2 - 15, offsetY: b.y < HEIGHT / 2 ? b.h + 3 : -18, type: 'dim', gen: dimGen })

			// Hex ID
			const hexGen = () => '0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
			const hexSprite = makeTextSprite(hexGen(), '#334455', 14, 8)
			hudGroup.add(hexSprite)
			marker.sprites.push({ sprite: hexSprite, offsetX: b.w + 4, offsetY: b.h / 2, type: 'hex', gen: hexGen })

			// Corner bracket
			const corner = makeCornerMarker(10)
			hudGroup.add(corner)
			marker.sprites.push({ sprite: corner, offsetX: -1, offsetY: b.y < HEIGHT / 2 ? b.h + 1 : -1, type: 'corner' })

			hudMarkers.push(marker)
		}

		// Scattered data points between blocks
		for (let i = 0; i < worldWidth; i += 200 + Math.random() * 300) {
			const marker = { worldX: i, sprites: [] }
			const gen = dataGenerators[Math.floor(Math.random() * dataGenerators.length)]
			const y = 10 + Math.random() * (HEIGHT - 20)
			const sprite = makeTextSprite(gen(), '#445566', 14, 16)
			hudGroup.add(sprite)
			marker.sprites.push({ sprite, offsetX: 0, offsetY: y, type: 'data', absY: true, gen })

			// Small crosshair dot
			const dotGeo = new THREE.PlaneGeometry(5, 5)
			const dotMat = new THREE.MeshBasicMaterial({ color: 0x59e6d5, transparent: true, opacity: 0.2 })
			const dot = new THREE.Mesh(dotGeo, dotMat)
			dot.position.z = 0.02
			hudGroup.add(dot)
			marker.sprites.push({ sprite: dot, offsetX: -5, offsetY: y, type: 'dot', absY: true })

			hudMarkers.push(marker)
		}
	}
	generateHudMarkers()

	let width = 1, height = 1

	function resize() {
		const rect = container.getBoundingClientRect()
		width = rect.width
		height = rect.height
		renderer.setSize(width, height)
		renderer.setPixelRatio(window.devicePixelRatio)
		camera.right = width
		camera.top = height
		camera.updateProjectionMatrix()
		plane.scale.set(width, height, 1)
		plane.position.set(width / 2, height / 2, 0)
	}
	window.addEventListener('resize', resize)
	resize()

	const clock = new THREE.Clock()

	function animate() {
		requestAnimationFrame(animate)
		const dt = Math.min(clock.getDelta(), 0.1)

		scroll += 25 * dt
		if (scroll > worldWidth / 2) {
			scroll = 0
			generateTerrain()
			generateHudMarkers()
		}

		const now = clock.elapsedTime
		const scale = height / HEIGHT
		for (let i = 0; i < soldiers.length; i++) {
			const s = soldiers[i]
			let targetX = 10
			for (let j = 0; j < i; j++) {
				targetX += (j % 2 === 0) ? formationSpacing : 75
			}

			// X: simple smooth follow
			const newX = s.x + (targetX - s.x) * 0.1
			if (!isBlocked(newX, s.y, 8)) s.x = newX

			// Y: tween-based movement
			const tweenElapsed = now - s.tweenStart
			const tweenDone = tweenElapsed >= s.tweenDuration

			if (tweenDone) {
				s.y = s.toY
				// Only plan next move after cooldown
				if (now > s.cooldownUntil) {
					const nextY = findClearY(s.x, s.y)
					if (nextY !== null && Math.abs(nextY - s.y) > 5) {
						startTween(s, nextY, now)
					}
				}
			} else {
				const t = easeInOutCubic(tweenElapsed / s.tweenDuration)
				s.y = s.fromY + (s.toY - s.fromY) * t
			}

			// Emergency: stuck inside a block
			if (isBlocked(s.x, s.y, 8)) {
				for (let offset = 5; offset < HEIGHT; offset += 5) {
					if (s.y - offset > 10 && !isBlocked(s.x, s.y - offset, 8)) { s.y -= offset; break }
					if (s.y + offset < HEIGHT - 10 && !isBlocked(s.x, s.y + offset, 8)) { s.y += offset; break }
				}
				s.fromY = s.y
				s.toY = s.y
			}
		}

		const blockData = shadowMaterial.uniforms.u_blocks.value
		let numBlocks = 0
		for (const b of terrainBlocks) {
			const sx = (b.x - scroll) * scale
			if (sx > width + 100 || sx + b.w * scale < -100) continue
			if (numBlocks >= 32) break
			blockData[numBlocks * 4] = sx
			blockData[numBlocks * 4 + 1] = (HEIGHT - b.y - b.h) * scale
			blockData[numBlocks * 4 + 2] = b.w * scale
			blockData[numBlocks * 4 + 3] = b.h * scale
			numBlocks++
		}

		const lightData = shadowMaterial.uniforms.u_lights.value
		const leadSoldier = soldiers[3]
		const numLights = allLights ? soldiers.length : 1

		if (allLights) {
			for (let i = 0; i < soldiers.length; i++) {
				lightData[i * 2] = soldiers[i].x * scale
				lightData[i * 2 + 1] = (HEIGHT - soldiers[i].y) * scale
			}
		} else {
			lightData[0] = leadSoldier.x * scale
			lightData[1] = (HEIGHT - leadSoldier.y) * scale
		}

		shadowMaterial.uniforms.u_resolution.value.set(width, height)
		shadowMaterial.uniforms.u_numBlocks.value = numBlocks
		shadowMaterial.uniforms.u_numLights.value = numLights

		function isPointLit(px, py) {
			const lightSources = allLights ? soldiers : [leadSoldier]
			for (const light of lightSources) {
				const lx = light.x * scale
				const ly = (HEIGHT - light.y) * scale
				const dx = px - lx
				const dy = py - ly
				const dist = Math.sqrt(dx * dx + dy * dy)
				if (dist < 1) return true

				let blocked = false
				for (let i = 0; i < numBlocks; i++) {
					const bx = blockData[i * 4]
					const by = blockData[i * 4 + 1]
					const bw = blockData[i * 4 + 2]
					const bh = blockData[i * 4 + 3]

					const rdx = dx / dist
					const rdy = dy / dist
					const invRdx = 1 / rdx
					const invRdy = 1 / rdy
					const t1x = (bx - lx) * invRdx
					const t2x = (bx + bw - lx) * invRdx
					const t1y = (by - ly) * invRdy
					const t2y = (by + bh - ly) * invRdy
					const tminx = Math.min(t1x, t2x)
					const tmaxx = Math.max(t1x, t2x)
					const tminy = Math.min(t1y, t2y)
					const tmaxy = Math.max(t1y, t2y)
					const tNear = Math.max(tminx, tminy)
					const tFar = Math.min(tmaxx, tmaxy)
					if (tNear < tFar && tNear > 0.5 && tNear < dist) {
						blocked = true
						break
					}
				}
				if (!blocked) return true
			}
			return false
		}

		const time = performance.now() * 0.001

		for (let i = 0; i < soldiers.length; i++) {
			const s = soldiers[i]
			const mesh = soldierMeshes[i]
			const sx = s.x * scale
			const sy = (HEIGHT - s.y) * scale
			mesh.position.x = sx
			mesh.position.y = sy

			const hasLight = allLights || (s === leadSoldier)
			const inLight = isPointLit(sx, sy)

			if (hasLight) {
				mesh.material.color.setHex(TEAL)
				mesh.visible = true

				const waves = radioWaves[i]
				for (let w = 0; w < waves.length; w++) {
					const ring = waves[w]
					ring.position.x = sx
					ring.position.y = sy
					ring.visible = true

					const phase = ring.userData.phase
					const cycle = (time * 0.8 + phase) % (Math.PI * 2)
					const progress = cycle / (Math.PI * 2)
					const ringScale = 1 + progress * 3
					ring.scale.set(ringScale, ringScale, 1)
					ring.material.opacity = (1 - progress) * 0.5
				}
			} else if (inLight) {
				mesh.material.color.setHex(UNLIT)
				mesh.visible = true
				radioWaves[i].forEach(ring => ring.visible = false)
			} else {
				mesh.visible = false
				radioWaves[i].forEach(ring => ring.visible = false)
			}
		}

		// Update HUD markers
		const hudFlickerFrame = Math.floor(time * 3)
		for (const marker of hudMarkers) {
			const mx = (marker.worldX - scroll) * scale
			const visible = mx > -100 && mx < width + 100
			for (const s of marker.sprites) {
				s.sprite.visible = visible
				if (visible) {
					s.sprite.position.x = mx + s.offsetX * scale
					s.sprite.position.y = s.absY
						? (HEIGHT - s.offsetY) * scale
						: (HEIGHT - s.offsetY) * scale
					s.sprite.position.z = 0.08
					if (s.gen && hudFlickerFrame !== s._lastFrame) {
						s._lastFrame = hudFlickerFrame
						if (Math.random() < 0.15) {
							updateSpriteText(s.sprite, s.gen())
						}
					}
				}
			}
		}

		renderer.render(scene, camera)
	}

	animate()
}
