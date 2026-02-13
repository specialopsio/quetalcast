import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    sliderVariant?: "default" | "mixer";
  }
>(({ className, sliderVariant = "default", ...props }, ref) => {
  const isMixer = sliderVariant === "mixer";

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center cursor-pointer", className)}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative w-full grow overflow-hidden rounded-full",
          isMixer
            ? "h-2.5 border border-border/80 bg-[linear-gradient(180deg,rgba(10,10,10,0.92)_0%,rgba(34,34,34,0.95)_45%,rgba(12,12,12,0.96)_100%)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.06),inset_0_-1px_2px_rgba(0,0,0,0.8),0_1px_1px_rgba(0,0,0,0.35)]"
            : "h-2 bg-secondary",
        )}
      >
        <SliderPrimitive.Range
          className={cn(
            "absolute h-full",
            isMixer
              ? "bg-gradient-to-r from-primary/80 via-primary to-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_10px_rgba(34,197,94,0.2)]"
              : "bg-primary",
          )}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isMixer
            ? "relative h-6 w-4 rounded-[3px] border border-border/90 bg-[linear-gradient(180deg,rgba(241,241,241,0.95)_0%,rgba(184,184,184,0.95)_46%,rgba(120,120,120,0.96)_100%)] ring-1 ring-black/35 shadow-[0_2px_3px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.55)] before:absolute before:inset-x-[3px] before:top-[2px] before:bottom-[2px] before:rounded-[2px] before:content-[''] before:bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.35)_0_1px,rgba(255,255,255,0)_1px_3px)]"
            : "h-5 w-5 rounded-full border-2 border-primary bg-background",
        )}
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
