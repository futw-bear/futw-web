# AGENTS.md

## Project Overview

`futw-web` is a client-side web application built with React, Vite, Typescript and TanStack Router. It is intended to be distributed as a Progressive Web App (PWA) and should provide a comfortable browsing experience across common screen sizes.

## Language Rules

- Write all source code, code comments, commit-oriented documentation, and `AGENTS.md` files in English.
- `README.md` is the only intentional exception: write it in Traditional Chinese (`zh-TW`).
- Preserve user-facing copy from the design when it is provided. If no copy is specified, use clear, concise English unless the product requirements say otherwise.

## Design and UI Requirements

- Treat files under `designs/` as the primary source of truth for visual implementation.
- Before implementing or changing a screen, inspect the relevant design files and identify its layout, spacing, typography, colors, states, and responsive behavior.
- Do not replace a design decision with a generic component-library default without a clear requirement or a documented reason.
- Reuse existing visual patterns and styles before introducing new ones.
- Implement responsive layouts for narrow mobile screens, tablets, laptops, and wide desktop screens. Avoid fixed widths that cause horizontal scrolling.
- Include usable loading, empty, error, hover, focus, disabled, and offline states where they are relevant to the feature.
- Maintain keyboard accessibility, visible focus indicators, semantic HTML, sufficient color contrast, and touch targets that are comfortable on mobile devices.
- Use `lucide-react` for interface icons when an icon is needed. Prefer CSS and existing assets for simple visual treatments; do not add raster assets when a code-native solution is appropriate.

## Routing and Application Architecture

- Use TanStack Router file-based routing. Add route files under `src/routes` and use `createFileRoute` for route definitions.
- Use `Link` or router navigation APIs for internal navigation. Do not use plain anchors or full-page reloads for in-app routes.
- Keep shared application structure in `src/routes/__root.tsx` and route-specific UI in the corresponding route file or a nearby feature component.
- Treat `src/routeTree.gen.ts` as generated output. Do not edit it manually; run the route generation command after adding, removing, or renaming route files.
- Keep route loaders, search parameters, and navigation state type-safe. Prefer route-level data loading when data is required before rendering a route.
- Keep browser-only behavior behind appropriate client-side boundaries and account for refreshes, deep links, and direct navigation to nested routes.
- Keep development-only tooling out of the production user experience unless the existing build setup explicitly removes it.

## PWA and Browser Behavior

- Preserve and update the PWA metadata and assets in `public/` when changing the application name, theme, icons, or launch behavior.
- Ensure viewport metadata, document language, page titles, and route-specific metadata are correct.
- Design for intermittent connectivity: avoid unnecessary network dependence for the initial shell, provide useful offline or unavailable states, and do not lose user input during transient failures.
- Verify that layouts work with browser zoom, dynamic text sizing, safe-area insets, and both pointer and touch input.

## Styling and Assets

- Use the existing Tailwind CSS setup for utility styling unless a reusable global rule in `src/styles.css` is more appropriate.
- Keep global styles minimal and intentional. Prefer component-local or feature-local styles for isolated behavior.
- Use the existing project alias (`#/*`) for imports from `src` where it improves clarity, and use consistent import ordering.
- Optimize images and provide meaningful `alt` text. Decorative images should use an empty `alt` attribute.
- Do not add dependencies for functionality already covered by React, TanStack, Tailwind CSS, Biome, or existing project utilities.

## Development Workflow

From the project root:

```bash
bun install
bun --bun run dev
```

Useful validation commands:

```bash
bun --bun run generate-routes
bun --bun run check
bun --bun run test
bun --bun run build
```

- Run the narrowest relevant checks during development, then run `check`, tests, and a production build for a completed feature when practical.
- Run formatting and linting through the scripts in `package.json`; do not introduce a second formatter or linter.
- Review the rendered UI at representative viewport widths after visual changes. Confirm that browser console errors, broken routes, overflow, and inaccessible controls are not introduced.
- Keep changes focused. Avoid unrelated refactors, generated-file churn, or broad dependency upgrades.

## Testing Expectations

- Add or update tests for meaningful behavior, route logic, data transformations, and regressions.
- Test user-observable behavior rather than implementation details.
- For responsive or design-sensitive work, supplement automated checks with visual inspection at mobile and desktop widths.
- For PWA-related changes, verify the manifest, icons, launch metadata, and behavior on a production build or preview server when applicable.

## Change Safety

- Inspect the existing implementation before editing and preserve unrelated user changes.
- Do not remove design assets, routes, configuration, or generated files unless the task requires it.
- If the design and an explicit product requirement conflict, follow the explicit requirement and record the relevant deviation in the implementation or handoff notes.
- Keep documentation synchronized with behavior changes. Update `README.md` in Traditional Chinese when setup, scripts, or user-facing project behavior changes.

## Contribution Guidelines

- Name every branch using the `FUTW-{code}/{feature_name} format.
- Follow the Conventional Commits for all Git commit messages.
- Write pull request title formats `[FUTW-{code}] {feature_name}` in English, and descriptions in Traditional Chinese.
- Do not update `README.md` or `AGENTS.md` unless the change is necessary for user-facing project documentation.