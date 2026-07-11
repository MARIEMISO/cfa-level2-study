# 문제 해결 가이드

## 1. 사이트 주소가 404로 나와요

가능한 원인:
- GitHub Pages 반영 전입니다.
- Branch/Folder 설정이 틀렸습니다.
- 저장소 root에 `index.html`이 없습니다.

해결:
- 1~5분 기다렸다가 새로고침
- Settings → Pages → Branch `main`, Folder `/ (root)` 확인
- 저장소 최상단에 `index.html`이 있는지 확인

## 2. 화면은 뜨는데 내용이 안 나와요

가능한 원인:
- `data/` 폴더가 빠졌습니다.
- `book1.json`~`book5.json`이 root가 아닌 다른 곳에 들어갔습니다.

해결:
- 저장소 최상단에 `data/book1.json` 경로가 실제로 있는지 확인

## 3. 그림이 깨져요

가능한 원인:
- `assets/` 폴더가 빠졌습니다.

해결:
- 저장소 최상단에 `assets/figures/` 경로가 있는지 확인

## 4. 검색이 안 돼요

가능한 원인:
- `script.js`가 누락됐거나 예전 파일입니다.
- 브라우저 캐시가 예전 JS를 잡고 있습니다.

해결:
- `script.js` 파일이 root에 있는지 확인
- Windows: `Ctrl + F5`
- Mac: `Cmd + Shift + R`

## 5. ZIP을 올렸는데 안 돼요

ZIP 자체를 올리면 안 됩니다. ZIP을 풀어서 안의 파일과 폴더를 root에 올려야 합니다.
