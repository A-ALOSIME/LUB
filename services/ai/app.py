"""Public-source retrieval only. No database, user session, embeddings or model calls.

FastAPI dependency/auth/testing patterns: https://fastapi.tiangolo.com/reference/security/
"""
import json
import os
import re
import secrets
import time
from pathlib import Path
from threading import Lock
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, ValidationError

TOKEN = os.environ.get("AI_SERVICE_TOKEN", "")
if len(TOKEN) < 32 or not TOKEN.isascii():
    raise RuntimeError("Configure a server-only AI_SERVICE_TOKEN of at least 32 ASCII characters")
DOCUMENTS = json.loads(Path(__file__).with_name("knowledge.json").read_text(encoding="utf-8"))
STOP_WORDS = {"في", "من", "على", "عن", "الى", "هل", "وش", "كيف", "ابي", "انا", "هو", "ما", "مع", "لي", "ان", "the", "is", "a"}


def tokens(text: str) -> set[str]:
    text = re.sub(r"[\u064b-\u065f\u0670ـ]", "", text.lower())
    text = text.translate(str.maketrans("أإآى", "اااي"))
    result = set(re.findall(r"[\w]+", text))
    return {word[2:] if word.startswith("ال") and len(word) > 4 else word for word in result if len(word) > 1 and word not in STOP_WORDS}


INDEX = [(doc, tokens(doc["title"] + " " + doc["text"])) for doc in DOCUMENTS]
auth_scheme = HTTPBearer(auto_error=False)
app = FastAPI(title="LUB public knowledge", docs_url=None, redoc_url=None, openapi_url=None)
lock = Lock()
window_started = time.monotonic()
requests_in_window = 0


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    question: str = Field(strict=True, min_length=3, max_length=500)


def authorize(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(auth_scheme)]) -> None:
    if credentials is None or not secrets.compare_digest(credentials.credentials.encode(), TOKEN.encode()):
        raise HTTPException(401, "Unauthorized")


@app.exception_handler(RequestValidationError)
async def safe_validation(_request: Request, _error: RequestValidationError):
    return JSONResponse({"detail": "Invalid request"}, status_code=422)


@app.get("/health")
def health():
    return {"status": "ok", "mode": "sources", "generated": False}


@app.post("/v1/search", dependencies=[Depends(authorize)])
async def search(request: Request):
    global window_started, requests_in_window
    # Global bounded admission, independent of spoofable forwarded client addresses.
    # Run one worker; a shared limiter is required before scaling to multiple replicas.
    with lock:
        now = time.monotonic()
        if now - window_started >= 60:
            window_started, requests_in_window = now, 0
        if requests_in_window >= 30:
            raise HTTPException(429, "Try later", headers={"Retry-After": "60"})
        requests_in_window += 1
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 4096:
            raise HTTPException(413, "Request too large")
    try:
        question = Question.model_validate_json(bytes(body)).question
        if re.search(r"[\x00-\x1f\x7f]", question):
            raise ValueError()
    except (ValidationError, ValueError):
        raise HTTPException(422, "Invalid request") from None
    words = tokens(question)
    ranked = sorted(((len(words & terms), doc) for doc, terms in INDEX), key=lambda item: (-item[0], item[1]["id"]))
    sources = [{"id": doc["id"], "title": doc["title"], "url": doc["url"], "excerpt": doc["text"]} for score, doc in ranked if score > 0][:3]
    return JSONResponse({"mode": "sources", "generated": False, "sources": sources}, headers={"Cache-Control": "no-store"})
