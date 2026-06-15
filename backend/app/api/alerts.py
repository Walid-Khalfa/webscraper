from __future__ import annotations

from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.agencies import get_current_agency
from app.db.database import get_db
from app.models.agency import Agency, EmailDelivery, SearchSubscription
from app.services.arb_api import extract_job_items, normalize_job, search_jobs
from app.services.emailer import build_jobs_email_html, send_email

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class SubscriptionCreate(BaseModel):
    keyword: str = Field(min_length=2, max_length=255)
    location: str = Field(min_length=2, max_length=255)
    frequency: str = Field(default="daily", pattern="^(daily|weekly)$")
    max_results: int = Field(default=25, ge=1, le=100)


class SubscriptionResponse(BaseModel):
    id: int
    keyword: str
    location: str
    frequency: str
    max_results: int
    is_active: bool
    last_sent_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DigestResponse(BaseModel):
    subscription_id: int
    recipient: str
    job_count: int
    sent: bool
    dry_run: bool
    delivery_status: str


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
def list_subscriptions(
    agency: Agency = Depends(get_current_agency),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(SearchSubscription)
        .where(SearchSubscription.agency_id == agency.id)
        .order_by(SearchSubscription.created_at.desc())
    ).all()


@router.post(
    "/subscriptions",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_subscription(
    payload: SubscriptionCreate,
    agency: Agency = Depends(get_current_agency),
    db: Session = Depends(get_db),
):
    subscription = SearchSubscription(
        agency_id=agency.id,
        keyword=payload.keyword,
        location=payload.location,
        frequency=payload.frequency,
        max_results=payload.max_results,
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription(
    subscription_id: int = Path(ge=1),
    agency: Agency = Depends(get_current_agency),
    db: Session = Depends(get_db),
):
    subscription = db.get(SearchSubscription, subscription_id)
    if not subscription or subscription.agency_id != agency.id:
        raise HTTPException(status_code=404, detail="Subscription not found")

    db.delete(subscription)
    db.commit()


@router.post("/subscriptions/{subscription_id}/send-now", response_model=DigestResponse)
async def send_subscription_now(
    subscription_id: int = Path(ge=1),
    agency: Agency = Depends(get_current_agency),
    db: Session = Depends(get_db),
):
    subscription = db.get(SearchSubscription, subscription_id)
    if not subscription or subscription.agency_id != agency.id:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if not subscription.is_active:
        raise HTTPException(status_code=400, detail="Subscription is inactive")

    try:
        payload = await search_jobs(
            keyword=subscription.keyword,
            location=subscription.location,
            page=1,
            size=subscription.max_results,
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Bundesagentur API returned {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    rows = [normalize_job(item) for item in extract_job_items(payload)]
    subject = f"{len(rows)} new BA job offers: {subscription.keyword} in {subscription.location}"
    html_body = build_jobs_email_html(
        agency_name=agency.name,
        keyword=subscription.keyword,
        location=subscription.location,
        jobs=rows,
    )

    delivery = EmailDelivery(
        subscription_id=subscription.id,
        recipient_email=agency.email,
        subject=subject,
        status="pending",
    )
    db.add(delivery)
    db.flush()

    try:
        email_result = send_email(agency.email, subject, html_body)
        delivery.status = "sent" if email_result["sent"] else "dry_run"
        delivery.sent_at = datetime.utcnow() if email_result["sent"] else None
        subscription.last_sent_at = datetime.utcnow()
        db.commit()
    except Exception as exc:
        delivery.status = "failed"
        delivery.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=502, detail=f"Email delivery failed: {exc}") from exc

    return DigestResponse(
        subscription_id=subscription.id,
        recipient=agency.email,
        job_count=len(rows),
        sent=bool(email_result["sent"]),
        dry_run=bool(email_result["dry_run"]),
        delivery_status=delivery.status,
    )
