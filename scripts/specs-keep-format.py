import json,subprocess,re,sys
for f in sys.argv[1:]:
  orig=subprocess.run(['git','show','HEAD:'+f],capture_output=True,text=True).stdout
  new=json.load(open(f)); o=json.loads(orig)
  m=re.match(r'\{\n( +)"',orig); ind=len(m.group(1)) if m else None
  asc='\\u00' in orig or bool(re.search(r'\\u[0-9a-f]{4}',orig))
  def dump(x): return json.dumps(x,indent=ind,ensure_ascii=asc,separators=(',',': ') if ind else (',',':'))+('\n' if orig.endswith('\n') else '')
  if dump(o)!=orig: print('ROUNDTRIP MISMATCH',f); continue
  for a,b in zip(o['tools'],new['tools']):
    if 'specs' in b: a['specs']=b['specs']
  open(f,'w').write(dump(o))
