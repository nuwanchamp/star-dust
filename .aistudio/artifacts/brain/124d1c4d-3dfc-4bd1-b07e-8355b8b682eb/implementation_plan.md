# Interactive Particle Mind Map Component

Add a declarative `<MindMap>` component to Mote that renders hierarchical thought networks out of luminous WebGL2 dust particles—complete with radial spider and horizontal tree arrangements, organic Bezier particle connectors, per-branch ripples, and click-to-collapse branch morphing.

### User Review & Critical Decisions

> [!IMPORTANT]
> All core structural and interaction decisions were confirmed during clarification:
> - **Confirmed Layout Modes**: Dual layout solver supporting **Radial Spider** (`layout="radial"`, balanced around a central hub) and **Horizontal Tree** (`layout="tree"`, flowing left-to-right).
> - **Confirmed Authoring Formats**: Supports both **nested markup tags** (`<MindMap>`, `<Branch>`, `<Topic>`, `<Node>`) and **indented Markdown outlines** (`- Branch\n  - Sub-item`) directly inside `<MindMap>`.
> - **Confirmed Interactivity**: **Collapsible branches on node click**—tapping any branch node with children collapses or expands its subtree, smoothly re-morphing the particle field without resetting the user's session.

---

### 1. Overview & Core Concept

- **What It Does**: Lets users compose branching visual diagrams inside Mote's Layout mode using either structured tags or plain indented Markdown lists, then explore them spatially by hovering, rippling, or clicking branch nodes to fold and unfold ideas in real time.
- **Target Audience / Persona**: Creators, presenters, educators, and note-takers using Mote to turn static outlines into living, tactile particle diagrams.
- **Key Value**: Transforms flat bullet outlines into spatial knowledge maps that inherit Mote's full physics, typography hierarchy, palette themes, and configurable ripple effects.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Select or Author**: User picks the new **Mind Map** preset from the Layout bar or inserts `+ MindMap` from the Layout Markup editor drawer and switches between `layout="radial"` and `layout="tree"` (or writes an indented outline).
  2. **Explore & Collapse**: On the particle canvas, every parent branch renders an intuitive fold indicator (`-` when open, `+N` child count when collapsed). Clicking a parent node folds its children back into the field and softly re-targets nearby particles into the updated layout; clicking again unfolds the subtree.
  3. **Physics & Ripples**: Hovering and clicking nodes triggers component-level ripples (`ring`, `sweep`, `pulse`, `expand`), while cursor breeze/repel/vortex forces scatter and settle branches naturally.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Luminous atmospheric cartography—crisp particle typography anchored inside restrained hairline frames and flowing organic curves on Mote's existing `Aurora`, `Sunbeam`, `Moonlit`, and `Alabaster` themes.
  - *Typographic & Luminance Hierarchy*:
    - **Central Hub (Depth 0)**: `19–22px` SemiBold (`600`), bright high-density perimeter frame (`weight ~ 0.94`) acting as the single dominant anchor.
    - **Primary Branches (Depth 1)**: `15–16px` Medium/SemiBold, subtle rounded hairline frame (`weight ~ 0.82`).
    - **Leaf Nodes (Depth 2+)**: `13–14px` Medium (`500`), lightweight underline or minimal edge accent (`weight ~ 0.70`) so multi-level trees remain airy and uncluttered.
  - *Connector Curves*: Cubic Bezier particle splines linking parent exit ports to child entry ports at calibrated density (`weight ~ 0.48–0.64`) so curves remain legible across `sparse`, `balanced`, and `dense` settings without overpowering labels.
  - *Viewport Integrity*: Automatically fits within the safe canvas bounds (`fitScale`) and respects the open editor drawer inset so no branch clips behind floating chrome.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Balanced Bi-Lateral Radial Placement vs. Pure 360° Polar Angles**
  - *Chosen Approach*: For `layout="radial"`, distribute depth-1 branches across balanced left and right hemispherical arcs weighted by visible subtree height, then cascade deeper levels outward radially/horizontally from each hemisphere.
  - *Why*: Horizontal text labels inside radial spider maps collide quickly when nodes stack near `90°` top/bottom poles. Subtree-weighted bi-lateral placement guarantees zero label overlap while preserving the classic radial center-outward silhouette.
  - *Alternatives Considered*: Naive polar angle division (`2π / N`), which causes overlapping bounding boxes whenever one branch has many sub-nodes.

- **Decision 2: Deterministic Node Paths for Collapse State**
  - *Chosen Approach*: Identify expandable nodes by deterministic tree path (`root/0/2`), stored in UI state rather than mutating the user's authored markup string.
  - *Why*: Users can freely fold and unfold branches on the canvas without altering or corrupting the text in the Layout Markup editor, and collapsed states persist seamlessly when toggling `layout="radial|tree"` or tuning palettes/ripples.
  - *Alternatives Considered*: Rewriting `collapsed="true"` attributes into the editor textarea on click, which would disrupt typing focus and undo history.

- **Decision 3: Smooth Target Morph on Branch Toggle**
  - *Chosen Approach*: Re-sampling the layout with updated collapse state transitions particles to their new targets cleanly without triggering an explosive radial scatter burst, paired with a localized click ripple at the toggled node.
  - *Why*: Preserves spatial continuity so users visually watch child particles gather in or unfurl outward rather than scattering the whole mind map randomly.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────┐     Indented MD / <Branch> Tags     ┌─────────────────────────┐
│    Layout Markup Editor      │ ──────────────────────────────────▶ │  Markup & Outline Parser│
│ (+ MindMap Snippet & Preset) │                                     │  (<MindMap> / <Branch>) │
└──────────────────────────────┘                                     └────────────┬────────────┘
                                                                                  │ Tree AST
                                                                                  ▼
┌──────────────────────────────┐     collapsedIds Set<string>        ┌─────────────────────────┐
│    App Layout Controller     │ ──────────────────────────────────▶ │   MindMap Layout Solver │
│ (handleLayoutAction toggle)  │                                     │ (Radial Spider / Tree)  │
└──────────────▲───────────────┘                                     └────────────┬────────────┘
               │ Click HitRegion ("mindmap:toggle:<path>")                        │ Positioned Nodes
               │                                                                  │ + Bezier Curves
┌──────────────┴───────────────┐                                                  ▼
│     WebGL2 Particle Stage    │ ◀── SampledPoints + HitRegions ───  ┌─────────────────────────┐
│   (Morph, Ripples & Wind)    │     + Per-Node RippleRegions        │ Particle Scene Sampler  │
└──────────────────────────────┘                                     └─────────────────────────┘
```

- **Data Model & State**:
  - **AST Nodes**: Extend layout tags with `MindMap` and `Branch` (aliasing `Node` and `Topic`), supporting attributes `layout="radial|tree"`, `gap`, `levelGap`, `width`, `collapsed="true"`, `ripple*`, and optional default `text` root label or indented Markdown children.
  - **Tree Representation**: Internal `MindMapItem` tree (`id`, `label`, `depth`, `collapsedByDefault`, `rippleAttrs`, `children`) parsed identically whether authored via nested `<Branch>` tags or indented `-`/`*` Markdown bullets.
  - **Interaction State**: `collapsedBranches: Set<string>` managed at the application layout level, automatically cleared when switching to a different layout preset.

- **Interactive Component & State Mapping**:
  - **Editor -> Parser**: Detects indentation depth on bullet lines inside `<MindMap>` (2+ spaces or tabs per nesting level) to build the `MindMapItem` tree; falls back cleanly to recursive `<Branch>` children when XML tags are used.
  - **Solver -> Scene Sampler**: Computes visible node boxes (pruning children under collapsed nodes while appending `+N` descendant count metadata), aligns `radial` or `tree` coordinates, applies viewport `fitScale`, samples node frames + labels into `SampledPoint[]`, emits cubic Bezier connector points, and registers a `RippleRegion` plus clickable `LayoutHitRegion` (`action = "mindmap:toggle:<nodePath>"`) for every branch with children.
  - **Canvas Click -> App Toggle -> Particle Morph**: Tapping a branch hit region routes `"mindmap:toggle:<path>"` back to the layout controller, toggling the node path in `collapsedBranches`, re-running scene sampling, and morphing particles smoothly into the expanded or folded branch structure.
