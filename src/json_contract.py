"""Strict finite JSON without silently substituting numerical zero."""
import math
from starlette.responses import JSONResponse


def number(value):
    try:
        result=float(value)
        return result if math.isfinite(result) else None
    except (TypeError,ValueError):return None


def clean(value):
    if isinstance(value,dict):return {key:clean(item) for key,item in value.items()}
    if isinstance(value,(list,tuple)):return [clean(item) for item in value]
    if isinstance(value,float) and not math.isfinite(value):return None
    return value


class FiniteJSONResponse(JSONResponse):
    def render(self,content):return super().render(clean(content))
