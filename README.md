# Voice Form Filler

Fill out paper forms by talking. Describe what you're doing while you work, for example while inspecting a fire protection gate. When you're done, the app fills in the form and gives you a PDF.

It is a static web app (PWA) that runs on GitHub Pages and can be installed on your phone's home screen.

## How it works

1. **Set up a form once.** Photograph the blank form or upload it as a PDF. Claude finds the fields (labels, tick boxes, lines), and you adjust the boxes by dragging them.
2. **Record.** Press Start and talk normally: location, what you check, what's OK, defects, measurements.
3. **Fill.** The speech is turned into text, and Claude maps it onto the form's fields. Anything that wasn't mentioned stays empty; Claude doesn't guess.
4. **Review.** Missing or uncertain fields are highlighted, and 🔊 reads them aloud. Correct them by voice ("door closer is not OK") or by typing.
5. **PDF.** The values are written onto your scanned form. Download or share it.

## Setup

### 1. Publish on GitHub Pages
- Repository **Settings → Pages → Source: GitHub Actions**.
- Merge to `main`. The workflow `.github/workflows/deploy.yml` tests, builds and deploys.
- The app will be at `https://<your-user>.github.io/pure-voice-form-filler/`.
- On your phone, open the link, then use **Add to Home Screen**.

### 2. Keys (entered in the app under ⚙️ Settings)
| Service | What for | Needed? |
|---|---|---|
| [Anthropic](https://console.anthropic.com/settings/keys) | Detects form fields and fills the form (Claude) | Yes |
| [Deepgram](https://console.deepgram.com) | More accurate speech recognition; records offline and transcribes later | Optional |

Without Deepgram, the app uses the browser's built-in speech recognition. It's free and shows the text live, but it needs internet while you record and is less accurate with technical terms.

**Security:** there is no server. Keys are stored only on your device (IndexedDB) and sent straight to Anthropic or Deepgram. Don't save your keys on a shared device. Before giving the app to colleagues, put a small proxy in front of the APIs so the keys aren't on every phone.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/pure-voice-form-filler/
npm test           # unit tests
npm run build      # production build into dist/
```

Code map:
- `src/lib/claude/`: Claude calls (`detect.ts` reads blank forms; `extract.ts` fills and corrects), using structured JSON outputs
- `src/lib/template/schema.ts`: form template → output schema, value normalisation, merge rules
- `src/lib/stt/`: speech recognition (browser Web Speech API or Deepgram)
- `src/lib/recorder.ts`: microphone recording, saved to IndexedDB every 3 seconds
- `src/lib/pdf/`: importing scans and PDFs (`pages.ts`) and writing the filled PDF (`render.ts`)
- `src/pages/`: screens

Forms can be exported and imported as `.form.json` files, for backups or to share a form setup.

## Roadmap
- Guided question-and-answer mode for long forms (for example tax forms)
- Photos per inspection point
- Optional key proxy for shared use
- Hands-free voice commands
