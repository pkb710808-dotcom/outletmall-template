# OUTLETMALL 무료 배포 안내

이 쇼핑몰은 별도 빌드가 필요 없는 정적 사이트입니다.

## Netlify 배포

1. Netlify에 로그인합니다.
2. `Sites` > `Add new site` > `Deploy manually`로 이동합니다.
3. 이 폴더 전체를 업로드합니다.
   `C:\Users\pkb71\OneDrive\바탕 화면\안티그래비티\쇼핑몰제작\minimal-fashion-shop`
4. 배포가 끝나면 임시 주소가 생성됩니다.
5. `Domain management` > `Add a domain`에서 `아울렛몰.com`을 추가합니다.

## Vercel 배포

1. Vercel에 로그인합니다.
2. `Add New` > `Project`를 선택합니다.
3. 이 폴더를 GitHub에 올린 뒤 프로젝트로 가져옵니다.
4. Framework Preset은 `Other`, Build Command는 비워두고 Output Directory는 `.`로 둡니다.
5. 배포 후 `Settings` > `Domains`에서 `아울렛몰.com`을 추가합니다.

## 카페24 도메인 연결

Netlify 또는 Vercel에서 도메인을 추가하면 DNS 값이 표시됩니다.

- 루트 도메인 `아울렛몰.com`: 플랫폼이 안내하는 A 레코드 또는 ALIAS/ANAME 값을 등록합니다.
- `www.아울렛몰.com`: 플랫폼이 안내하는 CNAME 값을 등록합니다.

카페24 도메인 관리 화면에서 DNS 레코드를 수정한 뒤 적용까지 보통 몇 분에서 최대 24시간 정도 걸릴 수 있습니다.

## 추천

현재 구조에서는 Netlify가 가장 간단합니다. Git 연결 없이도 폴더 드래그 업로드로 바로 배포할 수 있고, 이후 도메인 연결도 쉽습니다.

