import requests
import re

url = "https://frontend-hmuuxjjd7-akshit-negis-projects.vercel.app/"
r = requests.get(url)
js_files = re.findall(r'src="(/_next/static/[^"]+\.js)"', r.text)

print("Searching in", len(js_files), "bundles:")
for path in js_files:
    content = requests.get(url.rstrip("/") + path).text
    matches = re.findall(r'https?://[a-zA-Z0-9\.\:\-]+/api/(?:chat|limits)', content)
    if matches:
        print("Found in", path, "->", set(matches))

