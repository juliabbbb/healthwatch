"""Conservative narration gate until a reviewed semantic generation corpus exists."""
from hashlib import sha256
import json


def guard(candidate, grounding, safe_text, provider):
    # Token/number overlap cannot prove a sentence's meaning. Only a complete
    # deterministic rendering of the payload is accepted without semantic review.
    accepted = candidate.strip() == safe_text.strip()
    return dict(text=candidate if accepted else safe_text,
                fallback=not accepted,
                reason=None if accepted else 'unverified_semantic_claim',
                raw_output=candidate, provider=provider,
                payload_sha256=sha256(json.dumps(grounding,sort_keys=True,default=str).encode()).hexdigest(),
                policy_version='deterministic-rendering-v1',
                live_semantic_validation=False)
