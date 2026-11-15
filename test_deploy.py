import requests
import re

url = "https://frontend-hmuuxjjd7-akshit-negis-projects.vercel.app/"
r = requests.get(url)
print("HTTP Status:", r.status_code)

js_files = re.findall(r'src="(/_next/static/[^"]+\.js)"', r.text)
has_render = False
has_local = False

for path in js_files:
    content = requests.get(url.rstrip("/") + path).text
    if "chatgroq.onrender.com" in content:
        has_render = True
        print("✅ Render URL found in:", path)
    if "127.0.0.1:8000" in content:
        has_local = True
        print("⚠️ Localhost found in:", path)

print("Verdict -> Connected to Render:", has_render)
