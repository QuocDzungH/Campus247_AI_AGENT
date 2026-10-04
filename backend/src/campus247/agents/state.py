from __future__ import annotations

from typing import Literal, Required, TypedDict

from pydantic import BaseModel, Field, model_validator

from campus247.models.contracts_v1 import (
    ChecklistItem,
    Citation,
    Fact,
    FieldIssue,
    IntakeContext,
    IntakeResult,
    MissingItem,
    ModuleError,
    OfficerBrief,
    Priority,
    RagResult,
    Risk,
    Route,
    TicketSnapshot,
    WarningItem,
)

Intent = Literal[
    "policy_question",
    "student_certificate",
    "academic_complaint",
    "wellbeing",
    "unauthorized_action",
]
CertificateField = Literal["purpose", "destination_org", "receive_method"]
SourceType = Literal["student_message", "profile", "policy", "tool_result"]
SourceKey = tuple[SourceType, str]


class RouteDecision(BaseModel):
    route: Route
    intent: Intent
    risk_type: Risk | None = None
    reason: str = Field(min_length=1, max_length=1000)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def risk_matches_route(self) -> RouteDecision:
        if self.route == "L4":
            if self.risk_type is None:
                raise ValueError("L4 requires risk_type")
            if self.intent == "policy_question":
                raise ValueError("L4 cannot be a policy question")
            if self.intent == "student_certificate":
                raise ValueError("certificate intent cannot use L4; mixed cases use the L4 risk intent")
            if self.intent != self.risk_type:
                raise ValueError("L4 intent must match risk_type")
        else:
            if self.risk_type is not None:
                raise ValueError("risk_type is only valid for L4")
            if self.route == "L2" and self.intent != "student_certificate":
                raise ValueError("L2 is only student_certificate")
            if self.route == "L1" and self.intent != "policy_question":
                raise ValueError("L1 is only policy_question")
        return self


class FieldExtraction(BaseModel):
    provided_fields: list[CertificateField] = Field(default_factory=list)
    purpose: str | None = None
    destination_org: str | None = None
    receive_method: Literal["digital_pdf", "paper_stamped"] | None = None
    invalid_fields: list[FieldIssue] = Field(default_factory=list)


class GroundedL1Answer(BaseModel):
    outcome: Literal["answered", "insufficient_evidence"]
    answer: str = Field(min_length=1, max_length=5000)
    used_chunk_ids: list[str] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def citations_match_outcome(self) -> GroundedL1Answer:
        if self.outcome == "answered" and not self.used_chunk_ids:
            raise ValueError("answered L1 result requires a source")
        if self.outcome == "insufficient_evidence" and self.used_chunk_ids:
            raise ValueError("insufficient L1 result must not cite an unrelated source")
        return self


class DossierOutput(BaseModel):
    summary: str = Field(min_length=1, max_length=2000)
    extra_facts: list[Fact] = Field(default_factory=list)
    missing_items: list[MissingItem] = Field(default_factory=list)


class TriageOutput(BaseModel):
    suggested_priority: Priority
    priority_reasons: list[str] = Field(default_factory=list)


class DraftOutput(BaseModel):
    draft_reply: str | None = None
    used_chunk_ids: list[str] = Field(default_factory=list)
    warnings: list[WarningItem] = Field(default_factory=list)


class IntakeState(TypedDict, total=False):
    context: Required[IntakeContext]
    started_at: float
    decision: RouteDecision
    extracted_fields: FieldExtraction
    rag_result: RagResult
    result: IntakeResult
    error: ModuleError


class OfficerState(TypedDict, total=False):
    snapshot: Required[TicketSnapshot]
    started_at: float
    source_registry: set[SourceKey]
    summary: str
    facts: list[Fact]
    missing_items: list[MissingItem]
    checklist: list[ChecklistItem]
    suggested_priority: Priority
    priority_reasons: list[str]
    draft_reply: str | None
    citations: list[Citation]
    warnings: list[WarningItem]
    quality_status: Literal["pass", "fail"]
    brief: OfficerBrief
    error: ModuleError
