const PATHS = {
  back: 'M15 5l-7 7 7 7',
  undo: 'M4 9h10a6 6 0 010 12H9M4 9l5-5M4 9l5 5',
  hint: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z',
  flag: 'M5 21V4m0 1h12l-3 4 3 4H5',
  handshake: 'M3 12l4-4 5 2 5-2 4 4-8 8-3-3M7 8l5 5',
  restart: 'M4 4v6h6M4 10a8 8 0 111 7',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  share: 'M12 15V4m0 0L8 8m4-4l4 4M5 13v7h14v-7',
  sound: 'M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 010 6',
  mute: 'M4 10v4h4l5 4V6L8 10H4zM21 9l-5 6m0-6l5 6',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1V5h-4L10 7 8 8 6 7l-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4v-2l2-1 2 1 2-4-2-1z',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  first: 'M18 5l-7 7 7 7M7 5v14',
  last: 'M6 5l7 7-7 7M17 5v14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zm10 3a3 3 0 100-6 3 3 0 000 6z',
  check: 'M5 13l4 4 10-11',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
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
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
