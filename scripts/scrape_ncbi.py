import json
import urllib.request
import os

def main():
    print("Fetching NCBI journal abbreviations database...")
    url = "https://raw.githubusercontent.com/citation-style-language/abbreviations/master/ncbi/json/ncbi-abbreviations.json"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            raw_data = json.loads(response.read().decode())
            
        # Extract mappings to confirm structure
        if "default" in raw_data and "container-title" in raw_data["default"]:
            mappings = raw_data["default"]["container-title"]
            print(f"Loaded {len(mappings)} entries from NCBI database.")
        else:
            raise ValueError("Unexpected JSON structure: '.default.container-title' not found.")
            
        # Target output path
        output_dir = "public"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "ncbi-abbreviations.json")
        
        # Write to public/ncbi-abbreviations.json
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully compiled and saved NCBI database to {output_path}")
        
    except Exception as e:
        print(f"Failed to fetch or save NCBI database: {e}")
        exit(1)

if __name__ == "__main__":
    main()
