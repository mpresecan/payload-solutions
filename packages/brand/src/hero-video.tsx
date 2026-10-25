import { VideoBackdrop } from './video-backdrop'

/** Where the hero loops live. */
export const HERO_VIDEO_ORIGIN = 'https://cdn.payload.solutions'

/**
 * One hero loop per site. `file` (1080p) and `phone` (720p) are on the CDN; `poster` is served
 * from that site's own public/ folder and is frame 0 of its loop, so the hand-off from still to
 * motion is invisible.
 *
 * Every loop is cut the same way from its 24fps source: audio stripped, slowed to 0.7x IN THE
 * FILE and motion-interpolated to 60fps (ffmpeg minterpolate, mci), then the tail cross-faded
 * into the opening so it repeats without a jump; H.264 High, faststart. It plays at 1x. The
 * slowdown used to be a 0.7 playbackRate, which left 24fps footage showing ~17 frames a second
 * at uneven intervals: the judder. Do not slow these in the browser again; re-encode instead.
 *
 * Windows into each source (before the 0.7x): solutions 1.5-6.875s (the source freezes after
 * 6.83s, so it ends on the last moving frame), stack 1.5-8s, clock 1.25-5.25s (its source
 * fades to black at 5.25s). Loops run 6.4s, 8s and 4.7s.
 */
export const HERO_VIDEOS = {
  // Its light streak runs straight through the copy column (and across a phone's lead and
  // action rows), so it needs the strong scrim: measured 3.8:1 under white with the standard one.
  solutions: {
    file: 'hero-solutions-1080-60.mp4',
    phone: 'hero-solutions-720-60.mp4',
    poster: '/hero-solutions-poster.webp',
    scrim: 'strong',
  },
  stack: {
    file: 'hero-stack-1080-60.mp4',
    phone: 'hero-stack-720-60.mp4',
    poster: '/hero-poster.webp',
    scrim: 'standard',
  },
  // Amber patches cross a phone's full-width copy (2.1:1 under muted text with the standard
  // scrim); on desktop the two-column scrim alone holds it, see the strong scrim in tailwind.css.
  clock: {
    file: 'hero-clock-1080-60.mp4',
    phone: 'hero-clock-720-60.mp4',
    poster: '/hero-clock-poster.webp',
    scrim: 'strong',
  },
} as const

export type HeroVideoId = keyof typeof HERO_VIDEOS

/**
 * The pinned hero video, configured once: CDN files and poster. Server component: it
 * preconnects to the CDN and preloads the poster (plain <link> elements, which React 19 hoists into <head>, so the brand package needs no
 * react-dom dependency), then renders the client VideoBackdrop.
 *
 * Further encodes (AV1, VP9) go in front of the MP4s once they are on the CDN; the browser
 * takes the first one it can play.
 *
 * Place it as the first child of the page's dark ThemeBand, and follow the band with
 * `relative z-10 bg-bg` so the sections after it slide over the video.
 */
export function HeroVideoBackdrop({
  video,
  copyColumns = 1,
}: {
  video: HeroVideoId
  copyColumns?: 1 | 2
}) {
  const { file, phone, poster, scrim } = HERO_VIDEOS[video]
  return (
    <>
      <link rel="preconnect" href={HERO_VIDEO_ORIGIN} />
      <link rel="preload" as="image" href={poster} fetchPriority="high" />
      <VideoBackdrop
        poster={poster}
        copyColumns={copyColumns}
        scrim={scrim}
        sources={[
          // Phones first: the browser takes the first <source> whose media matches.
          { src: `${HERO_VIDEO_ORIGIN}/${phone}`, type: 'video/mp4', media: '(max-width: 767px)' },
          { src: `${HERO_VIDEO_ORIGIN}/${file}`, type: 'video/mp4' },
        ]}
      />
    </>
  )
}
