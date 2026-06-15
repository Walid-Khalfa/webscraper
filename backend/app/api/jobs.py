from __future__ import annotations

import csv
import io
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.services.arb_api import extract_job_items, normalize_job, search_jobs

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/search")
async def search(
    keyword: Annotated[str | None, Query(description="Job title or keyword")] = None,
    location: Annotated[str | None, Query(description="City, postal code, or region")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 25,
    angebotsart: Annotated[str | None, Query(description="Optional offer type, e.g. 1 or 4")] = None,
):
    try:
        return await search_jobs(keyword, location, page, size, angebotsart)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Bundesagentur API returned {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/export/csv")
async def export_csv(
    keyword: Annotated[str | None, Query(description="Job title or keyword")] = None,
    location: Annotated[str | None, Query(description="City, postal code, or region")] = None,
    angebotsart: Annotated[str | None, Query(description="Optional offer type, e.g. 1 or 4")] = None,
):
    rows: list[dict[str, str]] = []

    try:
        for page in (1, 2):
            payload = await search_jobs(keyword, location, page=page, size=100, angebotsart=angebotsart)
            rows.extend(normalize_job(item) for item in extract_job_items(payload))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Bundesagentur API returned {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    output = io.StringIO()
    fieldnames = ["Reference", "Title", "Employer", "Location", "Postal Code", "Occupation", "URL"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows[:200])

    filename_parts = [
        "jobs",
        (keyword or "all").strip().replace(" ", "-"),
        (location or "germany").strip().replace(" ", "-"),
    ]
    filename = "-".join(part for part in filename_parts if part) + ".csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
