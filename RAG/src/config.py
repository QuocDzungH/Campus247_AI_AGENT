import os
from typing import Dict, Any
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # LLM Provider
    llm_provider: str = Field(default="openai", env="LLM_PROVIDER")
    openai_api_key: str = Field(default="", env="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", env="OPENAI_MODEL")
    
    google_api_key: str = Field(default="", env="GOOGLE_API_KEY")
    gemini_model: str = Field(default="gemini-1.5-flash", env="GEMINI_MODEL")

    # Embedding
    embedding_model: str = Field(default="text-embedding-3-small", env="EMBEDDING_MODEL")
    embedding_dim: int = Field(default=1536, env="EMBEDDING_DIM")

    # ChromaDB
    chroma_persist_dir: str = Field(default="./vectorstore", env="CHROMA_PERSIST_DIR")
    chroma_collection: str = Field(default="vinuni_docs", env="CHROMA_COLLECTION")

    # Retrieval
    score_threshold: float = Field(default=0.3, env="SCORE_THRESHOLD")
    top_k: int = Field(default=5, env="TOP_K")
    rrf_k: int = Field(default=60, env="RRF_K")

    # Crawl
    crawl_delay: int = Field(default=2, env="CRAWL_DELAY")

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

settings = Settings()

DATA_SOURCES: Dict[str, Dict[str, Any]] = {
    "request_transcripts": {
        "url": "https://registrar.vinuni.edu.vn/academics/request-transcripts-certifications/",
        "doc_type": "policy",
        "priority": 1,
        "category": "xin_giay_to",
        "description": "Requesting transcripts and certifications."
    },
    "document_request_form": {
        "url": "https://forms.office.com/pages/responsepage.aspx?id=iSf4WJVmSk-r2zV2aNVc_0dbBYw8WtJPgbnOOjH80gpUNDRJUExIOEoxQzA0RE9CRE9XWVM1M0QxSS4u&route=shorturl",
        "doc_type": "form",
        "priority": 2,
        "category": "xin_giay_to",
        "description": "Form for requesting documents."
    },
    "escalation_procedure": {
        "url": "https://policy.vinuni.edu.vn/all-policies/formal-escalation-management-procedure-for-students/",
        "doc_type": "policy",
        "priority": 1,
        "category": "khieu_nai",
        "description": "Formal escalation management procedure for students."
    },
    "escalation_pdf": {
        "url": "https://policy.vinuni.edu.vn/wp-content/uploads/2025/02/20251224_GDL-SAM-007-V2.0_Formal-Escalation-Management-Procedure-for-Students.pdf",
        "doc_type": "policy",
        "priority": 1,
        "category": "khieu_nai",
        "description": "PDF of formal escalation management procedure."
    },
    "academic_regulations": {
        "url": "https://policy.vinuni.edu.vn/all-policies/academic-regulations-for-full-time-undergraduate-programs/",
        "doc_type": "policy",
        "priority": 2,
        "category": "phuc_khao",
        "description": "Academic regulations for full-time undergraduate programs."
    },
    "academic_integrity": {
        "url": "https://policy.vinuni.edu.vn/all-policies/student-academic-integrity/",
        "doc_type": "policy",
        "priority": 2,
        "category": "liem_chinh",
        "description": "Student academic integrity policy."
    },
    "code_of_conduct": {
        "url": "https://policy.vinuni.edu.vn/all-policies/student-affairs-regulations-code-of-conduct/",
        "doc_type": "policy",
        "priority": 2,
        "category": "ung_xu_ky_luat",
        "description": "Student affairs regulations and code of conduct."
    },
    "residential_life": {
        "url": "https://policy.vinuni.edu.vn/all-policies/residential-life-guideline/",
        "doc_type": "policy",
        "priority": 3,
        "category": "ky_tuc_xa",
        "description": "Residential life guidelines."
    },
    "library_policy": {
        "url": "https://policy.vinuni.edu.vn/all-policies/library-policies-for-users/",
        "doc_type": "policy",
        "priority": 3,
        "category": "thu_vien",
        "description": "Library policies for users."
    },
    "facility_usage": {
        "url": "https://policy.vinuni.edu.vn/all-policies/facility-usage-regulations-including-facilities-for-rent/",
        "doc_type": "policy",
        "priority": 3,
        "category": "co_so_vat_chat",
        "description": "Facility usage regulations."
    },
    "room_bookings": {
        "url": "https://registrar.vinuni.edu.vn/internal-services/room-bookings/",
        "doc_type": "policy",
        "priority": 3,
        "category": "dat_phong",
        "description": "Room bookings information."
    }
}

CATEGORIES = [
    "xin_giay_to",
    "khieu_nai",
    "phuc_khao",
    "liem_chinh",
    "ung_xu_ky_luat",
    "ky_tuc_xa",
    "thu_vien",
    "co_so_vat_chat",
    "dat_phong"
]

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
RAW_DATA_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DATA_DIR = os.path.join(DATA_DIR, "processed")

# Ensure directories exist
os.makedirs(RAW_DATA_DIR, exist_ok=True)
os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
