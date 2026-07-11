#!/usr/bin/env python3
from pathlib import Path
import json, sys
root=Path(__file__).resolve().parent
required=['index.html','style.css','script.js','data/book1.json','data/book2.json','data/book3.json','data/book4.json','data/book5.json','data/visuals.json','.nojekyll','404.html']
errors=[]
for rel in required:
    if not (root/rel).exists(): errors.append(f'Missing required file: {rel}')
readings=los_count=quiz_count=formula_count=0
if not errors:
    for i in range(1,6):
        try: data=json.loads((root/'data'/f'book{i}.json').read_text(encoding='utf-8'))
        except Exception as e: errors.append(f'JSON parse failed: data/book{i}.json :: {e}'); continue
        rs=data.get('readings',[]); readings+=len(rs)
        for r in rs:
            for los in r.get('losItems',[]):
                los_count+=1; quiz_count+=len(los.get('quiz',[])); formula_count+=len(los.get('formulas',[]))
                if len(los.get('sections',[]))<6: errors.append(f"Too few sections: Book{i} R{r.get('readingNumber')} {los.get('id')}")
                if len(los.get('quiz',[]))<2: errors.append(f"Too few quizzes: Book{i} R{r.get('readingNumber')} {los.get('id')}")
                for qi,q in enumerate(los.get('quiz',[])):
                    choices=q.get('choices',[]); ans=q.get('answer')
                    if not isinstance(choices,list) or len(choices)<2: errors.append(f"Bad quiz choices: Book{i} {los.get('id')} quiz {qi}")
                    if not isinstance(ans,int) or ans<0 or ans>=len(choices): errors.append(f"Bad quiz answer index: Book{i} {los.get('id')} quiz {qi}")
    if readings!=42: errors.append(f'Reading count mismatch: {readings} != 42')
    if los_count!=370: errors.append(f'LOS count mismatch: {los_count} != 370')
    try:
        visuals=json.loads((root/'data'/'visuals.json').read_text(encoding='utf-8'))
        refs=[]
        for bk,mapping in visuals.items():
            if str(bk).startswith('book') and isinstance(mapping,dict):
                for rid,entries in mapping.items():
                    if isinstance(entries,list):
                        for v in entries:
                            if v.get('src'): refs.append(v['src'])
        for s in set(refs):
            if not (root/s).exists(): errors.append(f'Missing visual asset: {s}')
    except Exception as e: errors.append(f'Visuals audit failed: {e}')
    script=(root/'script.js').read_text(encoding='utf-8'); css=(root/'style.css').read_text(encoding='utf-8')
    checks={'search':'#searchInput' in script and 'function search(q)' in script,'quiz_toggle':'answer-btn' in script and '정답 숨기기' in script,'wrong_note_localStorage':'storageKey.note' in script,'completion_localStorage':'storageKey.done' in script,'last_reading_localStorage':'storageKey.last' in script,'progress_calculation':'function updateProgress()' in script,'responsive_css':'@media(max-width:900px)' in css and '@media(max-width:560px)' in css,'relative_data_paths':'data/${b}.json' in script and 'data/visuals.json' in script}
    for name,ok in checks.items():
        if not ok: errors.append(f'Feature check failed: {name}')
print('CFA Level II site pre-upload validation')
print('---------------------------------------')
print(f'Readings: {readings}/42')
print(f'LOS: {los_count}/370')
print(f'Quiz items: {quiz_count}')
print(f'Formula/concept cards: {formula_count}')
print()
if errors:
    print('FAIL')
    for e in errors[:100]: print(' -',e)
    sys.exit(1)
print('PASS: ready to upload the site-root contents to GitHub repository root.')
