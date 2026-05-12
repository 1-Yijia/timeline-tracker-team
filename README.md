# Timeline Tracker

A date-aware project timeline dashboard built with React + Vite.

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:5173

## Project Structure

```
src/
├── data/
│   └── constants.js        # STAGES, labels, colours, seed data
├── hooks/
│   └── useTimeline.js      # All state + business logic (localStorage)
├── components/
│   ├── UI.jsx              # Button, Modal, FormField, Input, Select, Textarea
│   ├── FeatureCard.jsx     # Individual feature card with hover actions
│   ├── FeatureModal.jsx    # Add / edit feature form
│   └── AddRowModal.jsx     # Add product × market row
├── App.jsx                 # Main table layout
├── main.jsx                # React entry point
└── index.css               # CSS variables + global reset
```

## How It Works

### Manual stages (Pipeline → FRF → PRD)
Move features yourself using the ← back / next → buttons on hover,
or edit the feature and change the Stage dropdown.

### Auto-progression (Scheduled → Dev → Test → UAT → Live)
When you move a feature to Scheduled, enter a timeline in the edit modal:

```
dev 2026.04.27-2026.05.29
test 2026.06.01-2026.06.19
uat 2026.06.15-2026.06.24
live 2026.06.25-2026.06.25
```

The app reads today's date on every load and automatically places the feature
in the correct column. If today is 2026.04.27, it shows in Dev.
If today is 2026.06.01, it jumps to Test. The active date range is shown
under the feature name on the card.

### Links
Each feature supports a PRD link and a Jira link — click the pill badges
on a card to open them in a new tab.

### Persistence
Everything is saved to `localStorage` under the key `timeline-tracker-v2`.
No backend required.

## Customising

- **Add stages**: Edit `STAGES` array in `src/data/constants.js`
- **Change colours**: Edit `STAGE_COLORS` in the same file
- **Default seed rows**: Edit `DEFAULT_ROWS` and `DEFAULT_FEATURES`
- **Swap localStorage for an API**: Replace the `load()` / `save()` functions
  in `src/hooks/useTimeline.js`
