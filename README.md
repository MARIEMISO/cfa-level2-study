# CFA Level II 개인 교재 (v4)

## 배포
이 폴더의 파일 전부를 GitHub 저장소 루트에 덮어쓰기 → GitHub Pages 자동 반영.
(index.html / style.css / script.js / data/book1~5.json)

## 구조
- BOOK → Reading → LOS. 각 LOS는 blocks 배열로 구성.
- 블록 타입: h, h3, p, list, table, formula(KaTeX), svg(도식), callout(intuition/exam/trap/tip/link), example(풀이 접기), quiz(정답 접기 + 오답노트 저장)
- localStorage: 학습완료(cfa.done.v2), 마지막 LOS(cfa.last.v2), 오답노트(cfa.wrong.v2)
- 인라인 문법: **굵게**, `코드`, ==형광펜==, $수식$

## 콘텐츠 채우기
data/bookN.json에서 해당 reading의 "status"를 "detailed"로 바꾸고
losItems에 blocks를 채우면 사이트가 자동으로 본문을 렌더링.
R17(book3.json)이 기준 템플릿.
