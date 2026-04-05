# Application Quality Audit

Date: 2026-03-31  
Scope: Static audit of `app`, `components`, `hooks`, `lib`, `store`, `constants`, and project configuration.  
Focus: UI/UX quality, design consistency, frontend architecture, maintainability, technical shortcuts, and signs of rushed implementation.

## Severity Legend
- **Critical**: Likely to cause repeated user-facing problems, hard-to-reason behavior, or substantial maintenance risk.
- **Major**: Material quality or architecture issue that weakens polish, consistency, or scalability.
- **Minor**: Localized quality issue that should be corrected during refinement.
- **Suggestion**: Improvement opportunity that raises long-term cohesion or implementation rigor.

## Executive Summary
The application has improved visual ambition, but the implementation quality is still uneven. The most visible issues are not isolated styling bugs; they reflect deeper structural patterns:

- Product behavior is distributed across screens, hooks, store state, and utilities without a clear ownership model.
- The design system exists, but adoption is incomplete; screens still contain substantial local styling and interaction logic.
- Navigation, gestures, and bottom action regions are being managed through manual offsets and global wrappers rather than stable primitives owned by the navigation layer.
- Notifications and fasting behavior have grown organically and now show coupling between persistence, scheduling, runtime app lifecycle, and per-feature hooks.
- Type safety is still being bypassed in several data hooks, which directly weakens maintainability.

The app is usable, but it does not yet read as rigorously engineered. The main risk is not one broken feature; it is the accumulation of ad hoc decisions that will make further refinement slower and more fragile.

## Systemic Patterns

### 1. UI system exists, but is not fully authoritative
- **Major**: `lib/theme.ts` defines tokens, but many screens and components still apply local spacing, radius, margin, and animation values directly.
  - Why problematic: the team now has two competing styling systems, a token layer and local overrides. This undermines consistency and makes regressions likely during refinement.
  - Direction: enforce token-first styling for layout, spacing, motion, and radii. Limit screen-level inline values to composition only.

- **Major**: Shared primitives exist (`Button`, `TextField`, `Surface`, `Screen`), but screens still own too much interaction and layout behavior.
  - Why problematic: primitives are currently visual wrappers, not authoritative behavior contracts. Bottom spacing, transitions, deletion patterns, and list composition are still screen-specific.
  - Direction: push more behavior into shared building blocks or feature-level abstractions instead of repeating screen-owned orchestration.

### 2. Behavior is often implemented through manual positioning and compensation
- **Critical**: Bottom bars and tab navigation rely on manual spacing and margin compensation rather than a stable layout contract.
  - Why problematic: when one layer changes height, other screens must be manually corrected. This is already visible in repeated overlap fixes for log/chat.
  - Direction: centralize bottom-safe-area and tab-bar avoidance logic in a single layout primitive that screens consume declaratively.

- **Major**: Screen transitions and tab swiping are implemented globally in `components/ui/Screen.tsx`.
  - Why problematic: navigation behavior is now owned by a generic UI wrapper instead of the navigator. This creates hidden coupling with scroll views, horizontal rails, and platform gestures.
  - Direction: move gesture-based navigation ownership to the navigation layer or a dedicated tab-shell abstraction.

### 3. Feature logic is spread across too many layers
- **Critical**: Notification behavior spans constants, AsyncStorage, root app lifecycle, store state, profile UI, and feature hooks.
  - Why problematic: correctness depends on multiple paths staying in sync. A reminder can be affected by app foregrounding, settings saves, auth startup, and per-feature mutations.
  - Direction: extract notification orchestration into a small service with a clear contract for daily reminders, fast reminders, and lifecycle rehydration.

- **Major**: Fasting behavior is split between store defaults, profile settings, mutation hooks, notification utilities, and runtime queries.
  - Why problematic: the “source of truth” for a fast is not obvious. Settings target, active DB row target, timer display, and notification timing are related but not modeled explicitly.
  - Direction: introduce a dedicated fasting domain module with explicit rules for target, active session, notification policy, and UI projections.

## Critical Findings

### C1. Navigation and gesture architecture is fragile
- **Critical**: Global pan-driven tab navigation is attached to every `Screen`.
  - Why problematic: this is difficult to keep compatible with nested horizontal interactions such as chips, prompt rails, swipe rows, and platform navigation gestures. It also makes navigation behavior implicit rather than discoverable in the tab shell.
  - Direction: re-home tab swipe behavior into the tab navigator or a purpose-built tab container. Avoid screen wrappers owning route changes.

### C2. Notification scheduling is tightly coupled and stateful in hidden ways
- **Critical**: Reminder scheduling mixes persisted config, daily random selection, app lifecycle hooks, active-fast DB lookups, and per-feature side effects.
  - Why problematic: reminder correctness depends on sequencing, not just data. That raises the risk of duplicate schedules, stale schedules, or reminders disappearing after unrelated settings changes.
  - Direction: define separate scheduling domains and explicit invariants for each reminder class. Remove incidental coupling through shared helpers.

### C3. Root bootstrap owns too many unrelated responsibilities
- **Critical**: `app/_layout.tsx` handles splash behavior, auth routing, magic-link processing, food seeding, permission requests, daily reminder orchestration, fast reminder orchestration, and app foreground synchronization.
  - Why problematic: startup is now a dense side-effect hub. That makes it hard to test, reason about, or safely extend.
  - Direction: break bootstrap into small services or hooks with explicit phases: auth boot, deep-link boot, notification boot, and initial user data boot.

## Major Findings

### UI Consistency and Visual Quality

- **Major**: Typography hierarchy is better than before, but still not fully semantic.
  - Why problematic: screens mix headings, labels, captions, and body styles with ad hoc overrides. Numeric metrics are sometimes emphasized well and sometimes not.
  - Direction: establish clear usage rules for `display`, `h1`, `h2`, `h3`, `body`, `caption`, and metric styles, then remove local overrides where possible.

- **Major**: Dark mode readiness is incomplete because the token system is not yet comprehensive.
  - Why problematic: although most colors route through `theme`, there are still direct RGBA values and local radius/spacing choices in screens and components.
  - Direction: add missing semantic tokens for overlays, muted fills, danger surfaces, and decorative backgrounds so screens stop inventing local values.

- **Major**: Several screens still solve layout locally rather than through a consistent page scaffold.
  - Why problematic: `Today`, `Log`, `Move`, `Insights`, and `Profile` all compose their own header/content/bottom-region behavior differently.
  - Direction: define a standard “screen scaffold” with header zone, content zone, optional sticky footer, and tab-safe bottom handling.

- **Major**: The AI chat still behaves like a custom screen inside a tracker app rather than a first-class product surface.
  - Why problematic: message layout, bottom composer behavior, prompt rails, and error treatment are still bespoke compared with the rest of the system.
  - Direction: formalize a chat surface primitive or a small chat feature package instead of screen-local assembly.

### Interaction Patterns and Feature Completeness

- **Major**: Interaction patterns are inconsistent across deletion, confirmations, toggles, and list editing.
  - Why problematic: some destructive actions use alerts, some use custom sheets, some use swipe rows, and some use inline buttons. This makes the UI feel assembled rather than designed.
  - Direction: choose preferred patterns by action type and standardize them.

- **Major**: Gesture behavior conflicts with content density.
  - Why problematic: the app now uses swipeable meal rows, screen-wide tab swipe, horizontal chip rails, and scroll-heavy pages. These gestures are not coordinated by a higher-level policy.
  - Direction: define gesture priority rules and avoid relying on generic wrappers to infer intent.

- **Major**: Daily reminders are randomly selected from enabled reminders.
  - Why problematic: from a user perspective, enabled does not mean scheduled. This reduces predictability and makes the reminders system harder to trust.
  - Direction: either expose the “daily limit + rotation” rule clearly in UX or replace randomness with a deterministic prioritization strategy.

- **Major**: The fast reminder feature is useful but embedded as another toggle in a crowded screen without a broader notification model.
  - Why problematic: the profile screen is becoming the dumping ground for operational behavior rather than a coherent settings surface.
  - Direction: group reminder policy, daily reminder policy, and fast-specific reminder policy under a stronger information architecture.

### Frontend Architecture and Maintainability

- **Major**: Type safety is still bypassed through `as never` and `as unknown`.
  - Why problematic: this removes compiler value exactly where external data and DB contracts are most important.
  - Direction: regenerate or repair Supabase types and remove cast-based escape hatches from hooks and utility layers.

- **Major**: Store state mixes ephemeral drafting state and long-lived settings in a single persisted store module.
  - Why problematic: meal drafting, notification settings, fasting settings, and macro targets do not share lifecycle semantics, yet they live together.
  - Direction: split the store by concern or at least by persistence boundary.

- **Major**: Notification and fasting flows depend on direct store reads from side-effectful utility code.
  - Why problematic: global reads during lifecycle handling make behavior harder to predict and test.
  - Direction: pass explicit values into orchestration functions and minimize “read from global store during side effect” patterns.

- **Major**: There is no automated quality gate visible in project scripts.
  - Why problematic: `package.json` exposes no linting, formatting, or test script. That strongly suggests regression detection depends on manual testing.
  - Direction: add at minimum lint, type-check, and one lightweight automated test path for critical flows.

### Error Handling and User Feedback

- **Major**: Error handling is still mostly developer-oriented.
  - Why problematic: many failures log warnings or throw errors, but user-facing recovery is inconsistent. Some flows expose inline errors, others silently fail or rely on alerts.
  - Direction: create a small app-wide error feedback strategy for inline validation, mutation failure, background sync issues, and destructive operations.

- **Major**: Startup and auth routing still use imperative route replacement chains.
  - Why problematic: if session, deep-link, permission, or seed operations race, the resulting navigation path can be difficult to reason about.
  - Direction: make auth/bootstrap states explicit and render them declaratively where possible.

## Minor Findings

### Design and Copy

- **Minor**: The tone of reminder copy is inconsistent.
  - Why problematic: encouragement strings range from motivational to aggressive. That may not match the rest of the product voice and could feel jarring.
  - Direction: define a product voice guide and align reminder messaging to it.

- **Minor**: Naming is not fully coherent.
  - Why problematic: examples include `fast_start`, `encouragement_reminder`, `customReminders`, `notificationConfig`, and the misspelled `project_analysys.md`. This signals uneven rigor.
  - Direction: standardize naming around domain semantics and correct obvious spelling drift.

- **Minor**: Decorative surfaces and accents are still screen-specific in places.
  - Why problematic: login background circles and some surface treatments are not backed by reusable decorative tokens.
  - Direction: either formalize decorative primitives or keep decorative values local but clearly isolated.

### Responsiveness and Adaptability

- **Minor**: Layout choices appear optimized primarily for phone portrait.
  - Why problematic: many surfaces assume fixed visual density, one-column forms, and tab bar presence. Adaptation to larger widths appears incidental rather than intentional.
  - Direction: define responsive behavior for larger phones, tablets, landscape, and web-like widths if those platforms remain supported.

- **Minor**: Keyboard avoidance is handled inconsistently.
  - Why problematic: login uses `KeyboardAvoidingView`, while other bottom-input surfaces rely on manual bottom spacing and tab-bar offsets.
  - Direction: standardize keyboard-safe bottom composer behavior in a reusable primitive.

### Completeness and Edge Cases

- **Minor**: Fast reminder timing is derived heuristically.
  - Why problematic: the rule is sensible, but it is embedded in utility logic without a documented product policy. Future changes will be easy to break.
  - Direction: document the reminder timing policy or make it configuration-driven.

- **Minor**: Daily plan storage and scheduling depend on local day boundaries.
  - Why problematic: timezone changes, daylight savings changes, and app inactivity windows could produce confusing reminder behavior.
  - Direction: define timezone and day-rollover assumptions explicitly.

- **Minor**: Several screens use imperative local timeout logic for transient UI states.
  - Why problematic: toasts, saved states, and delayed focus are scattered and unmanaged. This can create subtle cleanup or UX timing drift.
  - Direction: centralize transient-feedback timing behavior where it becomes repeated.

## Suggestions

- **Suggestion**: Introduce a feature ownership map.
  - Why problematic today: “where should this logic live?” is not consistently answered by the current structure.
  - Direction: define a small architecture policy for screen, component, hook, store, utility, and service responsibilities.

- **Suggestion**: Add a “done means polished” refinement checklist.
  - Why problematic today: the app shows signs of features being added functionally first and polished later, which leaves many partial abstractions behind.
  - Direction: require each feature to clear layout, state, error, accessibility, and interaction criteria before considered complete.

- **Suggestion**: Track visual debt separately from product debt.
  - Why problematic today: visual inconsistency and architectural shortcuts are intertwined, making remediation harder to prioritize.
  - Direction: maintain parallel workstreams for UI system hardening and behavior/domain hardening.

## Recommended Resolution Order

### Phase 1: High-risk architecture
1. Untangle bootstrap responsibilities from `app/_layout.tsx`
2. Rework notification orchestration into clearer domains
3. Remove `as never` / `as unknown` DB type bypasses
4. Reconsider gesture ownership in `Screen`

### Phase 2: UX system hardening
1. Make bottom-safe regions and composer/footer behavior declarative
2. Standardize destructive actions and confirmation patterns
3. Complete token adoption and reduce local layout overrides
4. Normalize typography and metric emphasis usage

### Phase 3: Refinement and consistency
1. Clean up copy tone and naming drift
2. Add automated lint/type/test gates
3. Clarify reminder policy and timezone behavior
4. Define responsive behavior beyond the primary phone path

## Final Assessment
The application shows strong momentum and visible effort toward polish, but the implementation still carries multiple signs of rushed layering: screen-local compensation, hidden side effects, type escapes, and navigation/gesture behavior implemented outside their natural ownership boundaries. The next refinement phase should prioritize architectural coherence as much as visual polish; otherwise each additional quality improvement will cost more and remain less stable than it should.
