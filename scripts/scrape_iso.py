import csv
import json
import urllib.request
import os

def main():
    print("Fetching JabRef journal abbreviation files list...")
    url = "https://api.github.com/repos/JabRef/abbrv.jabref.org/contents/journals"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    files = []
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            for item in data:
                if item["name"].endswith(".csv"):
                    files.append(item["name"])
    except Exception as e:
        print(f"Failed to fetch file list via GitHub API: {e}")
        print("Falling back to hardcoded list of files...")
        files = [
            "journal_abbreviations_general.csv",
            "journal_abbreviations_astronomy.csv",
            "journal_abbreviations_biology.csv",
            "journal_abbreviations_chemistry.csv",
            "journal_abbreviations_engineering.csv",
            "journal_abbreviations_humanities.csv",
            "journal_abbreviations_lifescience.csv",
            "journal_abbreviations_mathematics.csv",
            "journal_abbreviations_medicine.csv",
            "journal_abbreviations_meteorology.csv",
            "journal_abbreviations_physics.csv",
            "journal_abbreviations_socialsciences.csv",
        ]
        
    print(f"Found {len(files)} CSV files to process.")
    
    db = {}
    for filename in files:
        print(f"Downloading and parsing {filename}...")
        file_url = f"https://raw.githubusercontent.com/JabRef/abbrv.jabref.org/main/journals/{filename}"
        try:
            req = urllib.request.Request(file_url, headers=headers)
            with urllib.request.urlopen(req) as response:
                lines = response.read().decode("utf-8").splitlines()
                reader = csv.reader(lines)
                for row in reader:
                    if len(row) >= 2:
                        journal_title = row[0].strip()
                        abbreviation = row[1].strip()
                        if journal_title and abbreviation:
                            db[journal_title] = abbreviation
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            
    print(f"Successfully compiled {len(db)} journal abbreviations.")
    
    # Save the output
    out_path = "public/iso-abbreviations.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(db, f, separators=(",", ":"))
    print(f"Saved database to {out_path} ({os.path.getsize(out_path) / 1024 / 1024:.2f} MB)")

if __name__ == "__main__":
    main()
