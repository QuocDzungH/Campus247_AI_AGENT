import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from config import DATA_SOURCES, Settings

# Initialize settings
settings = Settings()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Output directories
LANDING_DIR = Path("data/landing")
NEWS_DIR = LANDING_DIR / "news"
LEGAL_DIR = LANDING_DIR / "legal"

NEWS_DIR.mkdir(parents=True, exist_ok=True)
LEGAL_DIR.mkdir(parents=True, exist_ok=True)

async def download_file(client: httpx.AsyncClient, url: str, dest_path: Path):
    """Download a file (like PDF) to a specific destination."""
    logger.info(f"Downloading file from {url} to {dest_path}")
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        with open(dest_path, "wb") as f:
            f.write(response.content)
        logger.info(f"Successfully downloaded {url}")
    except Exception as e:
        logger.error(f"Failed to download {url}: {e}")

async def crawl_webpage(client: httpx.AsyncClient, url: str, source_id: str):
    """Crawl a webpage and save its HTML content as JSON."""
    logger.info(f"Crawling webpage {url}")
    try:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, "html.parser")
        title = soup.title.string if soup.title else "No Title"
        
        parsed_url = urlparse(url)
        filename = f"{source_id}_{parsed_url.path.replace('/', '_')}".strip("_")
        if not filename:
            filename = f"{source_id}_index"
        if not filename.endswith(".json"):
            filename += ".json"
            
        dest_path = NEWS_DIR / filename
        
        data = {
            "url": url,
            "title": title.strip(),
            "date_crawled": datetime.utcnow().isoformat(),
            "content_html": response.text,
            "source_id": source_id
        }
        
        with open(dest_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Successfully crawled and saved {url} to {dest_path}")
    except Exception as e:
        logger.error(f"Failed to crawl {url}: {e}")

async def main():
    logger.info("Starting crawler...")
    
    # Delay from config with default of 1 second
    delay = getattr(settings, "CRAWL_DELAY", 1.0)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for source_id, urls in DATA_SOURCES.items():
            for url in urls:
                parsed_url = urlparse(url)
                if parsed_url.path.endswith(".pdf"):
                    filename = Path(parsed_url.path).name
                    dest_path = LEGAL_DIR / filename
                    await download_file(client, url, dest_path)
                else:
                    await crawl_webpage(client, url, source_id)
                
                # Delay between requests
                logger.info(f"Waiting {delay}s before next request...")
                await asyncio.sleep(delay)

    logger.info("Crawler finished.")

if __name__ == "__main__":
    asyncio.run(main())
