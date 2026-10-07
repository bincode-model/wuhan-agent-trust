from pathlib import Path
import zipfile
root=Path(__file__).resolve().parent.parent
out=root/'public/resources/source.zip'
include_files=['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','.gitignore','README.md','LICENSE']
include_dirs=['src','server','tests','scripts']
public_files=['resources/intro-images.zip','resources/intro-16x9.pdf','resources/pitch.pptx','resources/pitch.pdf','resources/catalog.json','resources/receipt-schema.json','resources/skills.xlsx','resources/skills.csv','resources/README.md','media/titanium-wallpaper.png','licenses/liquid-glass-js-MIT.txt']
files=[root/f for f in include_files]+[p for d in include_dirs for p in (root/d).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc']+[root/'public'/p for p in public_files]+[root/'docs'/p for p in ['api-contract.json','requirements-map.md','README.md','skills-enrichment.json','FRONTEND-20261007.md','SCENE-ASSETS-20261007.json','SCENE-DESIGN-20261007.md','TRUST-WORKSPACE-20261007.md','INTRO-IMAGES-20261007.json']]
files += sorted((root/'public/media').glob('scene-*.webp'))
files += sorted((root/'public/media').glob('orbit-scene-*'))
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for f in files:
  if f.is_file() and not f.is_symlink():z.write(f,str(Path(root.name)/f.relative_to(root)))
print(f'{out.name}: {out.stat().st_size} bytes, {len(zipfile.ZipFile(out).namelist())} files')
