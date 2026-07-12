import sys
with open('package.json', 'rb') as f:
    content = f.read()
if content.startswith(b'\xef\xbb\xbf'):
    content = content[3:]
with open('package.json', 'wb') as f:
    f.write(content)
print("Removed BOM")
