import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[2px] border-2 border-black/80 px-2 py-0.5 text-[11px] font-semibold tracking-wide w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow,transform] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] uppercase",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-primary/80 [a&]:hover:brightness-110",
        secondary:
          "bg-secondary text-secondary-foreground border-secondary/80 [a&]:hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive/80 [a&]:hover:brightness-110",
        outline:
          "bg-transparent text-foreground border-border [a&]:hover:bg-accent/40 [a&]:hover:text-accent-foreground",
        detective:
          "bg-cyan-400 text-black border-cyan-500",
        murderer:
          "bg-rose-500 text-black border-rose-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
