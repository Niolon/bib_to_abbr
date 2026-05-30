import json
import urllib.request
import urllib.error
import re
from html.parser import HTMLParser
import os
import sys
import time

class WoSParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.mappings = {}
        self.state = None  # 'DT' or 'DD' or None
        self.current_dt = []
        self.current_dd = []

    def handle_starttag(self, tag, attrs):
        tag_lower = tag.lower()
        if tag_lower == 'dt':
            self.commit()
            self.state = 'DT'
            self.current_dt = []
            self.current_dd = []
        elif tag_lower == 'dd':
            self.state = 'DD'
            self.current_dd = []

    def handle_data(self, data):
        if self.state == 'DT':
            self.current_dt.append(data)
        elif self.state == 'DD':
            self.current_dd.append(data)

    def commit(self):
        if self.current_dt:
            dt_text = "".join(self.current_dt).strip()
            # Normalize whitespace/tabs inside the text
            dt_text = " ".join(dt_text.split())
            dd_text = "".join(self.current_dd).strip() if self.current_dd else ""
            dd_text = " ".join(dd_text.split())
            if dt_text and dd_text:
                self.mappings[dt_text] = dd_text
            self.current_dt = []
            self.current_dd = []

    def close(self):
        self.commit()
        super().close()

def main():
    pages = ["0-9"] + [chr(c) for c in range(ord('A'), ord('Z') + 1)]
    all_mappings = {}
    
    os.makedirs("src/data", exist_ok=True)
    
    print(f"Starting WoS journal abbreviation scrape of {len(pages)} pages...")
    
    for page in pages:
        url = f"https://wos-help.webofscience.com/WOKRS535R111/help/WOS/{page}_abrvjt.html"
        print(f"Fetching {page} from {url}...")
        try:
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                # Clarivate pages might be iso-8859-1 or utf-8. Let's read charset from headers or use errors='replace'
                charset = response.headers.get_content_charset() or 'iso-8859-1'
                html_content = response.read().decode(charset, errors='replace')
                
            parser = WoSParser()
            parser.feed(html_content)
            parser.close()
            
            print(f"  Found {len(parser.mappings)} mappings on page {page}")
            all_mappings.update(parser.mappings)
            
            # Nice sleep to be polite
            time.sleep(0.5)
        except urllib.error.URLError as e:
            print(f"Error fetching page {page}: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Unexpected error parsing page {page}: {e}", file=sys.stderr)
            
    print(f"Total mappings gathered: {len(all_mappings)}")
    
    # Save the output
    output_path = "src/data/wos-abbreviations.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_mappings, f, indent=2, ensure_ascii=False)
        
    print(f"Saved mappings to {output_path}")

if __name__ == "__main__":
    main()
