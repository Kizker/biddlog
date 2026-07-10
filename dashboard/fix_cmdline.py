path = r'c:\laragon\www\biddlog\dashboard\src\main.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

import re
content = re.sub(r'function CommandLine\(\{(.*?)\}\s*\)\s*\{(.*?)\}', '', content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
