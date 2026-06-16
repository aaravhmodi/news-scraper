# BiasBuster

## Demo

https://github.com/user-attachments/assets/3e4184f8-c834-42f6-8369-9c9f38fb3646

BiasBuster is a web app for comparing how different news outlets frame the same event. It goes beyond surface-level sentiment analysis — every finding is grounded in peer-reviewed communication research and explained with the academic theory behind it.

It is **not** a fake-news detector and does not rate the moral value of any outlet.

## What It Analyzes

For each article:
- **Headline framing** — which words set the reader's interpretive lens before they read a word
- **Tone & spin** — scored on a −1 (critical) to +1 (supportive) scale with spin direction
- **NRC Emotion Lexicon scores** — anger, fear, trust, disgust, anticipation, joy, sadness, surprise (Mohammad & Turney, 2013)
- **Entman framing functions** — define / diagnose / evaluate / recommend (Entman, 1993)
- **Framing type** — episodic (event-focused) vs. thematic (systemic/contextual) (Iyengar, 1991)
- **Loaded words & emotional language** — phrases that shape interpretation
- **Blame / credit attribution** — who the article positions as responsible
- **Quoted source diversity** — who gets a voice and what stance they represent
- **Detected bias types** with academic citations:
  - *Coverage bias* — Agenda-Setting Theory (McCombs & Shaw, 1972)
  - *Gatekeeping bias* — Gatekeeping Theory (Shoemaker & Vos, 2009)
  - *Statement bias* — Framing Theory (Entman, 1993)
  - *Spin bias* — Valence Framing (Levin et al., 1998)
  - *Ideology bias* — Media Slant Theory (Groseclose & Milyo, 2005)

Across articles: shared facts, framing divergence, cross-source diagnosis, and a final BiasBuster insight comparing all sources.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, SQLite, Pydantic v2 |
| Extraction | `trafilatura` with BeautifulSoup fallback |
| AI | Groq (Llama 3.3 70B) via OpenAI-compatible SDK; heuristic fallback if no key |

## Visualizations

- **Framing Map** — scatter of tone score vs. emotional intensity, colored by spin direction (Entman 1993 · Levin et al. 1998)
- **Tone Comparison** — horizontal bar showing each source's tone score (−1 to +1)
- **Bias Type Profile** — stacked bar of detected bias instances per type per source (Rodrigo-Ginés et al. 2024)
- **Emotion Profile** — radar chart of NRC emotion scores across all 8 dimensions per source (Mohammad & Turney 2013)

## Setup

```bash
cp .env.example .env
# Edit .env and set GROQ_API_KEY (free at console.groq.com)
npm install
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

Without a `GROQ_API_KEY` the app still runs using a deterministic heuristic fallback — useful for demos, but LLM analysis is significantly richer.

## Run

**Terminal 1 — API server:**
```bash
npm run backend
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Open `http://localhost:3000`.

## Usage Flow

1. Enter a topic (e.g. *"Canada housing affordability"*).
2. Paste 3–10 article URLs from different outlets covering the same event.
3. Optionally paste raw article text manually for pages that block extraction.
4. Click **Analyze Coverage**.
5. Review:
   - Executive insight and neutral event summary
   - Framing comparison table (frame, core claim, responsible actor, implied solution)
   - Headline framing analysis
   - Loaded language table
   - Source-by-source analysis with Entman framing functions
   - Emphasis vs. underemphasis breakdown
   - Four interactive charts
   - Per-article detail modal with academic citations per bias finding
6. Export the full report as Markdown.

## Academic Framework

BiasBuster's analysis is structured around the following peer-reviewed frameworks:

| Framework | Reference |
|---|---|
| Framing Theory | Entman, R.M. (1993). *Journal of Communication*, 43(4), 51–58 |
| Agenda-Setting | McCombs, M.E. & Shaw, D.L. (1972). *Public Opinion Quarterly*, 36(2), 176–187 |
| Episodic vs. Thematic Framing | Iyengar, S. (1991). *Is Anyone Responsible?* University of Chicago Press |
| Gatekeeping Theory | Shoemaker, P.J. & Vos, T.P. (2009). *Gatekeeping Theory*. Routledge |
| Valence Framing | Levin, I.P. et al. (1998). *OBHDP*, 76(2), 149–188 |
| Media Slant | Groseclose, T. & Milyo, J. (2005). *QJE*, 120(4), 1191–1237 |
| NRC Emotion Lexicon | Mohammad, S.M. & Turney, P.D. (2013). *Computational Intelligence*, 29(3) |
| Bias Taxonomy | Rodrigo-Ginés, F.J. et al. (2024). *Information Processing & Management* |

## Disclaimer

BiasBuster analyzes framing patterns in the provided articles only. It does not determine absolute truth, label outlets as good or bad, or claim intentional bias unless directly supported by text evidence. Possible omissions are flagged as prompts for further review, not proven defects.
