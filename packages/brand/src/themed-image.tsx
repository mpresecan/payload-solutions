import Image, { type ImageProps, type StaticImageData } from 'next/image'

export interface ThemedImageProps extends Omit<ImageProps, 'src' | 'alt'> {
  light: StaticImageData | string
  dark: StaticImageData | string
  alt: string
}

/**
 * One screenshot, two renderings. Both variants are in the markup and the tokens decide
 * which one is displayed (`only-light` / `only-dark`), so the choice follows the nearest
 * themed ancestor, including a ThemeBand. Hidden variants are lazy and never load. Mark the
 * hero image `priority` only when it sits in a fixed-theme band, or both files will load.
 */
export function ThemedImage({ light, dark, alt, className, ...rest }: ThemedImageProps) {
  return (
    <>
      <Image src={light} alt={alt} className={`only-light ${className ?? ''}`} {...rest} />
      {/* display:none removes the hidden variant from the accessibility tree as well. */}
      <Image src={dark} alt={alt} className={`only-dark ${className ?? ''}`} {...rest} />
    </>
  )
}
