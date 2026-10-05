import { cn } from "cn";

export interface StashLogoProps {
  className?: string;
  size?: number | string;
}

export function StashLogo({ className, size = 20 }: StashLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Background card / shelf layer */}
      <rect
        x="3"
        y="5"
        width="18"
        height="15"
        rx="3"
        className="stroke-foreground/30 dark:stroke-foreground/40"
        strokeWidth="1.5"
      />
      {/* Middle card layer offset */}
      <path
        d="M6 3.5C6 2.67157 6.67157 2 7.5 2H16.5C17.3284 2 18 2.67157 18 3.5V5H6V3.5Z"
        className="fill-muted stroke-border"
        strokeWidth="1.2"
      />
      {/* Foreground primary bookmark / stash ribbon */}
      <path
        d="M9 5V14L12 12.2L15 14V5H9Z"
        className="fill-primary stroke-primary"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
