import os
import logging
from typing import List, Literal, Any
from .contracts import SearchResult, GenerationResult
from .config import settings
from .task9_retrieval_pipeline import retrieve

logger = logging.getLogger(__name__)

def is_vietnamese(text: str) -> bool:
    """Heuristic to detect if query is in Vietnamese."""
    vi_chars = set("àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ")
    if any(c in vi_chars for c in text):
        return True
    lower = text.lower()
    vi_keywords = [
        "giay to", "khieu nai", "bang diem", "hoc vu", "sinh vien", 
        "ky tuc xa", "thu vien", "dat phong", "xin", "the nao", 
        "lam sao", "o dau", "bao gio", "phuc khao", "hoc phi"
    ]
    return any(kw in lower for kw in vi_keywords)

def get_meta_field(metadata: Any, field: str, default: str = "") -> str:
    if isinstance(metadata, dict):
        return str(metadata.get(field, default))
    return str(getattr(metadata, field, default))

def reorder_for_llm(chunks: List[SearchResult]) -> List[SearchResult]:
    if not chunks:
        return []
    
    chunks_sorted = sorted(chunks, key=lambda x: x.score, reverse=True)
    reordered = []
    
    for i, chunk in enumerate(chunks_sorted):
        if i % 2 == 0:
            reordered.insert(0, chunk)
        else:
            reordered.append(chunk)
            
    return reordered

def format_context(chunks: List[SearchResult]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, start=1):
        source = get_meta_field(chunk.metadata, 'source', f"doc_{chunk.id}")
        title = get_meta_field(chunk.metadata, 'title', '')
        url = get_meta_field(chunk.metadata, 'url', '')
        header = f"[Source {i}] {title} ({source})" if title else f"[Source {i}] {source}"
        if url:
            header += f" - URL: {url}"
        context_parts.append(f"{header}\n{chunk.content}")
    return "\n\n".join(context_parts)

def generate_with_citation(query: str, top_k: int = 5, score_threshold: float = None) -> GenerationResult:
    try:
        chunks = retrieve(query, top_k=top_k, score_threshold=score_threshold)
        is_vi = is_vietnamese(query)
        
        if not chunks:
            refusal_text = (
                "Xin lỗi, hệ thống không tìm thấy thông tin phù hợp trong các quy định và hướng dẫn của VinUni để trả lời câu hỏi của bạn."
                if is_vi
                else "I'm sorry, I could not find relevant information in VinUniversity's official regulations and guidelines to answer your inquiry."
            )
            return GenerationResult(
                answer=refusal_text,
                sources=[],
                retrieval_source="none"
            )
            
        retrieval_source = chunks[0].retrieval_method if chunks else "none"
        if retrieval_source not in ("hybrid", "pageindex", "none"):
            retrieval_source = "hybrid"
            
        reordered = reorder_for_llm(chunks)
        context = format_context(reordered)
        
        system_prompt = (
            "You are the official AI Student Services Assistant for VinUniversity (VinUni).\n"
            "Your duty is to answer students' inquiries regarding document requests, formal complaints, academic regulations, student affairs, dormitory, library, and campus facilities based solely on the provided official documents.\n\n"
            "STRICT BILINGUAL LANGUAGE RULES:\n"
            "1. You MUST ALWAYS detect and reply in the EXACT SAME LANGUAGE as the student's question:\n"
            "   - If the student asks in ENGLISH -> You MUST write the ENTIRE answer in natural, professional ENGLISH.\n"
            "   - If the student asks in VIETNAMESE -> You MUST write the ENTIRE answer in natural, courteous VIETNAMESE.\n"
            "2. Never mix languages inappropriately.\n\n"
            "CITATION & RESPONSE FORMAT RULES:\n"
            "1. CITE SOURCES: Every factual statement, policy rule, deadline, or requirement MUST be cited with [Source N] immediately after the information.\n"
            "2. ACTIONABLE & CLEAR: Clearly present step-by-step instructions, processing timelines (e.g. business days), fees (if any), receiving methods (soft copy / hard copy), and responsible office contacts.\n"
            "3. NO HALLUCINATION: If the provided context does not mention a specific detail, explicitly state that it is not covered in the current guidelines."
        )

        user_prompt = (
            f"--- OFFICIAL RETRIEVED CONTEXT ---\n"
            f"{context}\n\n"
            f"--- STUDENT QUESTION ---\n"
            f"{query}\n\n"
            f"Answer the student's question in the SAME LANGUAGE as the question (English for English queries, Vietnamese for Vietnamese queries), citing [Source N] for each point:"
        )
        
        api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")
        model_name = settings.openai_model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        
        answer = ""
        if api_key:
            import openai
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1
            )
            answer = response.choices[0].message.content
        else:
            answer = (
                f"Không tìm thấy OPENAI_API_KEY. Tìm thấy {len(chunks)} đoạn thông tin tham khảo."
                if is_vi
                else f"OPENAI_API_KEY not found. Retrieved {len(chunks)} reference chunks."
            )
            
        return GenerationResult(
            answer=answer,
            sources=reordered,
            retrieval_source=retrieval_source
        )
    except Exception as e:
        logger.error(f"Error in generate_with_citation: {e}")
        err_msg = (
            f"Đã xảy ra lỗi trong quá trình xử lý câu trả lời: {str(e)}"
            if is_vietnamese(query)
            else f"An error occurred while generating the answer: {str(e)}"
        )
        return GenerationResult(
            answer=err_msg,
            sources=[],
            retrieval_source="none"
        )

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Test Vietnamese
    vi_res = generate_with_citation("Làm sao để xin cấp bảng điểm transcript?", 3)
    print("=== VIETNAMESE TEST ===")
    print(vi_res.answer[:300])

    # Test English
    en_res = generate_with_citation("What is the formal procedure to submit a student complaint?", 3)
    print("\n=== ENGLISH TEST ===")
    print(en_res.answer[:300])
