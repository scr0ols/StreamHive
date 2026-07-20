// Tiny hand-written SVG icon set, stroke-based, inherits currentColor.
// Kept as plain components so there is no icon-library dependency.

function Icon({ children, size = 16, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function IconHeart(props) {
  return (
    <Icon {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Icon>
  )
}

export function IconGift(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </Icon>
  )
}

export function IconExternalLink(props) {
  return (
    <Icon {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Icon>
  )
}

export function IconX(props) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  )
}

export function IconVolumeOn(props) {
  return (
    <Icon {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </Icon>
  )
}

export function IconVolumeOff(props) {
  return (
    <Icon {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="m22 9-6 6" />
      <path d="m16 9 6 6" />
    </Icon>
  )
}

export function IconChat(props) {
  return (
    <Icon {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  )
}

export function IconChevronRight(props) {
  return (
    <Icon {...props}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  )
}

export function IconPlus(props) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Icon>
  )
}

export function IconBookmark(props) {
  return (
    <Icon {...props}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </Icon>
  )
}

export function IconTrash(props) {
  return (
    <Icon {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Icon>
  )
}

export function IconChevronDown(props) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function IconSettings(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  )
}

export function IconLogout(props) {
  return (
    <Icon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Icon>
  )
}

export function IconTwitch({ size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M4.3 1 2 6.4v15.2h5.2V24h2.9l2.4-2.4h4.4L22 16.5V1H4.3Zm15.6 14.5-2.8 2.8h-4.5l-2.4 2.4v-2.4H5.9V3.1h14v12.4ZM17 6.6v5.9h-2.1V6.6H17Zm-5.6 0v5.9h-2V6.6h2Z" />
    </svg>
  )
}

// Brand marks (Honeycomb). Fixed brand colors throughout, except the two
// "shadow" facets on the primary mark, which use --mark-shadow: the
// original near-black tone reads fine on the light theme but nearly
// disappears against the dark theme's near-black surfaces, so that one
// facet color swaps per theme (see index.css) while gold/rust stay put.
// The reduced mark has no shadow facet, so it needs no theme handling.
const MARK_VARIANTS = {
  reduced: {
    viewBox: '-12 -14.5 27 27',
    paths: [
      ['M 14 -5 L 9.5 2.79 L 0.5 2.79 L -4 -5 L 0.5 -12.79 L 9.5 -12.79 Z', '#D6841F'],
      ['M 7 3 L 2.5 10.79 L -6.5 10.79 L -11 3 L -6.5 -4.79 L 2.5 -4.79 Z', '#F5A623'],
    ],
  },
  primary: {
    viewBox: '-18 -18 36 36',
    paths: [
      ['M -0.04 -9 L -2.62 -4.53 L -7.78 -4.53 L -10.36 -9 L -7.78 -13.47 L -2.62 -13.47 Z', 'var(--mark-shadow)'],
      ['M -5.23 0 L -7.81 4.47 L -12.97 4.47 L -15.55 0 L -12.97 -4.47 L -7.81 -4.47 Z', 'var(--mark-shadow)'],
      ['M 10.36 9 L 7.78 13.47 L 2.62 13.47 L 0.04 9 L 2.62 4.53 L 7.78 4.53 Z', '#D6841F'],
      ['M 15.55 0 L 12.97 4.47 L 7.81 4.47 L 5.23 0 L 7.81 -4.47 L 12.97 -4.47 Z', '#D6841F'],
      ['M 5.16 0 L 2.58 4.47 L -2.58 4.47 L -5.16 0 L -2.58 -4.47 L 2.58 -4.47 Z', '#F5A623'],
    ],
  },
}

export function LogoMark({ size = 22, variant = 'reduced', className = '', ...rest }) {
  const { viewBox, paths } = MARK_VARIANTS[variant]
  return (
    <svg
      className={`logo-mark${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox={viewBox}
      role="img"
      aria-label="StreamHive"
      {...rest}
    >
      {paths.map(([d, fill]) => (
        <path key={d} d={d} fill={fill} />
      ))}
    </svg>
  )
}
