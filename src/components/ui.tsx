import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import {
  type ComponentProps,
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
  elevated?: boolean;
};

export function Panel({
  as: Component = "div",
  className,
  elevated = false,
  ...props
}: PanelProps) {
  return (
    <Component
      className={cx(
        "rounded-lg border border-white/70 bg-white/55 p-4 backdrop-blur-xl",
        elevated
          ? "shadow-[0_20px_70px_rgb(68_54_29_/_14%)]"
          : "shadow-[0_18px_55px_rgb(68_54_29_/_11%)]",
        className,
      )}
      {...props}
    />
  );
}

export function Eyebrow({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cx(
        "text-[0.78rem] font-bold uppercase tracking-normal text-[#a6752a]",
        className,
      )}
      {...props}
    />
  );
}

type ButtonVariant = "danger" | "primary" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    "min-h-12 shrink-0 cursor-pointer rounded-lg border-0 bg-[#211f1b] px-5 font-bold text-[#fffaf0] transition-[transform,opacity] duration-[160ms] enabled:hover:-translate-y-px disabled:cursor-progress disabled:opacity-70",
  secondary:
    "min-h-10 rounded-md border border-black/10 bg-white/75 px-3 text-sm font-bold text-[#3a342a] disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "min-h-[2.4rem] cursor-pointer rounded-md border border-[#d1d1d1] bg-white text-[0.85rem] font-semibold text-[#c93a3e] transition-all duration-[160ms] enabled:hover:border-[#c93a3e] enabled:hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-50",
};

export function Button({
  className,
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(buttonVariantClasses[variant], className)}
      type={type}
      {...props}
    />
  );
}

const controlClass =
  "min-h-10 rounded-md border border-black/10 bg-white/75 px-3 text-sm text-[#211f1b] outline-none focus:border-[#a6752a]";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input ref={ref} className={cx(controlClass, className)} {...props} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select ref={ref} className={cx(controlClass, className)} {...props} />
  );
});

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx(
        "grid gap-1 text-xs font-bold text-[#686258]",
        className,
      )}
      {...props}
    />
  );
}

type ChipVariant = "color" | "count" | "muted" | "user";

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: ChipVariant;
};

const chipVariantClasses: Record<ChipVariant, string> = {
  color: "bg-[rgb(166_117_42_/_15%)] font-bold text-[#3a342a]",
  count: "bg-black/5 font-bold text-[#686258]",
  muted: "bg-[rgb(33_31_27_/_8%)] font-medium text-[#686258] dark:text-[#9c9586]",
  user: "bg-[rgb(63_128_82_/_16%)] font-bold text-[#3a342a]",
};

export function Chip({
  className,
  variant = "muted",
  ...props
}: ChipProps) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-[0.55rem] py-1 text-[0.74rem]",
        chipVariantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cx(
        "grid min-h-12 place-items-center text-sm text-[#686258] dark:text-[#9c9586]",
        className,
      )}
      {...props}
    />
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cx(
        "flex size-5 appearance-none items-center justify-center rounded-sm border border-white/70 bg-white shadow-[0_2px_10px_rgb(0_0_0_/_15%)] transition-colors duration-150 hover:bg-zinc-100 data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-white">
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
