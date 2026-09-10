---
## PLAN 2 — REMOVE GEMINI, USE ONLY GROQ LLAMA 4

### Standing Directive
You are working on HealthWatch — a Philippine regional dengue outbreak forecasting and hotspot classification system. Backend is FastAPI + Anthropic SDK + SQLAlchemy. The existing codebase has Gemini Flash integrated for LLM features. Your job is to surgically remove all Gemini references and replace with Groq's Llama 4 model. Do not touch forecasting (Prophet) logic, database logic, or frontend unless a frontend prompt/response display needs updating. Read files before editing. Be precise.

### System Context
HealthWatch uses an LLM for AI-assisted interpretation — likely for generating natural-language outbreak summaries, intervention recommendations, or risk narrative text displayed on the dashboard. This was previously wired to Google Gemini Flash. The codebase uses Anthropic SDK (`anthropic`) in the stack listing but Gemini was also integrated, suggesting both may coexist or Gemini was a later addition. We are removing Gemini entirely and standardizing on **Groq's Llama 4** model.

### Item 3 — Remove Gemini, Wire Groq Llama 4

**Step 1 — Full audit of Gemini references.**
Search the entire codebase for:
- `gemini` (case-insensitive)
- `google-generativeai` or `google.generativeai`
- `GenerativeModel`, `genai`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`
- Any `.env` or `render.yaml` references to Gemini keys
List every file found. Do not modify yet.

**Step 2 — Audit Groq availability.**
- Check `requirements.txt` or `pyproject.toml` for `groq` package. If missing, add `groq>=0.9.0`.
- Check if `GROQ_API_KEY` is already present in `.env.example`, `render.yaml`, or any config file.
- Note: Groq API is OpenAI-compatible. The client is: `from groq import Groq; client = Groq(api_key=os.environ["GROQ_API_KEY"])`

**Step 3 — Replace the LLM client.**
For every location where Gemini was called:
- Remove the `google.generativeai` import and client initialization.
- Replace with Groq client initialization:
```python
  from groq import Groq
  _groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
```
- Replace the Gemini `generate_content(prompt)` call pattern with:
```python
  completion = _groq_client.chat.completions.create(
      model="meta-llama/llama-4-scout-17b-16e-instruct",
      messages=[{"role": "user", "content": prompt}],
      max_tokens=1024,
      temperature=0.3,
  )
  result_text = completion.choices[0].message.content
```
- Use `llama-4-scout-17b-16e-instruct` as the primary model. If Groq adds Llama 4 Maverick to their API (check their model list), use `meta-llama/llama-4-maverick-17b-128e-instruct` as a fallback option with a comment noting the upgrade path.
- Wrap the Groq call in a try/except. On exception, return a safe fallback string: `"AI summary unavailable. Please refer to the forecast data directly."` — never let LLM failure crash the API response.

**Step 4 — Clean up.**
- Remove `google-generativeai` from `requirements.txt` / `pyproject.toml`.
- Remove any `GEMINI_API_KEY` or `GOOGLE_API_KEY` from `.env.example` (replace with a comment: `# Removed: GEMINI_API_KEY — replaced by GROQ_API_KEY`).
- Remove Gemini from `render.yaml` environment variable definitions.
- Search for any frontend `.env` references to Gemini and remove.

**Step 5 — Render environment variable instructions (READ THIS CAREFULLY).**
You (the dev running this) must do the following manually on Render dashboard:
1. Go to your HealthWatch API service on Render → Environment → Environment Variables.
2. ADD: `GROQ_API_KEY` = your Groq API key from https://console.groq.com/keys
3. DELETE: `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) from the environment variables list.
4. Trigger a manual deploy after saving the env vars.
The code change alone will not work until the env var is set on Render. Big pickle cannot do this for you — this is a manual step on the Render dashboard.

**Step 6 — Verify.**
After replacement, search the entire codebase one more time for any remaining `gemini` or `google.generativeai` strings. If any remain, remove them. Leave zero Gemini references.