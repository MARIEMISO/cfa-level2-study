# CFA Level II 사이트 업로드 최종 가이드

## 1. 업로드할 파일

이 ZIP을 풀면 나오는 **내용물 전체**를 GitHub 저장소 root에 올리면 됩니다.

업로드되어야 하는 대표 구조:

```text
index.html
404.html
.nojekyll
style.css
script.js
data/
assets/
README_DEPLOY.md
VERSION.json
LAUNCH_GUIDE_KR.md
LIVE_QA_CHECKLIST.md
TROUBLESHOOTING.md
```

## 2. GitHub Pages 설정

저장소에서:

1. `Settings`
2. `Pages`
3. Source: `Deploy from a branch`
4. Branch: `main`
5. Folder: `/ (root)`
6. Save

## 3. 반영 시간

보통 1~5분 걸립니다. 처음에는 404가 떠도 잠깐 기다렸다가 새로고침하세요.

## 4. 제일 흔한 실수

- ZIP 파일 자체를 올림 → 안 됩니다. ZIP을 풀고 안의 파일들을 올려야 합니다.
- `data/` 폴더 누락 → 화면은 뜨는데 내용이 안 나옵니다.
- `assets/` 폴더 누락 → 그림/시각자료가 깨집니다.
- GitHub Pages folder를 `/docs`로 설정 → 이번 사이트는 `/ (root)`입니다.
