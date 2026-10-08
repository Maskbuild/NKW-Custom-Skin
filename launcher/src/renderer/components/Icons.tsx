import type { ReactNode, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 16, children, ...rest }: P & { children: ReactNode }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  )
}

export const IHome = (p: P) => <Svg {...p}><path d="M3 11l9-8 9 8M5 10v10h14V10" /></Svg>
export const IPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const IFolder = (p: P) => <Svg {...p}><path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></Svg>
export const ISettings = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" /></Svg>
export const IX = (p: P) => <Svg {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>
export const IUndo = (p: P) => <Svg {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></Svg>
export const IRedo = (p: P) => <Svg {...p}><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></Svg>
export const IPlay = (p: P) => <Svg {...p}><path d="M6 4l14 8-14 8z" fill="currentColor" /></Svg>
export const IStop = (p: P) => <Svg {...p}><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" /></Svg>
export const IDownload = (p: P) => <Svg {...p}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></Svg>
export const INodes = (p: P) => <Svg {...p}><rect x="3" y="4" width="7" height="6" rx="1.5" /><rect x="14" y="14" width="7" height="6" rx="1.5" /><path d="M10 7h2a3 3 0 013 3v4" /></Svg>
export const IBox = (p: P) => <Svg {...p}><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" /></Svg>
export const IFiles = (p: P) => <Svg {...p}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5" /></Svg>
export const IHistory = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
export const IAlert = (p: P) => <Svg {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></Svg>
export const ICheck = (p: P) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>
export const ITerminal = (p: P) => <Svg {...p}><path d="M4 6l6 6-6 6M12 19h8" /></Svg>
export const IChevron = (p: P) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
export const ISearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Svg>

export function Logo({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--accent)" />
      <rect x="7" y="6" width="10" height="5" rx="1" fill="var(--accent-fg)" />
      <rect x="7" y="13" width="4" height="5" rx="1" fill="var(--accent-fg)" />
      <rect x="13" y="13" width="4" height="5" rx="1" fill="var(--accent-fg)" />
    </svg>
  )
}
