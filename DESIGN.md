# Design

## Product Register

BiasBuster is a product UI for comparative news-framing analysis. The interface should feel like a research brief, not a marketing page.

## Visual Theme

Restrained civic-analysis interface with cool tinted neutrals, dark blue-green ink, and limited semantic accents. The design should be dense but calm, with clear hierarchy and minimal decoration.

## Color

- Background: cool off-white / green-tinted neutral.
- Surface: white or very light cool neutral.
- Ink: dark blue-green, not pure black.
- Muted text: darker slate/green-gray with AA contrast.
- Accent: teal-blue for primary actions and active analytical elements.
- Warning/caution: amber for medium confidence and underemphasis.
- Success/high confidence: green.
- Error: red.

Color should identify state, confidence, and comparison categories. Avoid decorative gradients and one-note blue dashboards.

## Typography

Use a single system UI stack for product clarity. Keep headings firm and compact, avoid oversized hero type, use balanced line lengths for prose, and preserve dense table readability.

## Components

- Cards are flat panels with modest 10-12px radius and a defined border.
- Buttons use consistent radius, visible focus states, and restrained hover states.
- Badges are compact status labels, not decorative pills everywhere.
- Tables carry the main report content and need clear borders, sticky-like visual rhythm, and readable line height.
- Modals should be direct, scrollable, and clearly dismissible.

## Layout

The results page should read in this order:

1. Executive insight and neutral summary.
2. Framing comparison table.
3. Shared facts and cross-source diagnosis.
4. Headline and loaded-language analysis.
5. Source-by-source and emphasis analysis.
6. Charts and article details.

Charts are supporting evidence, not the primary experience.

## Motion

Use short 150-200ms transitions for hover, focus, modal entry, and state changes. No bounce, elastic, or decorative page-load choreography. Respect reduced motion.
