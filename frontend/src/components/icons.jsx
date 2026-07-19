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

export function IconTwitch({ size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M4.3 1 2 6.4v15.2h5.2V24h2.9l2.4-2.4h4.4L22 16.5V1H4.3Zm15.6 14.5-2.8 2.8h-4.5l-2.4 2.4v-2.4H5.9V3.1h14v12.4ZM17 6.6v5.9h-2.1V6.6H17Zm-5.6 0v5.9h-2V6.6h2Z" />
    </svg>
  )
}

export function LogoMark({ size = 22, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...rest}>
      <rect x="2.5" y="2.5" width="12" height="12" rx="2.5" fill="var(--accent)" />
      <rect x="17" y="2.5" width="4.5" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="17" y="10" width="4.5" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="17" width="4.5" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="17" width="4.5" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="17" y="17" width="4.5" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
