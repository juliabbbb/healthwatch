Standing Directive

You are replacing the current Anthropic Claude API integration in HEALTHWATCH's AI Analysis assistant with the Groq API, using Llama 4 Scout or Llama 3.3 70B as the model. Groq is free (no credit card required), OpenAI-SDK-compatible, and delivers 300–500 tokens/second on LPU hardware — significantly faster than Claude for this use case. The AI analysis assistant provides disease surveillance insights for Philippine regional health data. The system prompt, response formatting, and frontend display must remain intact. Only the provider, client SDK, model name, and API key env var change. This is a backend-only change.

System Context
Backend: FastAPI (Python)
Current AI provider: Anthropic SDK (anthropic Python package)
Target AI provider: Groq API (OpenAI-compatible, groq Python package)
Target model: llama-4-scout-17b-16e-instruct (primary) with llama-3.3-70b-versatile as fallback
Groq free tier: 30 RPM, 14,400 RPD — sufficient for a surveillance dashboard with low concurrent users
Groq API key: obtained free from console.groq.com (no credit card)
Deployment: Render — add GROQ_API_KEY as an environment variable
The AI analysis likely lives in a dedicated route, e.g., /api/analysis, /api/ai, or similar
Full Task List
3.1 — Audit the Current Anthropic Integration
Search the backend for all Anthropic SDK usage:
import anthropic
from anthropic import
client.messages.create
anthropic.Anthropic()
ANTHROPIC_API_KEY
Any claude- model string references
List every file, function, and the exact system prompt being used
Note the exact message format: whether it uses messages=[{"role": "user", "content": "..."}] or other structure
Note whether the response is streamed or returned as a single completion
3.2 — Install the Groq SDK
Add to requirements.txt:
  groq>=0.9.0
Do NOT remove anthropic from requirements yet — keep it commented out until the swap is verified
Run pip install groq in the development environment to verify it installs cleanly
3.3 — Create the Groq Client Module
Create (or replace content of) the AI client file, e.g., backend/services/ai_client.py:
python
  import os
  from groq import Groq

  GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
  if not GROQ_API_KEY:
      raise RuntimeError(
          "GROQ_API_KEY environment variable is not set. "
          "Get a free key at console.groq.com"
      )

  groq_client = Groq(api_key=GROQ_API_KEY)

  PRIMARY_MODEL = "llama-4-scout-17b-16e-instruct"
  FALLBACK_MODEL = "llama-3.3-70b-versatile"


  def get_ai_analysis(system_prompt: str, user_message: str) -> str:
      """
      Call Groq API for AI analysis. Falls back to secondary model on failure.
      Returns the assistant's text response as a string.
      """
      for model in [PRIMARY_MODEL, FALLBACK_MODEL]:
          try:
              response = groq_client.chat.completions.create(
                  model=model,
                  messages=[
                      {"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_message},
                  ],
                  max_tokens=1024,
                  temperature=0.3,  # Lower temp for factual health analysis
              )
              return response.choices[0].message.content
          except Exception as e:
              if model == FALLBACK_MODEL:
                  raise RuntimeError(f"Both Groq models failed: {e}") from e
              continue
3.4 — Update the AI Analysis Route / Service
In the FastAPI route that currently calls the Anthropic client:
Replace the Anthropic client call with get_ai_analysis(system_prompt, user_message)
The system_prompt must be PRESERVED exactly as it was — do not rewrite it
The user_message construction (using the disease data context) must be PRESERVED exactly
The response structure returned to the frontend must be PRESERVED exactly
Example replacement:
python
  # BEFORE (Anthropic):
  response = anthropic_client.messages.create(
      model="claude-...",
      system=system_prompt,
      messages=[{"role": "user", "content": user_message}],
      max_tokens=1024,
  )
  result_text = response.content[0].text

  # AFTER (Groq):
  from services.ai_client import get_ai_analysis
  result_text = get_ai_analysis(system_prompt, user_message)
The variable result_text (or whatever name is used) feeds into the same response object as before
3.5 — Handle Streaming (If Currently Used)
If the current implementation uses SSE (Server-Sent Events) or streaming response:
Groq also supports streaming: groq_client.chat.completions.create(..., stream=True)
Streaming with Groq follows the same OpenAI-compatible iterator pattern:
python
    stream = groq_client.chat.completions.create(..., stream=True)
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        yield delta
Wrap this in a StreamingResponse in FastAPI exactly as it was done with the Anthropic stream
If NOT streaming: ignore this step
3.6 — Add the Groq API Key to Render
In the Render dashboard for the backend Web Service:
Go to Environment → Add environment variable
Key: GROQ_API_KEY
Value: the API key from console.groq.com
Do NOT commit the API key to the repository
Add GROQ_API_KEY to .env.example (without value) so it is documented
3.7 — Remove Anthropic SDK (After Verification)
After deploying to Render and confirming the AI analysis works end-to-end:
Remove anthropic from requirements.txt
Remove ANTHROPIC_API_KEY from Render environment variables
Remove any import anthropic statements from all backend files
Run pip uninstall anthropic locally
3.8 — Rate Limit Awareness
Groq free tier: 30 RPM per model
HEALTHWATCH is a low-concurrency dashboard — this is more than sufficient
If you see 429 errors: add a simple retry with exponential backoff:
python
  import time

  def get_ai_analysis_with_retry(system_prompt: str, user_message: str, retries=3) -> str:
      for attempt in range(retries):
          try:
              return get_ai_analysis(system_prompt, user_message)
          except Exception as e:
              if "429" in str(e) and attempt < retries - 1:
                  time.sleep(2 ** attempt)
              else:
                  raise
3.9 — Do NOT Touch
The system prompt content (health analysis instructions for Philippine disease data)
The data passed to the AI (case counts, region codes, seasonality scores, etc.)
Any frontend AI display component
Any loading states or error states in the frontend
The API route path/URL
Any other backend routes

Do NOT change any feature behavior — only what is explicitly stated in each plan
Do NOT upgrade or downgrade any package versions unless required by the plan
Do NOT rename any existing API routes, query keys, or data shapes
Do NOT touch the render.yaml (Render Blueprint IaC) unless adding an env var reference
When in doubt about scope: do less, not more — then ask
All new files must follow the existing project's file naming convention (kebab-case or PascalCase as observed in the project)
All TypeScript must be strictly typed — no any unless the existing codebase already uses it in that file