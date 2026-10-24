"use client";

import { ACCENT_COLORS } from "@payload-solutions/brand";
import { useReducedMotionSafe } from "@payload-solutions/brand/reduced-motion";
import {
	type CSSProperties,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import s from "./config-hero.module.css";

/**
 * The payload.solutions hero visual: a payload.config.ts that writes itself, and for every
 * plugin line that lands, the feature it adds flies into place around the editor as a small
 * piece of real UI. The pitch, shown instead of claimed: every SaaS feature is one line of
 * config away.
 *
 * Plain DOM and CSS 3D on purpose: the text stays crisp at every size, it costs nothing on a
 * phone, and there is no WebGL fallback path to maintain. The plugin calls are the real
 * exports of the packages in this repo, so the code is honest as well as pretty.
 *
 * Decorative (aria-hidden): the hero copy carries the message for assistive tech. Reduced
 * motion renders the finished state with no typing and no tilt.
 */

type Tone = "kw" | "fn" | "str" | "pn" | "id";
type Token = [Tone, string];
type CardId =
	| "auth"
	| "billing"
	| "tenants"
	| "consent"
	| "emails"
	| "scheduler"
	| "broadcasts"
	| "vercel";

const A = {
	stack: ACCENT_COLORS.stack.accent,
	consent: ACCENT_COLORS.consent.accent,
	emails: ACCENT_COLORS.emails.accent,
	scheduler: ACCENT_COLORS.scheduler.accent,
	vercel: ACCENT_COLORS.vercel.accent,
	solutions: ACCENT_COLORS.solutions.accent,
};

const LINES: { tokens: Token[]; cards?: CardId[]; color?: string }[] = [
	{
		tokens: [
			["kw", "export default "],
			["fn", "buildConfig"],
			["pn", "({"],
		],
	},
	{
		tokens: [
			["id", "  plugins"],
			["pn", ": ["],
		],
	},
	{
		tokens: [
			["fn", "    betterAuthPlugin"],
			["pn", "("],
			["id", "authOptions"],
			["pn", "),"],
		],
		cards: ["auth", "billing"],
		color: A.stack,
	},
	{
		tokens: [
			["fn", "    multiTenantPlugin"],
			["pn", "({ "],
			["id", "tenantsSlug"],
			["pn", " }),"],
		],
		cards: ["tenants"],
		color: A.stack,
	},
	{
		tokens: [
			["fn", "    consentPlugin"],
			["pn", "({ "],
			["id", "seed"],
			["pn", " }),"],
		],
		cards: ["consent"],
		color: A.consent,
	},
	{
		tokens: [
			["fn", "    emailsPlugin"],
			["pn", "({ "],
			["id", "emails"],
			["pn", " }),"],
		],
		cards: ["emails"],
		color: A.emails,
	},
	{
		tokens: [
			["fn", "    actionScheduler"],
			["pn", "({ "],
			["id", "actions"],
			["pn", " }),"],
		],
		cards: ["scheduler"],
		color: A.scheduler,
	},
	{
		tokens: [
			["fn", "    resendBroadcastsPlugin"],
			["pn", "({ "],
			["id", "from"],
			["pn", " }),"],
		],
		cards: ["broadcasts"],
		color: A.emails,
	},
	{
		tokens: [
			["fn", "    vercelPlugin"],
			["pn", "({ "],
			["id", "targets"],
			["pn", " }),"],
		],
		cards: ["vercel"],
		color: A.vercel,
	},
	{ tokens: [["pn", "  ],"]] },
	{ tokens: [["pn", "})"]] },
];

const LINE_LENGTHS = LINES.map((line) =>
	line.tokens.reduce((n, [, text]) => n + text.length, 0),
);

/** Scene coordinates are px in an 800 x 580 stage that is scaled to fit the element. */
const SCENE = { w: 800, h: 580 };
/**
 * Phones get a compact scene: the editor full width with one card slot under it that swaps
 * to each feature as its line lands. The full 3D spread at phone width scales to ~40% and the
 * card text stops being readable. Chosen by the host's own width, not a media query.
 */
const COMPACT_SCENE = { w: 360, h: 520 };
const COMPACT_BELOW = 560;
const COMPACT_SLOT = { x: 20, y: 312, w: 320 };
const CARDS: Record<
	CardId,
	{ x: number; y: number; z: number; w: number; color: string; body: ReactNode }
> = {
	auth: {
		x: 380,
		y: 0,
		z: -140,
		w: 196,
		color: A.stack,
		body: (
			<>
				<Kicker>Payload Stack · auth</Kicker>
				<div className={s.title}>Sign in to Acme</div>
				<div className={s.field}>ana@acme.com</div>
				<div className={s.field}>••••••••••</div>
				<div className={s.btn}>Continue</div>
				<div className={`${s.btn} ${s.ghost}`}>Continue with Google</div>
			</>
		),
	},
	billing: {
		x: 588,
		y: 64,
		z: -60,
		w: 176,
		color: A.stack,
		body: (
			<>
				<Kicker>Payload Stack · billing</Kicker>
				<div className={s.row}>
					<span className={s.title}>Pro</span>
					<Pill color={A.stack}>Current</Pill>
				</div>
				<div className={s.price}>
					€29<small> / month</small>
				</div>
				<div className={s.sub}>Seats used 7 of 10</div>
				<div className={s.bar} style={{ "--w": "70%" } as CSSProperties}>
					<i />
				</div>
			</>
		),
	},
	tenants: {
		x: 400,
		y: 262,
		z: 0,
		w: 190,
		color: A.stack,
		body: (
			<>
				<Kicker>Payload Stack · tenants</Kicker>
				<div className={s.li}>
					<span>Acme Inc</span>
					<span>✓ owner</span>
				</div>
				<div className={s.li}>
					<span>Globex</span>
					<span>admin</span>
				</div>
				<div className={s.li}>
					<span>Initech</span>
					<span>member</span>
				</div>
				<div className={s.li}>
					<span className={s.muted}>+ New organisation</span>
					<span />
				</div>
			</>
		),
	},
	consent: {
		x: 130,
		y: 6,
		z: -230,
		w: 232,
		color: A.consent,
		body: (
			<>
				<Kicker>Consent</Kicker>
				<div className={s.title}>We use cookies</div>
				<div className={s.sub}>
					Analytics helps us improve Acme. Marketing stays off until you say so.
				</div>
				<div className={s.row}>
					<div className={s.btn} style={{ flex: 1 }}>
						Accept all
					</div>
					<div className={`${s.btn} ${s.ghost}`} style={{ flex: 1 }}>
						Reject
					</div>
				</div>
			</>
		),
	},
	emails: {
		x: 612,
		y: 236,
		z: 50,
		w: 172,
		color: A.emails,
		body: (
			<>
				<Kicker>Emails</Kicker>
				<div className={s.sub}>To: ana@acme.com</div>
				<div className={s.title}>Welcome to Acme</div>
				<div className={s.sub}>
					Your workspace is ready. Invite your team to get started.
				</div>
				<div className={s.btn} style={{ background: A.emails }}>
					Open workspace
				</div>
			</>
		),
	},
	scheduler: {
		x: 350,
		y: 432,
		z: 120,
		w: 252,
		color: A.scheduler,
		body: (
			<>
				<Kicker>Action Scheduler</Kicker>
				<div className={s.li}>
					<span>send-day-3-tips</span>
					<span>in 2d 4h</span>
				</div>
				<div className={s.li}>
					<span>trial-ending-reminder</span>
					<span>Mon 09:00</span>
				</div>
				<div className={s.li}>
					<span>purge-expired-invites</span>
					<span>every 1h</span>
				</div>
			</>
		),
	},
	broadcasts: {
		x: 616,
		y: 420,
		z: -10,
		w: 184,
		color: A.emails,
		body: (
			<>
				<Kicker>Resend Broadcasts</Kicker>
				<div className={s.title}>October update</div>
				<div className={s.row}>
					<span className={s.sub}>12,480 recipients</span>
					<Pill color={A.emails}>Scheduled</Pill>
				</div>
			</>
		),
	},
	vercel: {
		x: 40,
		y: 486,
		z: 150,
		w: 252,
		color: A.vercel,
		body: (
			<>
				<Kicker>Vercel</Kicker>
				<div className={s.row}>
					<span className={s.title}>Production</span>
					<Pill color={A.consent}>● Ready</Pill>
				</div>
				<div className={s.sub}>acme.app · main · built in 41s</div>
			</>
		),
	},
};
const CARD_IDS = Object.keys(CARDS) as CardId[];
const ALL_CARDS: ReadonlySet<CardId> = new Set(CARD_IDS);
const lineOfCard = (id: CardId) =>
	LINES.findIndex((line) => line.cards?.includes(id));

const REST_TILT = { x: 14, y: -18 };
const COMPACT_TILT = { x: 6, y: -6 };

export function ConfigHero({ className }: { className?: string }) {
	const hostRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState<{
		s: number;
		left: number;
		top: number;
		compact: boolean;
	} | null>(null);
	const [typed, setTyped] = useState<number[]>(() => LINES.map(() => 0));
	const [shown, setShown] = useState<Set<CardId>>(() => new Set());
	const [latest, setLatest] = useState<CardId | null>(null);
	const [shipped, setShipped] = useState(false);
	const [cursorLine, setCursorLine] = useState(-1);
	const [hotLine, setHotLine] = useState(-1);
	const [tilt, setTilt] = useState(REST_TILT);
	// Reduced motion: render the finished state, no typing and no tilt.
	const reduceMotion = useReducedMotionSafe();
	const typedView = reduceMotion ? LINE_LENGTHS : typed;
	const shownView = reduceMotion ? ALL_CARDS : shown;
	const shippedView = reduceMotion || shipped;
	const latestView: CardId | null = reduceMotion ? "vercel" : latest;
	const compact = scale?.compact ?? false;
	const scene = compact ? COMPACT_SCENE : SCENE;
	const restTilt = compact ? COMPACT_TILT : REST_TILT;

	// Fit the fixed-size scene into whatever box the hero gives us.
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const fit = () => {
			const { width, height } = host.getBoundingClientRect();
			const isCompact = width < COMPACT_BELOW;
			const frame = isCompact ? COMPACT_SCENE : SCENE;
			// The tilt (rotateY) swings the right of the full scene towards the viewer, so it
			// projects wider than its box; reserve room for that and lean the scene left to match.
			const spare = isCompact ? 20 : 110;
			const k = Math.min(width / (frame.w + spare), height / (frame.h + 40));
			setScale({
				s: k,
				left: (width - frame.w * k) / 2 - (isCompact ? 0 : 30 * k),
				top: (height - frame.h * k) / 2,
				compact: isCompact,
			});
		};
		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(host);
		return () => ro.disconnect();
	}, []);

	// The typing loop. Cancellable, and it waits while the hero is off screen.
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		if (reduceMotion) return;
		let cancelled = false;
		let visible = true;
		let wake: (() => void) | null = null;
		const io = new IntersectionObserver(([entry]) => {
			visible = entry?.isIntersecting ?? true;
			if (visible && wake) {
				wake();
				wake = null;
			}
		});
		io.observe(host);
		const sleep = async (ms: number) => {
			await new Promise<void>((resolve) => setTimeout(resolve, ms));
			if (!visible) await new Promise<void>((resolve) => (wake = resolve));
		};

		const run = async () => {
			while (!cancelled) {
				setTyped(LINES.map(() => 0));
				setShown(new Set());
				setLatest(null);
				setShipped(false);
				await sleep(700);
				for (let i = 0; i < LINES.length && !cancelled; i++) {
					setCursorLine(i);
					for (let k = 0; k <= LINE_LENGTHS[i]! && !cancelled; k += 2) {
						const chars = Math.min(k, LINE_LENGTHS[i]!);
						setTyped((prev) => prev.map((v, j) => (j === i ? chars : v)));
						await sleep(18);
					}
					setTyped((prev) =>
						prev.map((v, j) => (j === i ? LINE_LENGTHS[i]! : v)),
					);
					const cards = LINES[i]!.cards ?? [];
					for (const id of cards) {
						if (cancelled) return;
						setShown((prev) => new Set(prev).add(id));
						setLatest(id);
						await sleep(170);
					}
					await sleep(cards.length ? 420 : 120);
				}
				setCursorLine(-1);
				await sleep(500);
				setShipped(true);
				await sleep(5200);
				if (cancelled) return;
				setShipped(false);
				for (const id of CARD_IDS) {
					setShown((prev) => {
						const next = new Set(prev);
						next.delete(id);
						return next;
					});
					await sleep(60);
				}
				await sleep(600);
			}
		};
		run();
		return () => {
			cancelled = true;
			io.disconnect();
		};
	}, [reduceMotion]);

	const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
		if (e.pointerType === "touch" || reduceMotion) return;
		const r = e.currentTarget.getBoundingClientRect();
		const nx = (e.clientX - r.left) / r.width - 0.5;
		const ny = (e.clientY - r.top) / r.height - 0.5;
		setTilt({ x: restTilt.x - ny * 10, y: restTilt.y + nx * 14 });
	};

	return (
		<div
			ref={hostRef}
			aria-hidden="true"
			className={`relative ${s.host} ${className ?? ""} lg:ml-20`}
			onPointerMove={onPointerMove}
			onPointerLeave={() => {
				setTilt(restTilt);
				setHotLine(-1);
			}}
		>
			<div
				className={s.scene}
				style={{
					width: scene.w,
					height: scene.h,
					transform: scale
						? `translate(${scale.left}px, ${scale.top}px) scale(${scale.s})`
						: undefined,
					visibility: scale ? "visible" : "hidden",
				}}
			>
				<div
					className={s.tilt}
					style={{
						transform: `rotateX(${(compact ? restTilt : tilt).x}deg) rotateY(${(compact ? restTilt : tilt).y}deg) rotateZ(1deg)`,
					}}
				>
					<div
						className={`${s.card} ${s.on} ${s.editor}`}
						style={
							{
								"--z": compact ? "20px" : "70px",
								"--c": A.solutions,
								...(compact
									? { left: 0, top: 0, width: COMPACT_SCENE.w }
									: null),
							} as CSSProperties
						}
					>
						<div className={s.tabbar}>
							<span className={s.current}>payload.config.ts</span>
							<span>package.json</span>
						</div>
						<div className={s.code}>
							{LINES.map((line, i) => (
								<span
									key={i}
									className={`${s.line} ${hotLine === i ? s.lineHot : ""}`}
									style={
										line.color
											? ({ "--lc": line.color } as CSSProperties)
											: undefined
									}
									onPointerEnter={() => line.cards && setHotLine(i)}
									onPointerLeave={() => setHotLine(-1)}
								>
									<span className={s.num}>{i + 1}</span>
									{clip(line.tokens, typedView[i] ?? 0)}
									{cursorLine === i ? <span className={s.caret} /> : null}
								</span>
							))}
						</div>
					</div>
					{CARD_IDS.map((id) => {
						const card = CARDS[id];
						const line = lineOfCard(id);
						const isOn = compact ? latestView === id : shownView.has(id);
						const box = compact
							? {
									left: COMPACT_SLOT.x,
									top: COMPACT_SLOT.y,
									width: COMPACT_SLOT.w,
									z: 0,
								}
							: { left: card.x, top: card.y, width: card.w, z: card.z };
						return (
							<div
								key={id}
								className={`${s.card} ${isOn ? s.on : ""} ${hotLine === line ? s.hot : ""}`}
								style={
									{
										left: box.left,
										top: box.top,
										width: box.width,
										"--z": `${box.z}px`,
										"--c": card.color,
									} as CSSProperties
								}
								onPointerEnter={() => setHotLine(line)}
								onPointerLeave={() => setHotLine(-1)}
							>
								{card.body}
							</div>
						);
					})}
				</div>
			</div>
			<div
				className={`${s.ship} ${shippedView ? s.shipOn : ""}`}
				style={
					scale
						? compact
							? {
									left: scale.left + 20 * scale.s,
									top: scale.top + 286 * scale.s,
								}
							: {
									left: scale.left + 40 * scale.s,
									top: scale.top + 452 * scale.s,
								}
						: undefined
				}
			>
				✓ Deployed to production · 41s
			</div>
		</div>
	);
}

function clip(tokens: Token[], count: number) {
	const out: ReactNode[] = [];
	let left = count;
	tokens.forEach(([tone, text], i) => {
		if (left <= 0) return;
		out.push(
			<span key={i} className={s[tone]}>
				{text.slice(0, left)}
			</span>,
		);
		left -= text.length;
	});
	return out;
}

function Kicker({ children }: { children: ReactNode }) {
	return <div className={s.kicker}>{children}</div>;
}

function Pill({ color, children }: { color: string; children: ReactNode }) {
	return (
		<span className={s.pill} style={{ "--c": color } as CSSProperties}>
			{children}
		</span>
	);
}
