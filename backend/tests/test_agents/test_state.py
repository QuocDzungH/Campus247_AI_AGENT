import pytest
from pydantic import ValidationError

from campus247.agents.state import FieldExtraction, RouteDecision


def test_l4_requires_risk_type():
    with pytest.raises(ValidationError):
        RouteDecision(route="L4", intent="academic_complaint", reason="thiếu risk")


def test_non_l4_forbids_risk_type():
    with pytest.raises(ValidationError):
        RouteDecision(route="L1", intent="policy_question", risk_type="wellbeing", reason="sai")


def test_l2_intent_must_be_certificate():
    with pytest.raises(ValidationError):
        RouteDecision(route="L2", intent="policy_question", reason="sai")


def test_valid_routes():
    l1 = RouteDecision(route="L1", intent="policy_question", reason="hỏi thủ tục")
    l2 = RouteDecision(route="L2", intent="student_certificate", reason="xin giấy")
    l4 = RouteDecision(
        route="L4",
        intent="wellbeing",
        risk_type="wellbeing",
        reason="cần hỗ trợ",
        confidence=0.8,
    )
    assert l1.risk_type is None
    assert l2.intent == "student_certificate"
    assert l4.risk_type == "wellbeing"


def test_field_extraction_defaults():
    extracted = FieldExtraction()
    assert extracted.provided_fields == []
    assert extracted.purpose is None
