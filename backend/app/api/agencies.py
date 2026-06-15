from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.agency import Agency
from app.services.security import generate_api_key, hash_api_key

router = APIRouter(prefix="/api/agencies", tags=["agencies"])


class AgencyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    plan: str = Field(default="starter", max_length=50)


class AgencyResponse(BaseModel):
    id: int
    name: str
    email: str
    plan: str
    is_active: bool

    model_config = {"from_attributes": True}


class AgencyCreatedResponse(AgencyResponse):
    api_key: str


def get_current_agency(
    x_agency_key: Annotated[str | None, Header(alias="X-Agency-Key")] = None,
    db: Session = Depends(get_db),
) -> Agency:
    if not x_agency_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Agency-Key header",
        )

    api_key_hash = hash_api_key(x_agency_key)
    agency = db.scalar(select(Agency).where(Agency.api_key_hash == api_key_hash))
    if not agency or not agency.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agency key",
        )
    return agency


@router.post("", response_model=AgencyCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_agency(payload: AgencyCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Agency).where(Agency.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="An agency with this email already exists")

    api_key = generate_api_key()
    agency = Agency(
        name=payload.name,
        email=payload.email,
        plan=payload.plan,
        api_key_hash=hash_api_key(api_key),
    )
    db.add(agency)
    db.commit()
    db.refresh(agency)

    return AgencyCreatedResponse(
        id=agency.id,
        name=agency.name,
        email=agency.email,
        plan=agency.plan,
        is_active=agency.is_active,
        api_key=api_key,
    )


@router.get("/me", response_model=AgencyResponse)
def read_current_agency(agency: Agency = Depends(get_current_agency)):
    return agency
