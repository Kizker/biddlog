from PIL import Image
import os

img_path = r'c:\laragon\www\biddlog\dashboard\public\bidding-item-analyzer-crop.png'
ico_path = r'c:\laragon\www\biddlog\portable\icon.ico'

img = Image.open(img_path)
img.save(ico_path, format='ICO', sizes=[(256, 256)])
print("Saved ICO to", ico_path)
