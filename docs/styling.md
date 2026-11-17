# Styling

Argo uses stock Tailwind CSS utilities and shadcn/ui components in the configured `base-nova` style. Prefer a shadcn primitive when its behavior fits; compose ordinary elements with Tailwind utilities for domain-specific views.

Use the closest stock spacing, type size, weight, radius, color, and breakpoint. Visual consistency takes precedence over preserving an old bespoke measurement. Do not recreate old CSS with arbitrary-value utilities or introduce application-specific design tokens. The only application-specific theme values are the sans, mono, and logo fonts.

`src/index.css` owns font loading and the stock shadcn neutral theme, including its semantic color variables and standard radius mapping. Keep component styling in JSX rather than named CSS rules, `@apply` component classes, or ancestor selectors that restyle another component. `components.json` records the shadcn style and base color.

The shell exposes the named Tailwind container `content`; workspace layouts use its stock container breakpoints so their behavior reflects the space available beside navigation.

Runtime calendar geometry remains calculated from event times and overlap. Email HTML stays in an isolated iframe with its own minimal document styling. These content boundaries do not justify custom visual scales elsewhere.
