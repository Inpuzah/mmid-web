import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] border-2 border-black/80 text-sm font-semibold tracking-wide shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_0_0_rgba(0,0,0,0.9)] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none transition-transform transition-shadow duration-75 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:translate-y-[2px] active:shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_2px_0_0_rgba(0,0,0,0.9)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-primary/80 hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive/80 hover:brightness-110 focus-visible:ring-destructive/50",
        outline:
          "bg-transparent border-border text-foreground hover:bg-accent/40 hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border-secondary/80 hover:brightness-110",
        ghost:
          "bg-transparent border-transparent shadow-none hover:bg-accent/50 hover:text-accent-foreground",
        link:
          "bg-transparent border-none shadow-none text-primary underline-offset-4 hover:underline hover:text-primary/90",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-[3px] gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 rounded-[3px] px-6 has-[>svg]:px-4 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
