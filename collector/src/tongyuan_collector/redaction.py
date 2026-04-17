from __future__ import annotations

import re
from urllib.parse import urlunsplit, unquote, urlsplit


REDACTION_RULES: list[tuple[str, re.Pattern[str], str]] = [
    ("phone", re.compile(r"(?<!\d)(1[3-9]\d{9})(?!\d)"), "[REDACTED_PHONE]"),
    ("email", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE), "[REDACTED_EMAIL]"),
    ("bearer", re.compile(r"Bearer\s+[A-Za-z0-9._\-]+", re.IGNORECASE), "Bearer [REDACTED_TOKEN]"),
    ("openai", re.compile(r"sk-[A-Za-z0-9]{12,}"), "[REDACTED_API_KEY]"),
    ("cookie", re.compile(r"(?im)^(set-cookie|cookie)\s*:\s*.+$"), r"\1: [REDACTED_COOKIE]"),
]

ASSIGNMENT_RULE = re.compile(
    r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key)\b\s*[:=]\s*([^\s;,]+)"
)

CONNECTION_STRING_RULE = re.compile(
    r"(?i)\b(User ID|Uid|Server|Host|Database|Initial Catalog|Password)\b\s*=\s*([^;]+)"
)
URL_RULE = re.compile(r"https?://[^\s\"'>)]+", re.IGNORECASE)


def _sanitize_url(match: re.Match[str]) -> str:
    raw_url = match.group(0).rstrip("',.;")
    suffix = match.group(0)[len(raw_url) :]
    try:
        parsed = urlsplit(raw_url)
        cleaned_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
    except ValueError:
        cleaned_url = raw_url.split("?", 1)[0].split("#", 1)[0]
    cleaned_url = unquote(cleaned_url)
    return f"{cleaned_url}{suffix}"


def redact_text(content: str) -> str:
    redacted = content
    for _, rule, replacement in REDACTION_RULES:
        redacted = rule.sub(replacement, redacted)

    redacted = ASSIGNMENT_RULE.sub(lambda match: f"{match.group(1)}=[REDACTED]", redacted)
    redacted = CONNECTION_STRING_RULE.sub(lambda match: f"{match.group(1)}=[REDACTED]", redacted)
    redacted = URL_RULE.sub(_sanitize_url, redacted)
    return redacted
