# public/

`noise.png` and `crt.gif` are the shared textures behind the `noise` and `crt` utilities in
`@payload-solutions/brand`. They are byte-identical to the copies in `apps/payload-stack-web`
and `apps/payload-solutions`; both utilities degrade to nothing if a file is missing, so a
failed copy shows up as a flatter page rather than as a broken one.
