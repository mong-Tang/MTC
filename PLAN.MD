# ZIP 이미지 도서 뷰어 v0.1 개발 계획서 (`PLAN.MD`)

작성일: 2026-03-06  
대상: Windows (Electron + NSIS 설치형)

---

## 1) 결론(개발 착수 기준)

v0.1은 **오픈소스 기반으로 즉시 착수 가능**하며, 범위는 아래로 고정한다.

- ZIP 1개를 풀지 않고 열기
- 이미지 페이지 넘김
- 종료 후 재실행 시 마지막 페이지 복원
- Recent 10개
- NSIS 설치/제거 1회 통과

---

## 2) 스코프 고정

### 포함 (v0.1)
- Open ZIP
- ZIP 내부 이미지 목록 + 자연 정렬
- Viewer: `←/→/Space/F/Esc`
- 마지막 페이지 저장/복원
- Recent 10개

### 제외 (v0.1)
- RAR/7z/분할압축
- 암호 ZIP 해제 지원
- 텍스트 열람/썸네일/서재/검색/태그
- 파일 연결(.zip 더블클릭)
- 자동 업데이트

---

## 3) 제품 원칙

- 로컬 파일만 처리 (업로드/동기화/공유 없음)
- README/About 고지:
  - “본 앱은 로컬 파일 열람 도구이며 저작권 자료의 무단 공유·배포를 돕지 않습니다.”
- 라이선스: MIT/BSD/zlib 계열 의존성 우선
- UI/메뉴/에러 문구 하드코딩 금지 (문구는 i18n 키로만 참조)
- 개발 중 신규/변경 규칙은 `RULES.MD`에 즉시 기록하고, 필요 시 본 계획 체크리스트에 즉시 반영

### 3.1 확장성 + i18n 필수 설계 원칙
- v0.1부터 모듈 분리 고정:
  - `providers` (압축 포맷별 구현)
  - `core` (정렬/페이지/캐시 공통 로직)
  - `stores` (recent/progress)
  - `ipc` (채널/DTO/에러코드)
  - `ui` (화면 컴포넌트)
- 압축 포맷은 인터페이스 기반:
  - `IArchiveProvider` 규약 정의
  - v0.1은 ZIP 구현체만 탑재
  - v0.2+에서 RAR/7z는 구현체 추가 방식으로 확장
- 다국어는 키 기반 단일 소스:
  - `locales/ko.json`, `locales/en.json` 유지
  - 모든 화면/메뉴/다이얼로그/오류 메시지는 `t('key')`로 호출
  - 문구 수정은 locale 파일만 변경하고 코드 수정은 금지(키 변경 제외)
- 누락 키 대응:
  - `현재 언어 -> 보조 언어 -> key` 순으로 fallback
  - 누락 키는 개발 콘솔 경고로 노출

---

## 4) 아키텍처

## 4.1 Main Process

### A) `zipIndex`
- `openZip(filePath)` 구현
- 엔트리 로드 → 이미지 확장자 필터링 → 자연 정렬
- `pages[]` + `meta(title, totalPages)` 반환

### B) `pageProvider`
- `getPage(zipPath, entryName)` 구현 (엔트리 단위 읽기)
- 프리페치: 다음 2장
- 캐시 제한: 3~5장
- 읽기 실패/손상 ZIP 에러 코드화

### C) `recentStore`
- 저장 위치: `app.getPath('userData')` 하위
  - `recent.json`
  - `progress.json`
- Atomic write 적용 (`tmp -> replace`)

### D) `ipc`
- `openZipDialog()`
- `openZip(zipPath)`
- `getPage(zipPath, entryName)`
- `getRecent()`, `openRecent(zipPath)`
- `getProgress(fileId)`, `setProgress(fileId, pageIndex)`

> 참고: 대용량 복사비용을 줄이기 위해 페이지 전달은 단순 bytes 직전달보다 효율적인 경로(버퍼/핸들/ObjectURL) 우선 설계.

## 4.2 Renderer

### A) Launcher
- Open ZIP 버튼
- Recent 10개 표시 및 재오픈

### B) Viewer
- 이미지 표시
- 페이지 이동 / 전체화면 / Launcher 복귀
- 상태바: `파일명 | 현재/전체 | 진행률`
- 페이지 변경 시 progress 저장

### C) 키 처리 정책
- “포커스 무관”은 **앱 내부 포커스 기준**
- `Esc` 우선순위:
  1. 전체화면이면 전체화면 해제
  2. 일반 상태면 Launcher 복귀

## 4.3 국제화(i18n) 구성
- `src/locales/ko.json`, `src/locales/en.json`
- `src/shared/i18n.ts`:
  - `setLocale(locale)`
  - `t(key, params?)`
- 기본 언어: `ko`
- 언어 전환 시 적용 범위:
  - Launcher 버튼/리스트 라벨
  - Viewer 상태바/오류 메시지
  - 메뉴/다이얼로그 문구
- 원칙:
  - 키 네이밍 일관 (`menu.openZip`, `viewer.pageInfo`, `error.zip.corrupted`)
  - 문자열 직접 작성 금지

---

## 5) 데이터 설계

## 5.1 파일 식별 키(`fileId`)
- 단순 `zipPath` 대신 아래 조합 사용:
  - `normalizedPath + size + mtimeMs`
- 목적: 동일 경로 파일 교체 시 오복원 방지

## 5.2 스키마(초안)

```json
// recent.json
[
  {
    "fileId": "path|size|mtime",
    "zipPath": "C:\\\\...",
    "title": "sample.zip",
    "lastPageIndex": 12,
    "lastOpenedAt": "2026-03-06T10:00:00.000Z"
  }
]
```

```json
// progress.json
{
  "path|size|mtime": {
    "pageIndex": 12,
    "updatedAt": "2026-03-06T10:00:00.000Z"
  }
}
```

---

## 6) 예외 처리(필수)

- 이미지 없는 ZIP
- 암호 ZIP (v0.2 이후 지원 안내)
- 손상 ZIP/읽기 실패
- 경로 없음/권한 없음

에러 응답은 `code/message` 구조로 통일한다.

---

## 7) 성능/안전 가드

- 로딩 인디케이터 표시 (UI 멈춤 오해 방지)
- 메모리 캐시 상한 준수
- ZIP bomb/과도한 엔트리 수/초대형 이미지 가드
- 페이지 요청 폭주 방지 (디바운스 또는 직렬화)

---

## 8) 빌드/배포 (NSIS)

## 8.1 기본 절차
1. `npm install`
2. `npm run dev` (기능 확인)
3. `npm run build`
4. `npm run dist:win`

## 8.2 산출물
- `ZipBookViewer Setup 0.1.0.exe`
- `README.md`
- `RELEASE_NOTES.md`
- `THIRD_PARTY_NOTICES.md`

## 8.3 제거 정책
- 앱 제거 시 `%APPDATA%` 데이터는 기본 유지 (v0.1)

---

## 9) 테스트 체크리스트

## 9.1 릴리즈 게이트(필수)
- ZIP 열기
- 10장 넘김
- 재실행 시 마지막 페이지 복원
- Recent 기록 및 재오픈
- NSIS 설치/제거 1회 통과

## 9.2 포맷/정렬
- JPG/PNG/WEBP/혼합
- `1,2,10`, `001,002,010` 정렬 정상
- 한글/특수문자 파일명
- ZIP 내부 폴더 평탄화 페이지 연결

## 9.3 대용량/입력
- 50MB 이하 / 300MB~1GB / 2GB~10GB
- 단축키, 경계(첫/끝), F/Esc 정상

## 9.4 예외
- 이미지 없음
- 암호 ZIP
- 손상/읽기 실패
- 권한/경로 오류

---

## 10) 진행 현황 대시보드

- 기준 시작일: 2026-03-06 (금)
- 목표 완료일: 2026-03-12 (목)
- 현재 상태: `Blocked`
- 전체 체크 항목: `31`  (탐색기 트리/드래그드롭 항목 추가)
- 완료 항목: `17`
- 진행률: `54.8%`  (`완료 항목 / 전체 체크 항목 * 100`)
- Blocker: `히든 폴더 필터 미완성, 드래그드롭 ZIP 열기 미동작`

---

## 11) Day별 실행 체크리스트 (진행률 추적용)

## 11.1 Day 1 — `zipIndex` (목록/필터/정렬)
- [x] ZIP 엔트리 목록 로드
- [x] 이미지 확장자 필터링
- [x] 자연 정렬 적용
- [x] `meta + pages[]` 반환 확인
- [x] i18n 기본 골격 생성 (`ko/en locale` + `t()` 유틸)

## 11.2 Day 2 — Viewer 1장 표시 + IPC 연결
- [x] Launcher/Viewer 기본 UI 골격 구축
- [x] 좌측 트리(`Library/Open ZIP/Recent/Viewer/Settings`) + 우측 콘텐츠 레이아웃 구축
- [x] Open ZIP → Viewer 진입
- [x] 첫 페이지 이미지 렌더링
- [x] 이전/다음 페이지 이동 동작
- [x] 페이지 요청 에러 코드/메시지 확인
- [x] 화면 문구 하드코딩 0건 확인(키 참조만 사용)

## 11.3 Day 3 — progress / recent 저장
- [x] `userData` 경로에 JSON 저장 생성
- [x] `fileId(path+size+mtime)` 키 적용
- [x] 종료 후 재실행 시 마지막 페이지 복원
- [x] Recent 10개 기록/재오픈 확인

## 11.4 Day 4 — 단축키/전체화면/예외 메시지
- [ ] 단축키(←/→/Space/F/Esc) 정상
- [ ] `Esc` 우선순위(전체화면 해제 → Launcher 복귀) 확인
- [ ] 예외 4종 메시지 노출(이미지 없음/암호/손상/권한)
- [x] 로딩 표시 + 요청 폭주 방지 적용
- [ ] 한/영 전환 시 메뉴/상태바/오류 메시지 일괄 반영 확인

## 11.5 Day 5 — NSIS 빌드/설치/제거/릴리즈
- [ ] `npm run dist:win` 성공
- [ ] 설치 후 기본 동작 점검
- [ ] 제거 후 바로가기 정리 확인
- [ ] `%APPDATA%` 데이터 유지 확인 + 산출물 정리
- [ ] locale 키 1건 수정 후 전 화면 일괄 반영 회귀 확인

## 11.6 Day 6 — 탐색기형 트리/입력 UX
- [x] 상단 File 메뉴로 `Open ZIP/Recent/Viewer/Settings` 이동
- [x] 좌측 탐색기형 드라이브/폴더 트리 1차 구현
- [x] ZIP 더블클릭 열기 구현
- [ ] 히든/시스템 폴더 필터 완성 (실제 hidden attribute 기준)
- [ ] 드래그드롭 ZIP 열기 정상화 (현재 미동작)

---

## 12) 작업 로그 (일일 기록)

| 날짜 | 상태 | 작업 내용 | 결과 | 이슈/리스크 | 다음 액션 |
|---|---|---|---|---|---|
| 2026-03-06 | In Progress | 프로젝트 초기 골격/ZIP 인덱스/i18n 기본 구성 + Electron UI 껍데기 | Day1 완료, Day2 골격(트리 레이아웃/Launcher/Viewer/IPC/키입력 틀) 구축, `npm run check/build` 통과, `npm run dev` 창 실행 확인 | Viewer는 아직 실제 이미지 bytes 렌더링 미연결 | Day2 남은 항목(실페이지 렌더/에러 검증/하드코딩 점검) 진행 |
| 2026-03-06 | In Progress | Day2 잔여 항목 구현 (페이지 IPC/실이미지 렌더/다국어 다이얼로그) | `zip:get-page` IPC 추가, Open ZIP 즉시 Viewer 진입 + 첫 페이지 렌더, 좌/우/Space 페이지 이동 반영, 페이지 에러 코드(`ZIP_PAGE_NOT_FOUND`) 추가, `npm run check/build` 통과, 샘플 ZIP 연동 스모크 테스트 통과 | Viewer 상태 저장(progress/recent 영속화)은 Day3 범위로 미구현 | Day3 항목(`userData` 저장, fileId, 재실행 복원, Recent 영속화) 진행 |
| 2026-03-06 | In Progress | Day3 구현 (progress/recent 영속화) | `recent:get/upsert`, `progress:get/set` IPC 추가, `fileId(path+size+mtime)` 적용, `userData`에 `recent.json/progress.json` atomic 저장, ZIP 재오픈 시 마지막 페이지 복원 경로 연결, `npm run check/build` 통과 | Electron GUI 수동 회귀(재실행/Recent 클릭 흐름)는 별도 확인 필요 | Day4 항목(단축키 전반/예외 4종/로딩·폭주 방지/한영 일괄 반영) 진행 |
| 2026-03-07 | In Progress | Day4 일부 + UI 개편 + 탐색기형 트리 도입 | File 메뉴 액션 통합, i18n 메뉴 동기화, 요청 폭주 방지(렌더 직렬화) 적용, 좌측 드라이브/폴더 트리 및 ZIP 더블클릭 오픈 구현, `npm run check/build` 통과 | 히든 폴더 일부 노출(`!INDIAJ` 등), 드래그드롭 ZIP 오픈 미동작, 색 대비 이슈 재발 가능성 | Day6 잔여 2건(히든 attribute 기반 필터/드래그드롭 이벤트 재검증) 우선 해결 |

상태 값: `Not Started` / `In Progress` / `Done` / `Blocked`

---

## 12.1 다음 작업 우선순위 (2026-03-08)

1. 히든 폴더 필터 정확화  
   - Windows 파일 속성(hidden/system) 기반으로 필터 로직 교체
2. 드래그드롭 복구  
   - `dragenter/over/leave/drop` 이벤트 흐름 재검증
   - `DataTransfer.files[*].path` 유효성/권한 케이스 점검
3. 회귀 테스트  
   - 트리 더블클릭 오픈, File 메뉴 오픈, 단축키, Recent, 오류 메시지 로케일 전환
4. 문서 동기화  
   - 해결 후 `PLAN.MD`/`RULES.MD` 상태 즉시 갱신

## 13) 완료 정의(DoD)

아래 5개를 모두 만족하면 v0.1 완료:

1. ZIP 열람 정상
2. 10장 이동 정상
3. 재실행 복원 정상
4. Recent 10개 정상
5. 설치/제거 1사이클 정상

---

## 14) 2026-03-07 드래그드랍 비교 분석 메모

### 14.1 기준 수집기

- 기준 프로젝트: `D:\my_Work\workspace\drag-chk`
- 목적: `MTC`에서 드래그가 안 되는 원인을 비교하기 위한 원시 데이터 수집
- 리포트 위치: `D:\my_Work\workspace\drag-chk\reports`
- 참고 문서: `D:\my_Work\workspace\drag-chk\DRAG_DROP_REPORT.md`

### 14.2 drag-chk 기준 데이터(폴더 1개 드롭)

- `types = Files`
- `files.length = 1`
- `items.length = 1`
- `file.path 있음 = 0`
- `file.path 없음 = 1`
- `entry directory = 1`
- `entry file = 0`
- 폴더 엔트리 이름 확인: `시스템 정리`
- 결론: Electron에서 폴더 드롭은 정상적으로 들어오더라도 `file.path` 없이 들어올 수 있음

### 14.3 MTC 코드 확인 결과

확인 파일:

- `src\renderer\index.ts`
- `src\main\preload.ts`

핵심 사실:

1. `MTC`는 드래그 이벤트 자체를 받지 못하는 구조가 아님
2. `dragenter / dragover / dragleave / drop` 이벤트는 전역 타깃에 연결되어 있음
3. 실제 드롭 처리는 `extractDroppedZipPath(dataTransfer)` 결과에 의존함
4. `extractDroppedZipPath`는 사실상 **ZIP 파일 경로 추출 전용 함수**임
5. ZIP 경로를 못 찾으면 즉시 실패 처리함

관련 코드 요약:

```ts
const droppedZipPath = extractDroppedZipPath(dataTransfer);
if (!droppedZipPath) {
  showError({
    code: 'DROP_DEBUG',
    message: `${t('error.zip.onlyZip')} (${describeDataTransfer(dataTransfer)})`
  });
  return;
}
```

### 14.4 원인 분석 결론

1차 결론:

- `MTC`에서 "드래그가 안 된다"는 현상은
  **드롭 이벤트 자체가 안 오는 문제라기보다, ZIP 파일이 아니면 실패 처리하는 현재 정책의 결과**일 가능성이 높음

세부 결론:

- `MTC`는 현재 **ZIP 파일만 드롭 허용**
- 폴더 드롭 처리 전용 분기는 없음
- `dataTransfer.items`의 directory entry 정보도 실사용하지 않음
- `file.path`가 비어 있는 폴더 드롭은 현재 구조에서 열 수 없음
- 따라서 **폴더 드롭 실패는 현재 구현상 정상 결과**

### 14.5 MTC와 drag-chk 비교 시 주의점

- `file.path`가 비어 있다고 해서 드롭 이벤트 실패로 판단하면 안 됨
- 폴더 드롭은 `items` / `entry` 기준으로 판단해야 할 수 있음
- `drag-chk` 기준 정상값과 `MTC` 결과를 같은 입력으로 비교해야 함

### 14.6 다음 작업 기준

경우 A) 제품 요구사항이 `ZIP만 허용`인 경우

- 현재 MTC 드롭 동작은 정상
- 문구/디버그 메시지/가이드만 정리하면 됨

경우 B) 제품 요구사항이 `폴더도 허용`인 경우

- `extractDroppedZipPath` 중심 구조를 확장해야 함
- `dataTransfer.items`
- `webkitGetAsEntry()`
- directory entry 판별
- path 없는 폴더 드롭 처리
- 폴더 내부 탐색 또는 별도 열기 정책 정의

### 14.7 다음 확인 질문

- MTC가 받아야 하는 입력은 정말 `ZIP 파일만`인가?
- 아니면 `폴더 드롭`도 정식 지원 대상인가?

### 14.8 반영 상태 업데이트

- 상태: **정책 유지 + 진단 강화 완료**
- 정책 유지: 드롭으로 여는 대상은 계속 `ZIP 파일만` 허용
- 진단 강화:
  - `directory-dropped`
  - `zip-without-path`
  - `non-zip-file`
  - `no-file-payload`
  - `zip-path-found`
- 기대 효과: 드래그가 "안 되는지"와 "정책상 거부된 것인지"를 구분 가능

### 14.9 2026-03-07 구조 전환 결정

- 기존 좌측 파일탐색기 트리 구조를 제거 대상으로 전환한다.
- 새 구조는 메뉴 기반 `파일 열기` / `폴더 열기`를 사용한다.
- `파일 열기` 지원 대상:
  - ZIP 파일
  - 뷰어로 표시 가능한 이미지 파일
- `폴더 열기` 후 좌측 영역에는 선택한 폴더 내부 리스트를 표시한다.
- 좌측 리스트 표시 대상:
  - ZIP 포함 모든 압축파일
  - 이미지 파일
- 리스트 아이템 더블클릭 동작:
  - ZIP: 기존 ZIP 열기 로직 사용
  - 이미지: 뷰어에 바로 표시
  - 기타 압축파일: 실제 변환 대신 변환 필요 메시지 표시
- drag/drop은 보조 입력으로 유지하되, 기본 진입은 메뉴 기반으로 본다.

### 14.10 2026-03-07 목록/뷰어 표시 정책 추가

- 좌측 폴더 리스트는 컴팩트 단일 행 목록으로 표시한다.
- 긴 파일명은 줄바꿈하지 않고 `...` 으로 축약한다.
- 전체 파일명은 hover tooltip 으로 확인한다.
- ZIP 뷰어는 `1쪽 보기` / `2쪽 보기`를 지원한다.
- `2쪽 보기`는 ZIP 페이지 뷰어에만 적용한다.
- 이미지 단독 보기는 항상 1장만 표시한다.
- 이미지 표시 옵션은 View 메뉴에서 제어한다.
  - 자동으로 채우기
  - 1:1 보기
  - 폭에 맞추기
  - 높이에 맞추기

### 14.11 2026-03-07 뷰어/인스턴스 정책 추가

- 뷰어 영역 상단의 `뷰어` 제목 줄을 제거한다.
- 책 제목 줄은 별도 상단 제목으로 표시하지 않는다.
- 새 파일 열기 / 새 폴더 열기 시 기존 표시 상태를 클리어하고 새 항목으로 교체한다.
- 프로그램 인스턴스는 1개만 유지한다.
- View 메뉴는 항목 증가를 고려해 그룹형 하위 메뉴 구조로 관리한다.

## 14.13 2026-03-07 앱 상태 저장/복원 정책
- 앱은 마지막 종료 시점의 상태를 다음 실행에서 복원한다.
- 복원 대상: 창 위치/크기, 최대화 여부, 언어 상태, 1쪽/2쪽 보기, 이미지 맞춤 모드, 좌측 목록 폭.
- 메뉴 선택으로 바뀌는 보기/언어 상태는 즉시 저장한다.
- 창 이동/리사이즈/최대화 변경도 자동 저장한다.
- 이미지 맞춤은 메뉴 체크 상태와 실제 렌더링 결과가 일치해야 한다.

## 14.14 2026-03-07 세션 정리 메모

### 현재 구조 요약
- 좌측 기존 파일 탐색기 트리는 제거 방향으로 전환했다.
- 현재 기본 진입은 메뉴 기반 `파일 열기` / `폴더 열기` 구조다.
- `파일 열기`는 ZIP 파일과 이미지 파일을 지원한다.
- `폴더 열기`는 좌측 목록에 압축파일과 이미지 파일을 표시한다.
- 목록 아이템 더블클릭 시 ZIP은 기존 ZIP 열기 로직, 이미지는 직접 표시, 기타 압축파일은 변환 필요 메시지로 처리한다.

### 메뉴 구조
- 메뉴에는 `파일`, `보기`, `언어`, `Window`, `Help`가 있다.
- 메뉴 우측 확장 대신 메뉴 끝에 빠른 보기 항목(`1쪽 보기`, `2쪽 보기`)과 상태 텍스트를 둔다.
- 언어 전환은 메뉴에서 처리한다.
- 최근 파일은 최대 10개까지 메뉴에서 다시 열 수 있게 한다.

### 뷰어 현재 방향
- 뷰어 상단 제목줄은 제거했다.
- 하단 상태줄은 제거했고, 상태는 메뉴 텍스트로 표시한다.
- 뷰어 외곽 점선 라인은 제거했다.
- 뷰어는 가능한 크게 보이도록 패딩을 줄인 상태다.
- 이미지 정렬은 현재 중앙 정렬 기준이다.

### 상태 저장/복원
- 다음 항목은 저장 후 다음 실행에서 복원하는 방향으로 정리했다.
  - 창 위치
  - 창 크기
  - 최대화 여부
  - 언어 상태
  - 1쪽/2쪽 보기 모드
  - 이미지 맞춤 모드
  - 좌측 패널 폭

### 드래그/드롭 관련 정리
- 외부 드래그 실험은 원인 분석용으로 사용했고, 현재 기본 진입 경로는 메뉴 기반이다.
- 내부 이미지 자체 드래그는 에러로 보지 않고 비활성 처리한다.
- ZIP 외 드롭은 현재 정책상 기본 허용 대상이 아니다.

### 현재 남아 있는 점검 항목
- 이미지 맞춤(특히 높이에 맞추기/폭에 맞추기)이 사용자가 기대하는 체감과 완전히 일치하는지 추가 확인 필요.
- 중앙 정렬과 스크롤 시작 위치의 체감이 맞는지 확인 필요.
- 메뉴 상태 체크와 실제 렌더링 결과가 모든 경우에 일치하는지 재확인 필요.
- 창 리사이즈 직후 재렌더링이 더 필요한지 확인 필요.

### 다음 세션 시작 시 우선 확인할 것
1. 높이에 맞추기에서 상하 여백이 실제로 해소됐는지 확인
2. 폭에 맞추기/높이에 맞추기/자동/1:1 네 모드 차이가 명확한지 확인
3. 앱 재실행 후 창 상태/언어/보기 모드가 정상 복원되는지 확인
4. 스크롤과 Shift+휠 가로 이동이 원하는 수준인지 확인
