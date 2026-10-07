import asyncio
import logging
from pathlib import Path

import httpx

from config import DATA_SOURCES

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

LEGAL_DIR = Path("data/landing/legal")
LEGAL_DIR.mkdir(parents=True, exist_ok=True)

# Hardcoded escalation procedure PDF if not in config
ESCALATION_PROCEDURE_URL = "https://vinuni.edu.vn/wp-content/uploads/2021/08/Escalation-Procedure.pdf"

async def download_pdf(client: httpx.AsyncClient, url: str, dest_path: Path):
    logger.info(f"Downloading PDF from {url}")
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        
        content = response.content
        size_kb = len(content) / 1024
        
        with open(dest_path, "wb") as f:
            f.write(content)
            
        logger.info(f"Successfully downloaded {url} ({size_kb:.2f} KB) to {dest_path}")
    except Exception as e:
        logger.error(f"Failed to download {url}: {e}")

async def main():
    logger.info("Starting PDF downloads...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Download specific PDFs
        dest_path = LEGAL_DIR / "Escalation-Procedure.pdf"
        await download_pdf(client, ESCALATION_PROCEDURE_URL, dest_path)
        
    logger.info("PDF downloads finished.")

if __name__ == "__main__":
    asyncio.run(main())
