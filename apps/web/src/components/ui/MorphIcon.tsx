import { forwardRef, type ComponentProps } from "react";
import { MorphIcon as BaseMorphIcon, type MorphHandle } from "morphicons/react";
import { cn } from "cn";

export interface MorphIconProps extends Omit<ComponentProps<typeof BaseMorphIcon>, "ref"> {
  className?: string;
}

export const MorphIcon = forwardRef<MorphHandle, MorphIconProps>(function MorphIcon(
  { className, size = 18, strokeWidth = 1.5, spring = "snappy", reducedMotion = "user", ...props },
  ref,
) {
  return (
    <BaseMorphIcon
      ref={ref}
      size={size}
      strokeWidth={strokeWidth}
      spring={spring}
      reducedMotion={reducedMotion}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
});
