import { normalizeGlassOptics, OPTICS_CONTROLS } from './liquid-optics'
import type { GlassOptics, GlassTone } from './liquid-optics'
import { liquidLensFragmentShader, liquidLensVertexShader } from './liquid-lens-shader'

type Rectangle = { left: number; top: number; width: number; height: number }
type WallpaperSource = { canvas: HTMLCanvasElement; profile: Float32Array; height: number }
type SharedSource = {
  references: number
  disposed: boolean
  releaseTimer: number
  image: HTMLImageElement
  source: WallpaperSource | null
  ready: Promise<WallpaperSource>
  reject: (reason: Error) => void
}
const sourcePool = new Map<string, SharedSource>()
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback

export function coverImageRectangle(box: Rectangle, imageWidth: number, imageHeight: number): Rectangle {
  const scale = Math.max(box.width / imageWidth, box.height / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height }
}

export function lensBufferSize(width: number, height: number, deviceRatio: number) {
  width = Math.max(1, finite(width, 1))
  height = Math.max(1, finite(height, 1))
  const ratio = Math.min(Math.max(1, finite(deviceRatio, 1)), 1.5, 1280 / Math.max(width, height), Math.sqrt(650_000 / (width * height)))
  return { width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) }
}

export function lensWallpaperFilter(tone: GlassTone, brightness: number) {
  const value = Math.min(100, Math.max(0, finite(brightness, 72)))
  const base = `brightness(${Number((.68 + value / 200).toFixed(3))})`
  if (tone === 'blue') return `${base} sepia(.7) hue-rotate(160deg) saturate(1.3)`
  if (tone === 'dusk') return `${base} sepia(.5) hue-rotate(305deg) saturate(1.3)`
  return base
}

/** A single bounded image decode and CPU tint profile, shared by all lenses. */
function acquireWallpaper(url: string) {
  let record = sourcePool.get(url)
  if (!record) {
    const image = new Image()
    image.decoding = 'async'
    let resolve!: (source: WallpaperSource) => void
    let reject!: (reason: Error) => void
    const ready = new Promise<WallpaperSource>((accept, fail) => { resolve = accept; reject = fail })
    record = { references: 0, disposed: false, releaseTimer: 0, image, source: null, ready, reject }
    const entry = record
    sourcePool.set(url, entry)
    image.onload = () => {
      if (entry.disposed) return
      try {
        const scale = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight), Math.sqrt(1_400_000 / (image.naturalWidth * image.naturalHeight)))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Wallpaper sampling unavailable')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        // The upstream shader repeats hundreds of horizontal tint samples in
        // every fragment. Cache their row averages once instead.
        const profileCanvas = document.createElement('canvas')
        profileCanvas.width = 64
        profileCanvas.height = canvas.height
        const profileContext = profileCanvas.getContext('2d', { willReadFrequently: true })
        if (!profileContext) throw new Error('Wallpaper color profile unavailable')
        profileContext.drawImage(canvas, 0, 0, 64, canvas.height)
        const { data } = profileContext.getImageData(0, 0, 64, canvas.height)
        const profile = new Float32Array(canvas.height * 3)
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < 64; x++) {
            const offset = (y * 64 + x) * 4
            for (let channel = 0; channel < 3; channel++) profile[y * 3 + channel] += data[offset + channel] / (64 * 255)
          }
        }
        profileCanvas.width = profileCanvas.height = 1
        entry.source = { canvas, profile, height: canvas.height }
        image.onload = image.onerror = null
        image.src = ''
        resolve(entry.source)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Wallpaper processing failed'))
      }
    }
    image.onerror = () => reject(new Error('Wallpaper unavailable'))
    image.src = url
  }
  const shared = record
  shared.references++
  if (shared.releaseTimer) window.clearTimeout(shared.releaseTimer)
  shared.releaseTimer = 0
  let released = false
  return {
    ready: shared.ready,
    release() {
      if (released) return
      released = true
      shared.references--
      if (shared.references !== 0) return
      // Defer one task so React StrictMode's immediate remount can reuse the
      // same source rather than start additional decodes.
      shared.releaseTimer = window.setTimeout(() => {
        shared.releaseTimer = 0
        if (shared.references !== 0) return
        shared.disposed = true
        shared.image.onload = shared.image.onerror = null
        shared.image.src = ''
        if (shared.source) shared.source.canvas.width = shared.source.canvas.height = 1
        shared.source = null
        sourcePool.delete(url)
        shared.reject(new Error('Wallpaper source released'))
      }, 0)
    },
  }
}

export function sampleProfileColor(profile: Float32Array, height: number, y: number): [number, number, number] {
  const center = Math.round(Math.min(1, Math.max(0, y)) * (height - 1))
  const color: [number, number, number] = [0, 0, 0]
  for (let row = -5; row <= 5; row++) {
    const offset = Math.max(0, Math.min(height - 1, center + row)) * 3
    for (let channel = 0; channel < 3; channel++) color[channel] += profile[offset + channel] / 11
  }
  return color
}

export function resolveLensRadius(requested: number, computedRadius: string, width: number, height: number) {
  if (Number.isFinite(requested) && requested >= 0) return Math.min(requested, width / 2, height / 2)
  const [horizontal = '0', vertical = horizontal] = computedRadius.trim().split(/\s+/)
  const pixels = (value: string, dimension: number) => {
    const amount = Number.parseFloat(value)
    return Number.isFinite(amount) ? Math.max(0, value.endsWith('%') ? amount / 100 * dimension : amount) : 0
  }
  return Math.min(pixels(horizontal, width), pixels(vertical, height), width / 2, height / 2)
}

type LensSurface = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  radius: number
  optics: GlassOptics
}
type SharedRenderer = {
  stopped: boolean
  surfaces: Set<LensSurface>
  releaseTimer: number
  schedule: () => void
  observe: (surface: LensSurface) => void
  unobserve: (surface: LensSurface) => void
  destroy: () => void
}
const rendererPool = new Map<string, SharedRenderer>()

/** One GPU context + wallpaper texture; surface canvases receive a 2D copy. */
function makeSharedRenderer(imageUrl: string): SharedRenderer | null {
  const gpuCanvas = document.createElement('canvas')
  let gl: WebGLRenderingContext | null
  try {
    gl = gpuCanvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' })
  } catch { return null }
  if (!gl || gl.isContextLost()) return null
  const context = gl
  let disposed = false
  let raf = 0
  let settleTimer = 0
  let source: WallpaperSource | null = null
  const shaders: WebGLShader[] = []
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let texture: WebGLTexture | null = null
  const deleteResources = () => {
    context.useProgram(null)
    context.bindBuffer(context.ARRAY_BUFFER, null)
    context.bindTexture(context.TEXTURE_2D, null)
    if (buffer) context.deleteBuffer(buffer)
    if (texture) context.deleteTexture(texture)
    if (program) context.deleteProgram(program)
    shaders.splice(0).forEach(shader => context.deleteShader(shader))
    buffer = texture = program = null
  }
  try {
    const compile = (type: number, code: string) => {
      const shader = context.createShader(type)
      if (!shader) throw new Error('Shader unavailable')
      shaders.push(shader)
      context.shaderSource(shader, code)
      context.compileShader(shader)
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) throw new Error('Shader compilation failed')
      return shader
    }
    program = context.createProgram()
    if (!program) throw new Error('Program unavailable')
    context.attachShader(program, compile(context.VERTEX_SHADER, liquidLensVertexShader))
    context.attachShader(program, compile(context.FRAGMENT_SHADER, liquidLensFragmentShader))
    context.linkProgram(program)
    if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error('Shader linking failed')
    context.useProgram(program)
    buffer = context.createBuffer()
    texture = context.createTexture()
    if (!buffer || !texture) throw new Error('Graphics allocation failed')
    context.bindBuffer(context.ARRAY_BUFFER, buffer)
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), context.STATIC_DRAW)
    const position = context.getAttribLocation(program, 'a_position')
    context.enableVertexAttribArray(position)
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)
    context.bindTexture(context.TEXTURE_2D, texture)
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR)
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR)
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
    context.uniform1i(context.getUniformLocation(program, 'u_image'), 0)
  } catch {
    deleteResources()
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  }

  const uniforms = Object.fromEntries([
    'resolution', 'origin', 'imageOrigin', 'imageSize', 'topColor', 'midColor', 'bottomColor', 'radius', 'warp',
    ...OPTICS_CONTROLS.map(({ key }) => key),
  ].map(key => [key, context.getUniformLocation(program!, `u_${key}`)]))
  const shared = acquireWallpaper(imageUrl)
  const surfaces = new Set<LensSurface>()
  const draw = () => {
    raf = 0
    if (disposed || engine.stopped || !source || document.hidden || !surfaces.size) return
    // Read all geometry before resizing/copying any canvas to avoid repeated
    // layout flushes. Hidden and off-viewport surfaces consume no GPU draws.
    const visible = [...surfaces].flatMap(surface => {
      const { canvas } = surface
      if (!canvas.isConnected) return []
      const rect = canvas.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return []
      const style = canvas.parentElement ? getComputedStyle(canvas.parentElement) : null
      if (style?.visibility === 'hidden' || style?.display === 'none') return []
      return [{ surface, rect, size: lensBufferSize(rect.width, rect.height, window.devicePixelRatio), radius: resolveLensRadius(surface.radius, style?.borderTopLeftRadius || style?.borderRadius || '0', rect.width, rect.height) }]
    })
    if (!visible.length) return
    // Reuse one sufficiently large framebuffer for the entire batch. Each lens
    // occupies a lower-left viewport, copied immediately into its own canvas.
    const width = Math.max(...visible.map(item => item.size.width))
    const height = Math.max(...visible.map(item => item.size.height))
    if (gpuCanvas.width !== width || gpuCanvas.height !== height) {
      gpuCanvas.width = width
      gpuCanvas.height = height
    }
    const wallpaper = document.querySelector('.lab .wallpaper')
    const box = wallpaper?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    const imageRect = coverImageRectangle(box, source.canvas.width, source.canvas.height)
    context.uniform2f(uniforms.imageOrigin, imageRect.left, imageRect.top)
    context.uniform2f(uniforms.imageSize, imageRect.width, imageRect.height)
    for (const item of visible) {
      const { surface, rect, size, radius } = item
      const { canvas, context: output, optics } = surface
      if (canvas.width !== size.width || canvas.height !== size.height) {
        canvas.width = size.width
        canvas.height = size.height
      }
      context.viewport(0, 0, size.width, size.height)
      context.uniform2f(uniforms.resolution, rect.width, rect.height)
      context.uniform2f(uniforms.origin, rect.left, rect.top)
      context.uniform1f(uniforms.radius, radius)
      context.uniform1f(uniforms.warp, optics.warp ? 1 : 0)
      for (const { key } of OPTICS_CONTROLS) context.uniform1f(uniforms[key], optics[key])
      for (const [key, fraction] of [['topColor', .1], ['midColor', .5], ['bottomColor', .9]] as const) {
        const normalizedY = (rect.top + rect.height * fraction - imageRect.top) / imageRect.height
        const [r, g, b] = sampleProfileColor(source.profile, source.height, normalizedY)
        context.uniform3f(uniforms[key], r, g, b)
      }
      context.drawArrays(context.TRIANGLES, 0, 6)
      output.clearRect(0, 0, size.width, size.height)
      // WebGL viewports originate bottom-left; drawImage source rectangles
      // originate top-left. The y offset preserves upright wallpaper mapping.
      output.drawImage(gpuCanvas, 0, gpuCanvas.height - size.height, size.width, size.height, 0, 0, size.width, size.height)
      canvas.dataset.lensReady = 'true'
    }
  }
  const schedule = () => { if (!disposed && !engine.stopped && !document.hidden && !raf && surfaces.size) raf = requestAnimationFrame(draw) }
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
  window.addEventListener('resize', schedule, { passive: true })
  window.addEventListener('scroll', schedule, { passive: true, capture: true })
  document.addEventListener('visibilitychange', schedule)
  document.addEventListener('transitionend', schedule)
  document.addEventListener('animationend', schedule)
  document.addEventListener('liquid-glass-refresh', schedule)
  const removeListeners = () => {
    observer?.disconnect()
    window.removeEventListener('resize', schedule)
    window.removeEventListener('scroll', schedule, true)
    document.removeEventListener('visibilitychange', schedule)
    document.removeEventListener('transitionend', schedule)
    document.removeEventListener('animationend', schedule)
    document.removeEventListener('liquid-glass-refresh', schedule)
    if (raf) cancelAnimationFrame(raf)
    if (settleTimer) window.clearTimeout(settleTimer)
    raf = settleTimer = 0
  }
  const stop = () => {
    engine.stopped = true
    source = null
    for (const { canvas, context: output } of surfaces) {
      canvas.dataset.lensReady = 'false'
      output.clearRect(0, 0, canvas.width, canvas.height)
    }
    removeListeners()
    deleteResources()
    shared.release()
  }
  const onLost = (event: Event) => { event.preventDefault(); stop() }
  const engine: SharedRenderer = {
    stopped: false,
    surfaces,
    releaseTimer: 0,
    schedule,
    observe(surface) { observer?.observe(surface.canvas); schedule() },
    unobserve(surface) { observer?.unobserve(surface.canvas) },
    destroy() {
      disposed = true
      if (engine.releaseTimer) window.clearTimeout(engine.releaseTimer)
      engine.releaseTimer = 0
      gpuCanvas.removeEventListener('webglcontextlost', onLost)
      stop()
      context.getExtension('WEBGL_lose_context')?.loseContext()
      gpuCanvas.width = gpuCanvas.height = 1
    },
  }
  gpuCanvas.addEventListener('webglcontextlost', onLost)
  shared.ready.then(loaded => {
    if (disposed || engine.stopped) return
    try {
      context.bindTexture(context.TEXTURE_2D, texture)
      context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, loaded.canvas)
      source = loaded
      schedule()
      settleTimer = window.setTimeout(schedule, 850)
    } catch { stop() }
  }).catch(() => { if (!disposed && !engine.stopped) stop() })
  return engine
}

export function createLiquidLens(canvas: HTMLCanvasElement, imageUrl: string) {
  if (typeof window.WebGLRenderingContext === 'undefined') return null
  let output: CanvasRenderingContext2D | null
  try { output = canvas.getContext('2d', { alpha: true }) } catch { return null }
  if (!output) return null
  let engine = rendererPool.get(imageUrl)
  if (!engine) {
    engine = makeSharedRenderer(imageUrl) ?? undefined
    if (!engine) return null
    rendererPool.set(imageUrl, engine)
  }
  if (engine.stopped) return null
  const shared = engine
  if (shared.releaseTimer) window.clearTimeout(shared.releaseTimer)
  shared.releaseTimer = 0
  const surface: LensSurface = { canvas, context: output, radius: 40, optics: normalizeGlassOptics({}) }
  shared.surfaces.add(surface)
  shared.observe(surface)
  let disposed = false
  return {
    update(nextRadius: number, nextOptics: GlassOptics) {
      if (disposed) return
      surface.radius = finite(nextRadius, 40)
      surface.optics = normalizeGlassOptics(nextOptics)
      shared.schedule()
    },
    destroy() {
      if (disposed) return
      disposed = true
      shared.unobserve(surface)
      shared.surfaces.delete(surface)
      canvas.dataset.lensReady = 'false'
      output.clearRect(0, 0, canvas.width, canvas.height)
      if (shared.surfaces.size !== 0) return
      // Survive StrictMode cleanup/remount within a single task; the shared GPU
      // context is destroyed only when the last user actually stays gone.
      shared.releaseTimer = window.setTimeout(() => {
        shared.releaseTimer = 0
        if (shared.surfaces.size !== 0) return
        shared.destroy()
        rendererPool.delete(imageUrl)
      }, 0)
    },
  }
}
