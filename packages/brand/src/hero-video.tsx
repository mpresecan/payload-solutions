import { VideoBackdrop } from './video-backdrop'

/** Where the hero loop lives. One file, shared by every site that runs the video. */
export const HERO_VIDEO_ORIGIN = 'https://cdn.payload.solutions'

/**
 * Served from each app's own public/ folder (payload.solutions and payloadstack.com both carry
 * a copy). It is frame 0 of the loop, so the hand-off from still to motion is invisible.
 */
export const HERO_VIDEO_POSTER = '/hero-poster.webp'

/**
 * The pinned hero video, configured once for every site: the same CDN file, the same poster,
 * played at half speed (a seamless 6.5s loop, ~13s per pass) so it stays ambient under the
 * hero's own animation. Server component: it preconnects to the CDN and preloads the poster
 * (plain <link> elements, which React 19 hoists into <head>, so the brand package needs no
 * react-dom dependency), then renders the client VideoBackdrop.
 *
 * Further encodes (AV1, VP9, a 720p phone cut) go in front of the MP4 once they are on the CDN;
 * the browser takes the first one it can play.
 *
 * Place it as the first child of the page's dark ThemeBand, and follow the band with
 * `relative z-10 bg-bg` so the sections after it slide over the video.
 */
export function HeroVideoBackdrop({ copyColumns = 1 }: { copyColumns?: 1 | 2 }) {
  return (
    <>
      <link rel="preconnect" href={HERO_VIDEO_ORIGIN} />
      <link rel="preload" as="image" href={HERO_VIDEO_POSTER} fetchPriority="high" />
      <VideoBackdrop
        poster={HERO_VIDEO_POSTER}
        playbackRate={0.5}
        copyColumns={copyColumns}
        sources={[{ src: `${HERO_VIDEO_ORIGIN}/hero-1080.mp4`, type: 'video/mp4' }]}
      />
    </>
  )
}
