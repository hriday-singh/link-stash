import { TextMorph as BaseTextMorph, type TextMorphProps as BaseTextMorphProps } from "torph/react";
import { cn } from "cn";

export interface TextMorphProps extends BaseTextMorphProps {
  className?: string;
}

export function TextMorph({
  children,
  className,
  respectReducedMotion = true,
  ...props
}: TextMorphProps) {
  return (
    <BaseTextMorph
      respectReducedMotion={respectReducedMotion}
      className={cn("inline-block", className)}
      {...props}
    >
      {children}
    </BaseTextMorph>
  );
}
