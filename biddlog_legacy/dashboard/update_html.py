import re

dist_html = r'c:\laragon\www\biddlog\dashboard\dist\index.html'
with open(dist_html, 'r', encoding='utf-8') as f:
    dist_content = f.read()

# find <script type="module" crossorigin src="/assets/index-...js"></script>
# and <link rel="stylesheet" crossorigin href="/assets/index-...css">
# Note: vite might output multiple scripts or links. Let's just grab everything in <head> and before </body> and replace the specific lines.
scripts = re.findall(r'<script.*?</script>', dist_content, flags=re.DOTALL)
links = re.findall(r'<link.*?>', dist_content, flags=re.DOTALL)

# filter out the ones pointing to assets
asset_scripts = [s.replace('"/assets/', '"assets/') for s in scripts if 'src="/assets/' in s]
asset_links = [l.replace('"/assets/', '"assets/') for l in links if 'href="/assets/' in l]

webui_html = r'c:\laragon\www\biddlog\portable\webui\index.html'
with open(webui_html, 'r', encoding='utf-8') as f:
    content = f.read()

# remove old assets
content = re.sub(r'<link rel="stylesheet" href="assets/.*?css">\s*', '', content)
content = re.sub(r'<script type="module" src="assets/.*?js"></script>\s*', '', content)
# exceljs might be a separate chunk, let's remove any script pointing to assets/
content = re.sub(r'<script.*src="assets/.*?</script>\s*', '', content)

# insert new ones
# insert link before </head>
link_str = '\n    '.join(asset_links) + '\n  </head>'
content = content.replace('</head>', link_str)

# insert script before </body>
script_str = '\n    '.join(asset_scripts) + '\n  </body>'
content = content.replace('</body>', script_str)

with open(webui_html, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated webui/index.html")
