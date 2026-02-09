---
name: refactoring-ui-design
description: A comprehensive design system based on "Refactoring UI" principles for creating polished, professional, production-grade interfaces. Use this skill when designing new features, refactoring existing UIs, or implementing frontend components with proper visual hierarchy, spacing, typography, and polish.
---

This skill provides battle-tested design principles and practical guidelines to transform functional interfaces into polished, professional products. Every recommendation is rooted in real-world application design and proven to create interfaces that feel intentionally crafted.

## Core Philosophy

**CRITICAL MINDSET SHIFTS:**

- **Feature First, Shell Later:** Always design actual functionality (e.g., "flight search form") before the app shell (navigation, sidebar, header). You lack the information needed for layout decisions until you've designed real features.

- **Iterative & Disposable:** Work in short cycles. Design a simple version → implement → iterate on the working design → move to next feature. Sketches and wireframes are disposable exploration tools, not end products. Don't over-invest in low-fidelity designs.

- **Be a Pessimist:** Design the smallest useful version you can ship. If a feature part is "nice-to-have," design it later. Always have something shippable.

- **Systematize Early:** Avoid decision fatigue by defining constrained systems upfront for colors, type scales, spacing, shadows, and border radius. This upfront work saves enormous time and ensures consistency.

- **Design in Grayscale First:** Start without color to force reliance on spacing, contrast, and size for hierarchy. This yields clearer interfaces that are easier to enhance with color later.

## I. Visual Hierarchy

**Hierarchy is the most powerful tool to make a design "feel designed."** Not all elements are equal—deliberately de-emphasize secondary and tertiary information to prevent noisy, chaotic interfaces.

### Controlling Emphasis

**Font Weight & Color Over Size:**

- Don't rely solely on font size for hierarchy—it leads to comically large or unreadably small text
- Use **font weight** (normal vs. heavy) and **color** (dark vs. grey vs. light grey) instead
- Stick to **2-3 text colors** and **2 font weights** for consistency
  - Dark for primary content
  - Grey for secondary content
  - Light grey for tertiary content
  - Normal weight for most text
  - Heavy weight for emphasis
- **CRITICAL:** Avoid font weights under 400 for small sizes—they become illegible

**Emphasize by De-emphasizing:**

- If a primary element isn't standing out, **reduce emphasis on competing elements** rather than boosting the primary element
- Use softer colors for inactive nav items, remove sidebar backgrounds, or lighten supporting text
- This counterintuitive approach is more effective than making primary elements louder

**Smart Color on Colored Backgrounds:**

- **NEVER use grey text on colored backgrounds**—it looks dull or disabled
- Instead, hand-pick a color with the **same hue** as the background, then adjust saturation and lightness for reduced contrast
- Goal: reduced contrast without looking washed out

### Balance Weight and Contrast

- **Heavy elements** (bold text, solid icons) cover more surface area and feel emphasized
- **Compensate for weight:** Lower contrast of heavy elements (e.g., give icons softer colors) to balance with lighter text
- **Compensate for contrast:** Increase weight (e.g., border width) of low-contrast elements to emphasize them without harshness

### Labels & Semantics

**Strategic Label Usage:**

- Labels are a **last resort**—data is often self-explanatory by format (email@example.com) or context
- Combine labels with values: "12 left in stock" instead of "In stock: 12"
- If labels are necessary, treat them as supporting content (smaller, lower contrast, lighter weight)
- Exception: If users search for labels (e.g., technical specs), emphasize the label while keeping data readable

**Decouple Visual from Document Hierarchy:**

- Don't let semantic HTML tags dictate visual styling
- Section titles in apps often function as supportive labels—style them small
- You might even visually hide them if content is self-explanatory

### Action Hierarchy

**Design buttons by importance on the page, not just semantics:**

- **Primary actions:** Obvious—solid backgrounds, high contrast
- **Secondary actions:** Clear but not prominent—outline styles, lower contrast
- **Tertiary actions:** Discoverable but unobtrusive—link styles

**IMPORTANT:** Destructive actions should NOT be big, red, and bold unless they are the primary action on that specific page. If not primary, use secondary/tertiary treatment and save strong styling for a confirmation step where it becomes the primary action.

## II. Layout & Spacing

### White Space Strategy

**Start with Excess:**

- Give elements **too much white space**, then remove until satisfied
- This counter-intuitive approach leads to cleaner, simpler designs
- High density should be a **deliberate choice** for data-heavy apps, not a default

### Spacing & Sizing Systems

**CRITICAL: Use constrained, pre-defined systems instead of arbitrary values.**

- Linear scales (multiples of 4px) are insufficient—relative difference matters more at smaller scales
- Ensure no two values are closer than ~25% to make decisions easier
- Start with a sensible base (e.g., 16px), pack values tightly at small end, space progressively at large end
- **Example scale:** 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px, 128px

**Benefits:** Speeds workflow, improves consistency, eliminates decision paralysis

### Screen Usage & Responsive Design

**Don't Fill Just Because Space Exists:**

- Give each element only the space it needs
- Not everything needs to be full-width
- For narrow content in wide UIs, consider splitting text into columns

**Mobile-First Approach:**

- Shrink canvas to ~400px
- Design mobile layout first
- Adjust for larger screens afterward

### Grid Flexibility

**Grids are overrated if treated as rigid religion:**

- Not all elements need fluid, percentage-based widths
- Give sidebars **fixed widths** optimized for content, let main area flex
- Use **max-width** instead of percentage-based sizing so elements only shrink when truly necessary
- Don't be a slave to the grid—give components the space they need

### Relative Sizing Pitfalls

**AVOID strict relative sizing (em-based layouts):**

- Breaks when users customize base font sizes
- Creates awkward scaling across devices
- Use absolute units (px, rem) for layout, reserve relative units for intentional scaling

### Spacing Relationships

**Space around groups should be larger than space within groups:**

- This clarifies relationships and prevents ambiguity
- If two elements are too close, increase space between them OR reduce space within adjacent groups

## III. Typography

### Type Scale System

**Use hand-crafted, constrained scales—avoid algorithmic ratios that produce fractional values:**

- **Example scale:** 12px, 14px, 16px, 18px, 20px, 24px, 30px, 36px, 48px, 60px, 72px
- Establishes clear hierarchy without indecision
- Eliminates "should this be 17px or 18px?" questions

### Line Height

**INVERSE PROPORTION RULE:** As text size increases, line-height should decrease.

- **Body text (16px):** 1.5 – 1.7 (loose, aids readability)
- **Headlines (48px+):** 1.0 – 1.2 (tight, reduces gaps)
- **Line length matters:** Longer lines need taller line-heights for comfortable reading

**CRITICAL:** Line-height and paragraph spacing are independent—always set both explicitly.

### Alignment & Formatting

**Left-align text:**

- Center alignment is acceptable for ≤2-3 lines (headings, short descriptions)
- **NEVER center-align** paragraphs longer than 3 lines—scanning becomes difficult

**Justified text:**

- Only works well for long-form content with sophisticated hyphenation
- Creates awkward spacing on the web—avoid it

**Line Length:**

- Optimal: 45-75 characters per line
- If forced wider, increase line-height and font size to compensate

### Letter Spacing

**Adjust for context:**

- **Tighten** spacing for large headers (creates cohesion)
- **Increase** spacing for all-caps text (improves readability)
- Trust default spacing for body text unless using a specialty font

## IV. Working with Color

### HSL Over RGB

**Use HSL (Hue, Saturation, Lightness) for intuitive adjustments:**

- Hue: Position on color wheel (0-360°)
- Saturation: Color intensity (0-100%)
- Lightness: How light/dark (0-100%)

### Palette Construction

**Greys: Need 8-10 shades**

- **NEVER pure grey**—tint slightly towards blue (cool) or warm tones
- True grey (50% lightness) is darker than expected—your "middle grey" should be ~55-65% lightness
- Build separate light mode and dark mode grey palettes

**Primary/Accent Colors: 5-10 shades each**

- Start with base color, generate lighter and darker variants
- Ensure sufficient contrast for all use cases (backgrounds, borders, text)

### Luminosity Manipulation

**To darken colors while maintaining vibrancy:**

- Rotate hue towards blue/red/purple
- **Increase saturation** (counterintuitive but essential)

**To lighten colors while maintaining vibrancy:**

- Rotate hue towards yellow/cyan
- **Decrease saturation**

**CRITICAL:** Simply adjusting lightness alone creates washed-out or muddy colors.

### Greys on Colored Backgrounds

**Don't use grey text on colored backgrounds:**

- Choose a shade matching the background's hue
- Adjust lightness/saturation for proper contrast
- Hand-pick for each background color

### Accessibility

**Ensure 4.5:1 contrast ratio for normal text:**

- Use contrast checkers in design tools
- If light text on dark background feels overpowering, **flip the contrast** (dark text on light background) instead of reducing contrast below accessible levels

## V. Creating Depth

### Light Source Simulation

**Emulate light from above for natural depth:**

**Raised Elements (buttons, cards):**

- Light top edge (subtle inset shadow or border)
- Dark bottom shadow (small offset)

**Inset Elements (inputs, wells):**

- Dark top shadow (inset)
- Light bottom edge (subtle border or shadow)

### Shadow System

**Establish 5 elevation levels for consistency:**

1. **Small elevation** (buttons): `0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)`
2. **Medium elevation** (cards): `0 3px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.12)`
3. **Large elevation** (dropdowns): `0 10px 20px rgba(0,0,0,0.15), 0 3px 6px rgba(0,0,0,0.10)`
4. **Extra-large elevation** (modals): `0 15px 25px rgba(0,0,0,0.15), 0 5px 10px rgba(0,0,0,0.05)`
5. **Maximum elevation** (tooltips): `0 20px 40px rgba(0,0,0,0.2)`

**Two-Part Shadow Technique:**

- **First shadow:** Large, soft, high vertical offset (simulates ambient light)
- **Second shadow:** Tight, dark, low vertical offset (simulates direct occlusion)
- As elevation increases, make second shadow more subtle

### Interactive Depth

**Combine shadows with interaction:**

- Add shadow when element pops forward (dragging, hover)
- Reduce/remove shadow when "pressed" (button clicks)

### Flat Design Depth

**Use color brightness to imply depth:**

- **Lighter = closer to user**
- **Darker = further away**
- Use lighter backgrounds to raise elements, darker to inset them
- Short, vertically-offset solid shadows (no blur) add depth to cards/buttons in flat designs

### Layering & Overlap

**Create depth through composition:**

- Offset cards across background transitions
- Make elements taller than their containers
- Overlap images with "invisible borders" (matching background color) to prevent clashing

## VI. Working with Images

### Image Quality

**CRITICAL: Design with final image quality in mind:**

- Use professional photography or high-quality stock photos
- **NEVER** design with placeholders expecting to swap in low-quality smartphone photos—it never works

### Scaling Guidelines

**Bitmap Images:**

- Never scale larger than original size—will look fuzzy
- Can scale down, but test readability

**SVG Icons:**

- Don't scale small icons (16-24px originals) to large sizes—they look chunky and lack detail
- Don't scale large icons down to tiny sizes (favicons)—redraw simplified versions at target size

**Screenshots:**

- Don't scale full screenshots significantly—text becomes unreadable
- Take screenshots at smaller screen sizes (tablet layout) or take partial screenshots
- For tight spaces, draw simplified UI versions with details removed

### Background Images & Text Contrast

**Reduce dynamics for consistent contrast:**

1. **Semi-transparent overlay:** Black for light text, white for dark text
2. **Lower image contrast:** Adjust brightness to compensate
3. **Colorize with brand color:** Lower contrast, desaturate, add solid fill with "multiply" blend mode
4. **Text shadow glow:** Large blur radius, no offset for subtle emphasis

### User-Uploaded Content

**Control shape and size:**

- Center images in fixed containers
- Crop anything that doesn't fit
- Use `background-size: cover` for fixed containers
- Prevent background bleed with subtle inner box shadow or semi-transparent inner border

### Icon Sizing

**If large icons needed:**

- Enclose smaller icons inside shapes with background colors
- Keeps icon at intended size while filling required space

## VII. Finishing Touches

### Supercharge Defaults

**Add polish without new elements:**

- Replace bullet points with icons (checkmarks, arrows, custom shapes)
- Promote quotes in testimonials (larger size, brand color)
- Custom link styles (color changes, unique underlines, font weight)
- Custom checkboxes/radio buttons with brand colors for selected states
- Don't settle for browser defaults

### Accent Borders

**Add colorful accents to bland areas:**

- Top of cards
- Active navigation items
- Side of alerts
- Under headlines
- Across top of layout

**Keep borders subtle—3-5px maximum**

### Background Decoration

**Break up monotony without overwhelming:**

- Change background colors between sections
- Use subtle gradients (two hues ≤30° apart on color wheel)
- Add subtle repeatable patterns
- Include simple shapes or graphics in specific positions
- **CRITICAL:** Keep contrast low so decorations don't interfere with content

### Empty States

**CRITICAL: Treat empty states as first-class features:**

- User's first interaction—opportunity to make strong impression
- Include illustration or image
- Emphasize call-to-action clearly
- Consider hiding non-functional UI (tabs, filters) until needed
- **Never** overlook empty states—they define first impressions

### Border Alternatives

**"Fewer borders"—too many create cluttered designs:**

Instead of borders, use:

1. **Box shadows** to outline elements
2. **Different background colors** for adjacent elements
3. **Extra spacing** between groups
4. **Combination** of above

### Rethink Component Conventions

**Challenge preconceived notions:**

**Dropdowns:**

- Break into sections with headers
- Use multiple columns for related options
- Add supporting text or icons
- Include colorful accents

**Tables:**

- Combine related columns when sorting isn't needed
- Introduce visual hierarchy
- Add images or color-coded indicators
- Consider card layouts for mobile

**Radio Buttons:**

- Use selectable cards instead of circles
- Include icons or descriptions
- Show previews of options

**IMPORTANT:** Don't let existing beliefs constrain designs—be open to unconventional approaches.

## VIII. Systematize Everything

**Pre-define constrained options for all design decisions:**

- **Font size** (type scale)
- **Font weight** (2-3 options maximum)
- **Line height** (relative to font size)
- **Color** (defined palettes with 8-10 shades)
- **Margin & padding** (spacing scale)
- **Width & height** (avoid arbitrary values)
- **Box shadows** (elevation system with 5 levels)
- **Border radius** (3-5 options: none, subtle, moderate, large, pill)
- **Border width** (1px, 2px, 4px)
- **Opacity** (10%, 25%, 50%, 75%, 90%)

**Process:** Continuously look for opportunities to introduce new systems. When making the same decision repeatedly, systematize it.

## IX. Process Checklist

Before finalizing any UI component, verify:

1. **Is hierarchy clear?** Can you squint and identify the most important element?
2. **Is it consistent?** Are you using values from defined systems?
3. **Is it accessible?** Does text meet 4.5:1 contrast ratio?
4. **Does it feel flat?** Have you used shadows or color to add depth where needed?
5. **Are labels necessary?** Can context or format replace them?
6. **Are borders necessary?** Can spacing, shadows, or background colors replace them?
7. **Is empty state designed?** Does it make a strong first impression?
8. **Are defaults customized?** Have checkboxes, bullets, links been styled?

## X. Continuous Improvement

**Hone your eye by studying exceptional work:**

- Notice design decisions you wouldn't have thought of yourself
- Recreate favorite interfaces from scratch without developer tools
- Discover subtle tricks: reduced line-height for headings, increased letter-spacing for uppercase, combined shadows
- Build a collection of inspiring examples for each component type

**Remember:** Great design is intentional, systematic, and continuously refined. Every decision should serve the hierarchy, every system should reduce friction, and every detail should contribute to a cohesive, professional result.
