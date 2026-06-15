from __future__ import annotations

from typing import Any
import os

import httpx

PUBLIC_SEARCH_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs"

DEFAULT_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.arbeitsagentur.de",
    "Referer": "https://www.arbeitsagentur.de/jobsuche/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    ),
    "X-API-Key": "jobboerse-jobsuche",
}


def should_verify_ssl() -> bool:
    return os.getenv("BA_API_VERIFY_SSL", "true").lower() not in {"0", "false", "no"}


async def search_jobs(
    keyword: str | None = None,
    location: str | None = None,
    page: int = 1,
    size: int = 25,
    angebotsart: str | None = None,
) -> dict[str, Any] | list[Any]:
    params: dict[str, Any] = {
        "page": max(page, 1),
        "size": min(max(size, 1), 100),
    }

    if keyword:
        params["was"] = keyword
    if location:
        params["wo"] = location
    if angebotsart:
        params["angebotsart"] = angebotsart

    async with httpx.AsyncClient(
        timeout=20,
        headers=DEFAULT_HEADERS,
        verify=should_verify_ssl(),
    ) as client:
        response = await client.get(PUBLIC_SEARCH_URL, params=params)
        response.raise_for_status()
        return response.json()


def extract_job_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if not isinstance(payload, dict):
        return []

    preferred_keys = (
        "ergebnisliste",
        "stellenangebote",
        "angebote",
        "jobs",
        "items",
        "results",
        "content",
        "data",
    )

    for key in preferred_keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = extract_job_items(value)
            if nested:
                return nested

    best_match: list[dict[str, Any]] = []
    for value in payload.values():
        nested = extract_job_items(value)
        if len(nested) > len(best_match):
            best_match = nested

    return best_match


def value_at(item: dict[str, Any], *paths: str) -> Any:
    for path in paths:
        current: Any = item
        for part in path.split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            elif isinstance(current, list):
                values = []
                for entry in current:
                    if isinstance(entry, dict) and part in entry:
                        values.append(entry[part])
                current = values
            else:
                current = None
                break
        if current not in (None, "", []):
            return current
    return ""


def flatten_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return ", ".join(part for part in (flatten_value(item) for item in value) if part)
    if isinstance(value, dict):
        parts = []
        for key in ("name", "bezeichnung", "ort", "plz", "strasse", "region"):
            if key in value:
                part = flatten_value(value[key])
                if part:
                    parts.append(part)
        if parts:
            return ", ".join(parts)
        return ", ".join(
            part for part in (flatten_value(item) for item in value.values()) if part
        )
    return str(value)


def normalize_job(item: dict[str, Any]) -> dict[str, str]:
    reference = value_at(
        item,
        "referenznummer",
        "refnr",
        "refNr",
        "reference",
        "id",
        "hashId",
        "stellenangebotsId",
    )
    title = value_at(
        item,
        "titel",
        "title",
        "stellenangebotsTitel",
        "stellenbezeichnung",
        "beruf",
        "jobtitel",
        "berufsbezeichnung",
    )
    employer = value_at(
        item,
        "arbeitgeber",
        "arbeitgebername",
        "firma",
        "unternehmen",
        "company",
        "betrieb.name",
    )
    location = value_at(
        item,
        "arbeitsort",
        "arbeitsorte",
        "stellenlokationen.adresse.ort",
        "ort",
        "standort",
        "location",
        "adresse.ort",
    )
    postal_code = value_at(
        item,
        "plz",
        "postleitzahl",
        "stellenlokationen.adresse.plz",
        "arbeitsort.plz",
        "adresse.plz",
        "arbeitsorte.plz",
    )
    occupation = value_at(
        item,
        "beruf",
        "berufsbezeichnung",
        "hauptberuf",
        "occupation",
        "berufsfeld",
        "branche",
    )
    url = value_at(
        item,
        "url",
        "link",
        "externeURL",
        "stellenangebotUrl",
        "detailUrl",
        "externalUrl",
    )

    url_text = flatten_value(url)
    if not url_text and reference:
        url_text = f"https://www.arbeitsagentur.de/jobsuche/jobdetail/{flatten_value(reference)}"

    return {
        "Reference": flatten_value(reference),
        "Title": flatten_value(title),
        "Employer": flatten_value(employer),
        "Location": flatten_value(location),
        "Postal Code": flatten_value(postal_code),
        "Occupation": flatten_value(occupation),
        "URL": url_text,
    }
