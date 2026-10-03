import json
import logging
import os
from pathlib import Path
from typing import Dict, Any
import yaml

from bs4 import BeautifulSoup
try:
    from markitdown import MarkItDown
except ImportError:
    # Fallback if markitdown is not available
    MarkItDown = None
    import PyPDF2

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

LANDING_DIR = Path("data/landing")
NEWS_DIR = LANDING_DIR / "news"
LEGAL_DIR = LANDING_DIR / "legal"
PROCESSED_DIR = Path("data/processed")

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

def create_markdown_with_frontmatter(content: str, metadata: Dict[str, Any]) -> str:
    """Creates a markdown string with YAML frontmatter."""
    frontmatter = yaml.dump(metadata, sort_keys=False)
    return f"---\n{frontmatter}---\n\n{content}"

def process_html_json(file_path: Path):
    """Convert HTML content in JSON to clean Markdown."""
    logger.info(f"Processing JSON file: {file_path}")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        html_content = data.get("content_html", "")
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Remove script, style, nav, header, footer elements
        for element in soup(["script", "style", "nav", "header", "footer"]):
            element.decompose()
            
        # Extract text
        clean_text = soup.get_text(separator="\n\n", strip=True)
        
        metadata = {
            "source": data.get("source_id", "unknown"),
            "title": data.get("title", file_path.stem),
            "url": data.get("url", ""),
            "doc_type": "news"
        }
        
        md_content = create_markdown_with_frontmatter(clean_text, metadata)
        
        out_path = PROCESSED_DIR / f"{file_path.stem}.md"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md_content)
            
        logger.info(f"Saved converted markdown to {out_path}")
    except Exception as e:
        logger.error(f"Failed to process {file_path}: {e}")

def process_pdf(file_path: Path):
    """Convert PDF to Markdown using markitdown."""
    logger.info(f"Processing PDF file: {file_path}")
    try:
        text_content = ""
        if MarkItDown:
            md = MarkItDown()
            result = md.convert(str(file_path))
            text_content = result.text_content
        else:
            logger.warning("markitdown not available, using PyPDF2 fallback")
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                text_content = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])

        metadata = {
            "source": "pdf",
            "title": file_path.stem,
            "url": "",
            "doc_type": "legal"
        }
        
        md_content = create_markdown_with_frontmatter(text_content, metadata)
        
        out_path = PROCESSED_DIR / f"{file_path.stem}.md"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md_content)
            
        logger.info(f"Saved converted markdown to {out_path}")
    except Exception as e:
        logger.error(f"Failed to process {file_path}: {e}")

def main():
    logger.info("Starting conversion to markdown...")
    
    if NEWS_DIR.exists():
        for json_file in NEWS_DIR.glob("*.json"):
            process_html_json(json_file)
            
    if LEGAL_DIR.exists():
        for pdf_file in LEGAL_DIR.glob("*.pdf"):
            process_pdf(pdf_file)
            
    logger.info("Conversion finished.")

if __name__ == "__main__":
    main()
