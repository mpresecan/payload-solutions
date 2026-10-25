import { VideoBackdrop } from './video-backdrop'

/** Where the hero loops live. */
export const HERO_VIDEO_ORIGIN = 'https://cdn.payload.solutions'

/**
 * One hero loop per site. `file` is on the CDN; `poster` is served from that site's own public/
 * folder and is frame 0 of its loop, so the hand-off from still to motion is invisible.
 *
 * Every loop is cut the same way: audio stripped, the tail cross-faded into the opening so it
 * repeats without a jump, 1080p H.264, played at HERO_VIDEO_PLAYBACK_RATE. solutions and stack
 * are 6.5s loops (~9.3s per pass at 0.7); clock is 4s (~5.7s per pass), because its source fades
 * to black at 5.25s and that fade was cut off.
 */
export const HERO_VIDEOS = {
  // Its light streak runs straight through the copy column (and across a phone's lead and
  // action rows), so it needs the strong scrim: measured 3.8:1 under white with the standard one.
  solutions: {
    file: 'hero-solutions-1080.mp4',
    poster: '/hero-solutions-poster.webp',
    scrim: 'strong',
  },
  stack: { file: 'hero-1080.mp4', poster: '/hero-poster.webp', scrim: 'standard' },
  // Amber patches cross a phone's full-width copy (2.1:1 under muted text with the standard
  // scrim); on desktop the two-column scrim alone holds it, see the strong scrim in tailwind.css.
  clock: { file: 'hero-clock-1080.mp4', poster: '/hero-clock-poster.webp', scrim: 'strong' },
} as const

export type HeroVideoId = keyof typeof HERO_VIDEOS

/**
 * Playback speed for every site's loop, slowed so the video stays ambient under the hero's own
 * animation. One value for all three sites.
 */
export const HERO_VIDEO_PLAYBACK_RATE = 0.7

/**
 * The pinned hero video, configured once: CDN file, poster, slowed so it stays ambient under
 * the hero's own animation. Server component: it preconnects to the CDN and preloads the poster
 * (plain <link> elements, which React 19 hoists into <head>, so the brand package needs no
 * react-dom dependency), then renders the client VideoBackdrop.
 *
 * Further encodes (AV1, VP9, a 720p phone cut) go in front of the MP4 once they are on the CDN;
 * the browser takes the first one it can play.
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
  const { file, poster, scrim } = HERO_VIDEOS[video]
  return (
    <>
      <link rel="preconnect" href={HERO_VIDEO_ORIGIN} />
      <link rel="preload" as="image" href={poster} fetchPriority="high" />
      <VideoBackdrop
        poster={poster}
        playbackRate={HERO_VIDEO_PLAYBACK_RATE}
        copyColumns={copyColumns}
        scrim={scrim}
        sources={[{ src: `${HERO_VIDEO_ORIGIN}/${file}`, type: 'video/mp4' }]}
      />
    </>
  )
}
