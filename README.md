# Treadmill FIT Rewriter

Treadmill FIT Rewriter is a web application that rewrites treadmill activity `.fit` files with corrected speed and distance while preserving existing sensor data such as heart rate and cadence.

The project is designed for users who run on treadmills but get inaccurate pace/distance in recorded activities, and need a corrected FIT file that remains interoperable with platforms like Strava.

## Core Capabilities

- Ingest binary `.fit` activity files in the browser.
- Parse workout prescription from:
  - visual step builder, or
  - text notation (Intervals-style).
- Rewrite record-level speed and distance series.
- Recalculate lap/session/activity totals.
- Inject workout metadata and workout linkage messages.
- Preview original vs corrected speed profile before download.
- Export a corrected `.fit` file for upload.

## How It Works

1. The app decodes the uploaded FIT in the browser using `@garmin/fitsdk` while preserving message schemas.
2. Record messages are grouped by timestamp and converted into a processing timeline.
3. Corrected speed is calculated from the user-defined workout prescription.
4. Corrected cumulative distance is re-integrated across the full record stream.
5. Existing messages are patched in place:
   - `record`: speed / enhanced speed / distance
   - `lap` and `session`: aggregate totals (time, distance, avg/max speed)
   - `activity`: total timer time
6. Workout linkage messages are injected:
   - `training_file`
   - `workout`
   - `workout_step`
   - lap segmentation with `wktStepIndex` mapping
7. The FIT is re-encoded and downloaded directly in the browser.

## Workout Association Strategy

To maximize workout recognition by third-party consumers:

- `workout` uses `capabilities = tcx` and `subSport = generic`.
- `training_file` is written with `type = workout` and `product = 65534`.
- Step-level workout information is written in `workout_step` messages.
- Laps are generated for workout steps and mapped with `wktStepIndex`.
- Session lap counters are updated (`numLaps`, `firstLapIndex`).

This combination was implemented from inspection of real FIT files that are correctly recognized with associated workouts.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Garmin FIT SDK for JavaScript (`@garmin/fitsdk`)

## Local Development

### Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (or compatible)

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev -- --port 3017
```

Open [http://localhost:3017](http://localhost:3017).

### Quality Checks

```bash
npm run lint
npm run build
```

## Usage

1. Upload a `.fit` activity file.
2. Define the real workout using:
   - visual builder, or
   - text notation such as `3x(2m@14km/h,1m@8km/h)`.
3. Process the file.
4. Review summary metrics and the speed comparison chart.
5. Download the corrected `.fit`.
6. Upload the corrected file to your target platform.

## Project Structure

```text
src/
  app/
    globals.css                  # theme and global styling
    layout.tsx                   # root app layout
    page.tsx                     # home page
  components/
    fit/
      FitCorrectionStudio.tsx    # main UI flow
      SpeedComparisonChart.tsx   # original vs corrected chart
    layout/
      Header.tsx
      Sidebar.tsx
    ui/
      button.tsx
      input.tsx
      badge.tsx
  lib/
    fit/
      correction.ts              # decode/patch/encode FIT logic
      prescription.ts            # notation parser + segment helpers
    utils.ts
```

## Known Limitations

- FIT interoperability can vary by consumer implementation and FIT profile interpretation.
- Some device/vendor-specific private fields are preserved when possible, but not all proprietary semantics can be guaranteed.
- Workout association behavior can differ across platform revisions.

## Data Handling

- Processing is local to the browser and in-memory.
- No persistence layer is included by default.
- No external telemetry pipeline is required for core processing.

## GitHub Pages Deployment

This project is configured for static export (`output: "export"`) and deploys automatically to GitHub Pages through GitHub Actions.

1. Push to `main`.
2. In GitHub repository settings:
   - go to `Settings > Pages`;
   - set `Source` to `GitHub Actions`.
3. Wait for workflow `Deploy To GitHub Pages` to complete.

Default URL format:

- `https://<your-user>.github.io/<your-repo>/`

## License

No license file is currently included in this repository.
If you plan to publish or distribute this project, add an explicit license file.
