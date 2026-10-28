# VocabQuest Dev — feature update

This build adds:
- App-wide light/dark mode toggle, remembering the selected theme.
- Synthesized sound effects for correct answers, wrong answers, and completing a level/review.
- Randomly interleaved extra practice: after a wrong answer, five repetitions are queued and selected among other active words when possible.
- Updated service-worker cache version and network-first fetching for HTML/CSS/JS to reduce stale app updates.

## Deploy
Upload/replace all files in this folder in your `vocabquest-dev` GitHub repository, commit, and wait for GitHub Pages deployment to succeed. Keep the stable `vocabquest` repository unchanged.

## Notes
Sound effects are generated locally using Web Audio; no audio files or network requests are needed. On iPhone, the first answer tap enables audio playback under Safari's user-interaction rules.
Learning progress uses localStorage with the existing `vocabquest-state-v1` key, so this code is compatible with the existing app state format for this build.
