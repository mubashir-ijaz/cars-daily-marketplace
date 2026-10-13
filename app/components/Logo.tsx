export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e3a8a" /><stop offset="1" stopColor="#0b1730" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#lg)" stroke="rgba(255,255,255,.18)" />
      <path d="M32 11l5.6 12.6 13.7 1.3-10.3 9.1 3 13.4L32 40.5l-12 6.9 3-13.4-10.3-9.1 13.7-1.3z" fill="#f5b301" />
    </svg>
  );
}
