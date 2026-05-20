"use client";

/**
 * Hero version of the crosscheck logo with a 3-step verification animation:
 *   1. Brackets fade in (left then right)
 *   2. Check stroke draws across the body
 *   3. Emerald halo blooms + resets
 *
 * Loops indefinitely — used on /auth/signin to anchor the trust moment.
 */
export function AnimatedVerifyLogo({ size = 56 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      data-testid="animated-verify-logo"
    >
      {/* Emerald verification halo */}
      <span
        aria-hidden="true"
        className="logo-halo absolute inset-0 rounded-full"
      />
      {/* Inner glow that pulses with the check */}
      <span
        aria-hidden="true"
        className="logo-glow absolute inset-2 rounded-full"
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className="relative"
        aria-hidden="true"
      >
        {/* Left bracket — steady */}
        <path
          d="M11 5 H6 V27 H11"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-300 opacity-90"
        />
        {/* Right bracket — steady */}
        <path
          d="M21 5 H26 V27 H21"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-300 opacity-90"
        />
        {/* Check — draws via stroke-dasharray */}
        <path
          d="M10.5 16.5 L14.5 20.5 L21.5 12.5"
          stroke="#818CF8"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="logo-check"
        />
      </svg>
    </span>
  );
}
