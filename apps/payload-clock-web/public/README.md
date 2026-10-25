# public/

`noise.png` and `crt.gif` are the shared textures behind the `noise` and `crt` utilities in
`@payload-solutions/brand`. They are byte-identical to the copies in `apps/payload-stack-web`
and `apps/payload-solutions`; both utilities degrade to nothing if a file is missing, so a
failed copy shows up as a flatter page rather than as a broken one.

## hero-clock-poster.webp

Frame 0 of this site's hero video (`https://cdn.payload.solutions/hero-clock-1080.mp4`, a 4s
seamless loop cut before the source's fade to black). `HeroVideoBackdrop video="clock"`
(`@payload-solutions/brand/hero-video`, where each site's file and poster are listed in
`HERO_VIDEOS`) preloads it and uses it as the `<video>` poster, and as the still that replaces
the video under `prefers-reduced-motion: reduce`. If the video is re-cut, re-export this from
frame 0 of the new loop or the hand-off from still to motion will jump.
