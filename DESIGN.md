---
name: Titan Performance
colors:
  surface: '#0d1322'
  surface-dim: '#0d1322'
  surface-bright: '#33394a'
  surface-container-lowest: '#080e1d'
  surface-container-low: '#151b2b'
  surface-container: '#191f2f'
  surface-container-high: '#242a3a'
  surface-container-highest: '#2f3445'
  on-surface: '#dde2f8'
  on-surface-variant: '#d2c5ab'
  inverse-surface: '#dde2f8'
  inverse-on-surface: '#2a3040'
  outline: '#9a9078'
  outline-variant: '#4e4632'
  surface-tint: '#f1c100'
  primary: '#ffedc3'
  on-primary: '#3d2f00'
  primary-container: '#ffcc00'
  on-primary-container: '#6f5700'
  inverse-primary: '#745b00'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#eaedff'
  on-tertiary: '#293043'
  tertiary-container: '#cbd1ea'
  on-tertiary-container: '#53596e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe08b'
  primary-fixed-dim: '#f1c100'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#584400'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#dbe2fb'
  tertiary-fixed-dim: '#bfc6de'
  on-tertiary-fixed: '#141b2d'
  on-tertiary-fixed-variant: '#3f465a'
  background: '#0d1322'
  on-background: '#dde2f8'
  surface-variant: '#2f3445'
  action-yellow: '#FFCC00'
  surface-deep: '#0B1120'
  surface-card: '#12192B'
  utility-red: '#FF3B30'
  utility-green: '#34C759'
typography:
  display-hero:
    fontFamily: Sora
    fontSize: 72px
    fontWeight: '800'
    lineHeight: 80px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
spacing:
  base: 8px
  margin-mobile: 16px
  margin-desktop: 64px
  gutter: 24px
  section-gap: 120px
---

## Brand & Style

This design system is built for the "Modern Athlete"—individuals who value precision, raw power, and premium quality. The brand personality is unapologetically bold, high-performance, and direct. It balances the grit of a powerhouse gym with the clinical precision of high-end sports science.

The visual style is **High-Contrast / Bold** with elements of **Minimalism**. It utilizes massive, impactful typography to project strength and confidence, while maintaining clean lines and ample whitespace to ensure the user experience feels professional and secure. The aesthetic is defined by "strength" visuals: heavy borders, dark architectural layers, and vibrant industrial highlights.

## Colors

The color palette is optimized for a high-performance dark mode environment. The core of the system is built on **Surface Deep (#0B1120)**, providing a sophisticated, near-black foundation that feels more premium than pure black.

- **Primary (Action Yellow):** Used exclusively for high-priority calls to action, rating stars, and critical emphasis. It represents energy and the gold standard of nutrition.
- **Secondary (White):** Used for primary headings and clear body text to ensure maximum readability against dark backgrounds.
- **Tertiary (Surface Card):** A slightly lighter navy used to create container depth and separate product modules from the main background.
- **Named Colors:** **Utility Red** is reserved for urgent sale badges and "limited time" alerts, while **Utility Green** validates trust through "verified" checkmarks and success states.

## Typography

The typography system uses **Sora** for its aggressive, geometric construction in headlines, evoking a sense of modern engineering and strength. **Inter** is utilized for body and utility text to provide a neutral, highly legible counterpoint.

Headlines should utilize "Tight" leading and negative letter-spacing to emphasize the heavy weights. Product titles use **Headline-MD** for clarity, while promotional labels and price tags utilize **Label-Bold** in all-caps to create a sense of urgency and tactical precision.

## Layout & Spacing

The system employs a **Fluid Grid** model based on an 8px square system. It prioritizes vertical rhythm and significant section breathing room to maintain a premium, uncluttered feel.

- **Desktop:** 12-column grid with 64px side margins. Large section gaps (120px) prevent information overload and focus the user on one product category at a time.
- **Mobile:** 4-column grid with 16px margins.
- **Component Spacing:** Elements within a product card (title, rating, price) use "Tight" spacing (8px) to group information, while the space between cards uses "Loose" spacing (24px) to ensure distinct visual separation.

## Elevation & Depth

This design system uses **Tonal Layers** rather than traditional soft shadows to maintain a "Hard-Edge" performance aesthetic. 

- **Level 0 (Background):** #0B1120. The deepest layer.
- **Level 1 (Cards/Surface):** #12192B. Used for product containers and category blocks.
- **Level 2 (Interaction):** When hovered, cards should not lift with shadows but instead utilize a **1px solid Primary Color (#FFCC00) border** or a subtle increase in background lightness.
- **Overlays:** Full-screen drawers (Cart/Menu) use a 60% opacity black scrim to dim the background, keeping the focus entirely on the transactional layer.

## Shapes

The shape language is strictly **Sharp (0px)**. This choice reinforces the "strength" aesthetic, mirroring the geometric and industrial nature of fitness equipment and heavy-duty packaging. 

All primary buttons, input fields, and product containers must have 90-degree corners. The only exceptions are specific "status chips" (e.g., Sale badges), which may use a pill-shape to provide a visual contrast that draws the eye to promotional data.

## Components

### Buttons
Primary buttons are high-impact: Solid **Action Yellow** background with **Deep Dark Gray** text in all-caps. Secondary buttons (Buy Now) should be ghost-style with a white 2px border. Active states use a slight scale-down (0.98) to provide a tactile, physical response.

### Cards
Product cards should have no shadow and no border by default. They rely on the **Surface-Card** background color to distinguish themselves from the main canvas. Upon hover, a primary-colored border is applied to indicate focus.

### Input Fields
Inputs are structured with a solid 1px white border and no background fill. Labels are placed above the field in **Label-Bold** typography. Error states replace the white border with **Utility Red**.

### Chips & Badges
Sale and "New" badges are positioned in the top-right of product images. These are the only elements allowed to have rounded corners (Pill-shaped) to distinguish "Status" from "Structure."

### Lists & Navigation
Navigation items use **Label-Bold** with a bottom-aligned animated underline that appears on hover. Footer lists should be condensed and clean, using the secondary gray text to minimize visual weight.