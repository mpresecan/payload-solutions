'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotionSafe } from './reduced-motion'

/**
 * An ink field that holds the brand mark.
 *
 * The mark's silhouette is rasterised once into a mask texture; every frame the ink density
 * is advected by a velocity field and then relaxed back toward that mask, so the pointer tears
 * the mark apart and it reassembles itself rather than snapping back. Curl noise keeps the
 * field alive with no pointer at all, which is what touch devices and idle tabs see.
 *
 * Raw WebGL2 on purpose: two programs and a pair of ping-ponged RGBA8 targets at a fraction of
 * display resolution, so the hero costs the bundle nothing beyond this file. Colours are read
 * from the brand tokens at mount, so the field follows whatever ThemeBand it sits in.
 *
 * Degrades on every axis it has: no WebGL2 or a failed compile renders nothing and leaves the
 * static `children` fallback visible, `prefers-reduced-motion` settles onto the mark and stops
 * the loop, the loop is paused while the element is off-screen, and DPR is capped.
 */

export interface LiquidMarkOptions {
  /** How fast ink returns to the silhouette, per second. Lower is more liquid. */
  reform?: number
  /** Velocity retained per step, 0-1. Higher travels further. */
  viscosity?: number
  /** Momentum the pointer injects. 0 disables pointer interaction. */
  force?: number
  /** Width of the pointer disturbance, in UV units. */
  radius?: number
  /** Curl-noise motion with no pointer. */
  drift?: number
  /** How much accent colour the smear carries, 0-1. At rest the mark stays fg-coloured. */
  accentBleed?: number
  /** Fraction of the element's height the mark occupies on wide viewports. */
  scale?: number
  /** Mark centre in UV space on wide viewports. */
  origin?: [number, number]
}

export interface LiquidMarkProps extends LiquidMarkOptions {
  className?: string
  /** Rendered underneath the canvas and left visible when WebGL2 is unavailable. */
  children?: React.ReactNode
}

/** Michael's tuning, 2026-09-07: a wide, fast, mostly monochrome disturbance that snaps back. */
const DEFAULTS: Required<LiquidMarkOptions> = {
  reform: 4.8,
  viscosity: 0.9,
  force: 1.6,
  radius: 0.32,
  drift: 0.39,
  accentBleed: 0.32,
  scale: 0.52,
  origin: [0.68, 0.5],
}

/** packages/brand/assets/mark.svg, as path data plus the bounding box the paths actually fill. */
const MARK_PATHS = [
  'M10.5 3.49976L0.713097 8.15257V20.4896L8.2737 25.1999V12.8629L18 7.99976L10.5 3.49976Z',
  'M11 23.5V15L18 19.5L11 23.5Z',
]
const MARK_BOX = { x: 0.71, y: 3.5, w: 17.29, h: 21.7 }

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

const SIM = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPrev;
uniform sampler2D uMask;
uniform vec2 uPointer;
uniform vec2 uPointerVel;
uniform float uPointerAmp;
uniform float uAspect;
uniform float uDt;
uniform float uTime;
uniform float uVisc;
uniform float uReform;
uniform float uRadius;
uniform float uDrift;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 curl(vec2 p){
  float e = 0.09;
  float a = vnoise(p + vec2(0.0, e));
  float b = vnoise(p - vec2(0.0, e));
  float c = vnoise(p + vec2(e, 0.0));
  float d = vnoise(p - vec2(e, 0.0));
  return vec2(a - b, d - c) / (2.0 * e);
}

void main(){
  vec4 prev = texture(uPrev, vUv);
  vec2 vel = prev.rg * 2.0 - 1.0;

  // semi-Lagrangian advection of the velocity field by itself
  vec2 back = vUv - vel * uDt * 0.55;
  vec2 velA = texture(uPrev, back).rg * 2.0 - 1.0;
  vec2 nv = velA * uVisc;

  // ambient curl noise: the field lives without a pointer
  nv += curl(vUv * vec2(uAspect, 1.0) * 2.6 + uTime * 0.05) * uDrift * uDt;

  // pointer splat, aspect-corrected so the disturbance stays round
  vec2 d = (vUv - uPointer) * vec2(uAspect, 1.0);
  float fall = exp(-dot(d, d) / max(uRadius * uRadius, 1e-5));
  nv += uPointerVel * fall * uPointerAmp * uDt * 26.0;
  nv = clamp(nv, -1.0, 1.0);

  // ink: advected by the new velocity, then relaxed toward the silhouette
  float ink = texture(uPrev, vUv - nv * uDt * 0.55).b;
  float target = texture(uMask, vUv).r;
  ink = mix(ink, target, clamp(uReform * uDt, 0.0, 1.0));
  ink = clamp(ink + fall * uPointerAmp * length(uPointerVel) * uDt * 1.6, 0.0, 1.0);

  outColor = vec4(nv * 0.5 + 0.5, ink, 1.0);
}`

const RENDER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSim;
uniform float uAspect;
uniform float uGlow;
uniform vec2 uOrigin;
uniform vec3 uBg;
uniform vec3 uAccent;
uniform vec3 uInk;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

void main(){
  vec4 s = texture(uSim, vUv);
  vec2 vel = s.rg * 2.0 - 1.0;
  float ink = s.b;
  float speed = length(vel);

  // the --ambient-glow token, displaced by the field
  vec2 uvd = vUv - vel * 0.06;
  vec2 g = (uvd - uOrigin) * vec2(uAspect, 1.0);
  float glow = exp(-dot(g, g) * 2.1);
  vec3 col = uBg + uAccent * glow * 0.075;

  // accent in the smear, fg colour at the settled core
  float mid  = smoothstep(0.06, 0.55, ink);
  float core = smoothstep(0.74, 0.96, ink);
  col = mix(col, uAccent, mid * uGlow);
  col = mix(col, uInk, core);

  // velocity picks out a hot rim where the ink is being torn
  col += uAccent * clamp(speed * 2.2, 0.0, 1.0) * mid * (1.0 - core) * 0.5;

  // edge falloff so the canvas dissolves into the band rather than ending
  float fade = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x)
             * smoothstep(0.0, 0.09, vUv.y) * smoothstep(1.0, 0.91, vUv.y);
  col = mix(uBg, col, 0.22 + 0.78 * fade);

  // RGBA8 at these amplitudes bands without a dither
  col += (hash(vUv * 1024.0) - 0.5) * 0.004;

  outColor = vec4(col, 1.0);
}`

type Rgb = [number, number, number]

/** Reads a brand token (`#rrggbb`, `#rgb` or `rgb()/rgba()`) into 0-1 components. */
function parseColor(value: string, fallback: Rgb): Rgb {
  const v = value.trim()

  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)
  const hexDigits = hexMatch?.[1]
  if (hexDigits) {
    const h = hexDigits.length === 3 ? hexDigits.replace(/./g, (c) => c + c) : hexDigits
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ]
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(v)
  const rgbBody = rgbMatch?.[1]
  if (rgbBody) {
    const parts = rgbBody
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number)
    const [r, g, b] = parts
    if (r !== undefined && g !== undefined && b !== undefined && ![r, g, b].some(Number.isNaN)) {
      return [r / 255, g / 255, b / 255]
    }
  }

  return fallback
}

/**
 * Resolve a design token to an rgb triple.
 *
 * getComputedStyle().getPropertyValue() on a custom property hands back its *specified*
 * token sequence, not a colour: since the palette rewrite, `--bg` is `var(--base-1000)` and
 * `--accent` is a `light-dark()` pair, and both would come back as those literal strings and
 * fall through to the hard-coded fallback. Painting the token onto a real colour property
 * and reading that back makes the engine do the substitution — including light-dark(), which
 * resolves against the host's inherited color-scheme, so the mark is lit in the accent of
 * whichever brand and whichever band it is standing in.
 */
function resolveToken(host: HTMLElement, name: string, fallback: Rgb): Rgb {
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none'
  probe.style.color = `var(${name})`
  host.appendChild(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return parseColor(value, fallback)
}

export function LiquidMark({ className, children, ...overrides }: LiquidMarkProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = useReducedMotionSafe()

  // Options are read through a ref so tuning them never tears down the GL context.
  const optsRef = useRef<Required<LiquidMarkOptions>>({ ...DEFAULTS, ...overrides })
  optsRef.current = { ...DEFAULTS, ...overrides }

  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    /**
     * Everything below runs again on `webglcontextrestored`, and a second time immediately
     * under React Strict Mode. `canvas.getContext` hands back the SAME context object every
     * time, so this must never leave that context unusable — see the teardown.
     */
    const setup = (): (() => void) | null => {
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'low-power',
      })
      // No WebGL2, or a context we can no longer draw on: leave `children` showing.
      if (!gl || gl.isContextLost()) return null

      const bg: Rgb = resolveToken(host, '--bg', [0, 0, 0])
      const accent: Rgb = resolveToken(host, '--accent', [0.357, 0.616, 1])
      const ink: Rgb = resolveToken(host, '--fg', [1, 1, 1])

      const compile = (type: number, src: string) => {
        const sh = gl.createShader(type)!
        gl.shaderSource(sh, src)
        gl.compileShader(sh)
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(sh)
          console.error(
            `[LiquidMark] ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader failed:`,
            log || (gl.isContextLost() ? 'WebGL context lost' : 'no info log'),
          )
          gl.deleteShader(sh)
          return null
        }
        return sh
      }

      const link = (fragSrc: string) => {
        const v = compile(gl.VERTEX_SHADER, VERT)
        const f = compile(gl.FRAGMENT_SHADER, fragSrc)
        if (!v || !f) return null
        const p = gl.createProgram()!
        gl.attachShader(p, v)
        gl.attachShader(p, f)
        gl.bindAttribLocation(p, 0, 'aPos')
        gl.linkProgram(p)
        gl.deleteShader(v)
        gl.deleteShader(f)
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          console.error(
            '[LiquidMark] link failed:',
            gl.getProgramInfoLog(p) || (gl.isContextLost() ? 'WebGL context lost' : 'no info log'),
          )
          gl.deleteProgram(p)
          return null
        }
        const u: Record<string, WebGLUniformLocation | null> = {}
        const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number
        for (let i = 0; i < n; i++) {
          const name = gl.getActiveUniform(p, i)!.name
          u[name] = gl.getUniformLocation(p, name)
        }
        return { p, u }
      }

      const simProg = link(SIM)
      const renderProg = link(RENDER)
      if (!simProg || !renderProg) {
        if (simProg) gl.deleteProgram(simProg.p)
        if (renderProg) gl.deleteProgram(renderProg.p)
        return null
      }

      // Only reveal the canvas once there is something that can actually draw on it.
      canvas.style.visibility = 'visible'

      const vao = gl.createVertexArray()
      gl.bindVertexArray(vao)
      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

      type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer }

      const makeTarget = (w: number, h: number): Target => {
        const tex = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        const fbo = gl.createFramebuffer()!
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
        gl.clearColor(0.5, 0.5, 0.0, 1.0) // velocity 0, ink 0 — the mark forms in on load
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        return { tex, fbo }
      }

      const maskTex = gl.createTexture()!

      const buildMask = (w: number, h: number) => {
        const { scale, origin } = optsRef.current
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, w, h)

        const wide = w / h > 1.35
        const targetH = h * (wide ? scale : scale * 0.7)
        const k = targetH / MARK_BOX.h
        ctx.save()
        ctx.translate(w * (wide ? origin[0] : 0.5), h * (wide ? origin[1] : 0.62))
        ctx.scale(k, k)
        ctx.translate(-(MARK_BOX.x + MARK_BOX.w / 2), -(MARK_BOX.y + MARK_BOX.h / 2))
        ctx.fillStyle = '#fff'
        for (const d of MARK_PATHS) ctx.fill(new Path2D(d))
        ctx.restore()

        gl.bindTexture(gl.TEXTURE_2D, maskTex)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      }

      let rect: DOMRect = host.getBoundingClientRect()
      const refreshRect = () => {
        rect = host.getBoundingClientRect()
      }

      let a: Target | null = null
      let b: Target | null = null
      let simW = 0
      let simH = 0
      let settled = 0

      const resize = () => {
        const rect = host.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)

        const k = Math.min(1, 420 / Math.max(rect.width, rect.height))
        simW = Math.max(64, Math.round(rect.width * k))
        simH = Math.max(64, Math.round(rect.height * k))

        for (const t of [a, b]) {
          if (t) {
            gl.deleteTexture(t.tex)
            gl.deleteFramebuffer(t.fbo)
          }
        }
        a = makeTarget(simW, simH)
        b = makeTarget(simW, simH)
        buildMask(simW, simH)
        refreshRect()
        settled = 0
      }

      const ptr = { x: 0.5, y: 0.5, vx: 0, vy: 0, amp: 0, seen: false }

      // The canvas sits behind the hero copy, so it never receives its own pointer events.
      // Track on the window against a cached rect instead, refreshed on resize and scroll.
      const onMove = (e: PointerEvent) => {
        if (!rect.width || !rect.height) return
        const nx = (e.clientX - rect.left) / rect.width
        const ny = 1 - (e.clientY - rect.top) / rect.height
        if (nx < -0.15 || nx > 1.15 || ny < -0.15 || ny > 1.15) {
          ptr.amp = 0
          ptr.seen = false
          return
        }
        if (ptr.seen) {
          ptr.vx = nx - ptr.x
          ptr.vy = ny - ptr.y
          ptr.amp = 1
        }
        ptr.x = nx
        ptr.y = ny
        ptr.seen = true
        if (!running) start()
      }

      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('scroll', refreshRect, { passive: true })
      window.addEventListener('resize', refreshRect)

      let raf = 0
      let running = false
      let visible = true
      let last = 0
      let time = 0

      const step = (dt: number, reform: number, drift: number) => {
        const o = optsRef.current
        gl.bindFramebuffer(gl.FRAMEBUFFER, b!.fbo)
        gl.viewport(0, 0, simW, simH)
        gl.useProgram(simProg.p)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, a!.tex)
        gl.uniform1i(simProg.u.uPrev!, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, maskTex)
        gl.uniform1i(simProg.u.uMask!, 1)
        gl.uniform2f(simProg.u.uPointer!, ptr.x, ptr.y)
        gl.uniform2f(simProg.u.uPointerVel!, ptr.vx, ptr.vy)
        gl.uniform1f(simProg.u.uPointerAmp!, ptr.amp * o.force)
        gl.uniform1f(simProg.u.uAspect!, simW / simH)
        gl.uniform1f(simProg.u.uDt!, dt)
        gl.uniform1f(simProg.u.uTime!, time)
        gl.uniform1f(simProg.u.uVisc!, o.viscosity)
        gl.uniform1f(simProg.u.uReform!, reform)
        gl.uniform1f(simProg.u.uRadius!, o.radius)
        gl.uniform1f(simProg.u.uDrift!, drift)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        const t = a
        a = b
        b = t
      }

      const draw = () => {
        const o = optsRef.current
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.useProgram(renderProg.p)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, a!.tex)
        gl.uniform1i(renderProg.u.uSim!, 0)
        gl.uniform1f(renderProg.u.uAspect!, canvas.width / canvas.height)
        gl.uniform1f(renderProg.u.uGlow!, o.accentBleed)
        gl.uniform2f(renderProg.u.uOrigin!, o.origin[0], o.origin[1])
        gl.uniform3f(renderProg.u.uBg!, bg[0], bg[1], bg[2])
        gl.uniform3f(renderProg.u.uAccent!, accent[0], accent[1], accent[2])
        gl.uniform3f(renderProg.u.uInk!, ink[0], ink[1], ink[2])
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }

      const frame = (now: number) => {
        if (!visible || !a || !b) {
          running = false
          return
        }
        const dt = Math.min((now - last) / 1000, 1 / 30)
        last = now
        time += dt

        if (reducedRef.current) {
          // settle onto the mark, then stop the loop entirely
          ptr.amp = 0
          step(dt, 12, 0)
          draw()
          if (++settled > 45) {
            running = false
            return
          }
        } else {
          settled = 0
          const o = optsRef.current
          step(dt, o.reform, o.drift)
          draw()
          ptr.vx *= 0.86
          ptr.vy *= 0.86
          ptr.amp *= 0.92
        }
        raf = requestAnimationFrame(frame)
      }

      function start() {
        if (running) return
        running = true
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }

      const io =
        typeof IntersectionObserver !== 'undefined'
          ? new IntersectionObserver(
              (entries) => {
                visible = entries.some((entry) => entry.isIntersecting)
                if (visible) start()
              },
              { threshold: 0 },
            )
          : null
      io?.observe(host)

      let resizeTimer: ReturnType<typeof setTimeout> | null = null
      const ro = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          resize()
          start()
        }, 160)
      })
      ro.observe(host)

      resize()
      start()

      return () => {
        cancelAnimationFrame(raf)
        running = false
        io?.disconnect()
        ro.disconnect()
        if (resizeTimer) clearTimeout(resizeTimer)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('scroll', refreshRect)
        window.removeEventListener('resize', refreshRect)
        canvas.style.visibility = 'hidden'
        // Free the objects but leave the context alive: it is cached on the canvas element and
        // shared with every later mount, so losing it here would break the Strict Mode remount.
        if (gl.isContextLost()) return
        for (const t of [a, b]) {
          if (t) {
            gl.deleteTexture(t.tex)
            gl.deleteFramebuffer(t.fbo)
          }
        }
        gl.deleteTexture(maskTex)
        gl.deleteBuffer(buf)
        gl.deleteVertexArray(vao)
        gl.deleteProgram(simProg.p)
        gl.deleteProgram(renderProg.p)
      }
    }

    let teardown = setup()

    // A driver reset shouldn't leave a dead canvas on the page: preventDefault makes the
    // context restorable, and the restore event rebuilds everything from scratch.
    const onContextLost = (e: Event) => {
      e.preventDefault()
      teardown?.()
      teardown = null
    }
    const onContextRestored = () => {
      teardown = setup()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      teardown?.()
    }
    // The context is per-canvas; tuning flows through optsRef, theme through the band.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      {children}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        style={{ visibility: 'hidden' }}
      />
    </div>
  )
}
