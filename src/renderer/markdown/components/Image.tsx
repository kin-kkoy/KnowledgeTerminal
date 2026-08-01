/**
 * Images.
 *
 * The width/height already came from the pipeline, so the box is reserved on
 * the first frame and the document never shifts once the file decodes. This
 * component only adds the caption and click-to-zoom.
 */
import { useState } from 'react'
import styles from './Image.module.css'

interface Props {
  src?: string
  alt?: string
  title?: string
  width?: number
  height?: number
  'data-kt-missing'?: string
  'data-kt-asset'?: string
  [key: string]: unknown
}

export function Image(props: Props): React.JSX.Element {
  const { src, alt, title, width, height, ...rest } = props
  const [zoomed, setZoomed] = useState(false)
  const missing = props['data-kt-missing'] === 'true'

  if (missing || !src) {
    return (
      <span className={styles.missing} title={src}>
        Image not found: {alt || src}
      </span>
    )
  }

  return (
    <figure className={styles.figure}>
      <img
        src={src}
        alt={alt ?? ''}
        // Intrinsic size reserves the box. `height: auto` in the stylesheet lets
        // it scale down without distortion.
        width={width}
        height={height}
        className={zoomed ? styles.zoomed : styles.image}
        onClick={() => setZoomed((z) => !z)}
        {...rest}
      />
      {alt && <figcaption className={styles.caption}>{title ?? alt}</figcaption>}
    </figure>
  )
}
