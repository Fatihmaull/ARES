import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  className?: string;
  withWordmark?: boolean;
  /** Set false to show wordmark (if any) without the mark SVG. */
  showMark?: boolean;
};

export function Logo({
  size = 22,
  className,
  withWordmark = true,
  showMark = true,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {showMark && <LogoMark size={size} />}
      {withWordmark && (
        <span className="font-serif text-[17px] tracking-tight leading-none">
          ARES
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M16 3 L29 28 L22.5 28 L20 22 L12 22 L9.5 28 L3 28 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />
      <path
        d="M13.2 18 L18.8 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
      <circle
        cx="16"
        cy="12.5"
        r="1.1"
        fill="currentColor"
      />
    </svg>
  );
}
