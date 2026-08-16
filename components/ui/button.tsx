import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition outline-none select-none focus-visible:border-emerald-500/50 focus-visible:ring-3 focus-visible:ring-emerald-500/35 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-500/50 aria-invalid:ring-3 aria-invalid:ring-red-500/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white hover:bg-emerald-500 [a]:hover:bg-emerald-500",
        outline:
          "border-gray-600 bg-gray-900/60 text-gray-100 hover:bg-gray-800 hover:text-white aria-expanded:bg-gray-800",
        secondary:
          "bg-gray-800 text-gray-200 hover:bg-gray-700 aria-expanded:bg-gray-700 aria-expanded:text-gray-100",
        ghost:
          "text-gray-100 hover:bg-gray-800/80 aria-expanded:bg-gray-800/80 aria-expanded:text-gray-100",
        destructive:
          "bg-red-500/15 text-red-300 hover:bg-red-500/25 focus-visible:border-red-500/40 focus-visible:ring-red-500/20",
        danger:
          "border-transparent bg-red-600 text-white hover:bg-red-500 focus-visible:border-red-400 focus-visible:ring-red-500/35",
        link: "border-transparent text-emerald-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-md px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-md",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
