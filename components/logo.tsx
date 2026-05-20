type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function Logo({ size = 20, withWordmark = true, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M11 5 H6 V27 H11"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-70"
        />
        <path
          d="M21 5 H26 V27 H21"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-70"
        />
        <path
          d="M10.5 16.5 L14.5 20.5 L21.5 12.5"
          stroke="#818CF8"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span
          className="font-heading font-semibold tracking-tight text-[15px] leading-none"
          style={{ letterSpacing: "-0.01em" }}
        >
          crosscheck
        </span>
      )}
    </span>
  );
}
