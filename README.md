# PIC QR 체크인 사용설명서

PIC 동아리 멤버 등록, QR 발급, 챌린지 체크인, 결제 장부 기록을 관리하는 웹앱입니다.

배포 주소:

```text
https://pic-beta-blue.vercel.app
```

## 전체 흐름

1. 관리자가 멤버 관리 페이지에서 멤버를 등록합니다.
2. 앱이 Notion 멤버 데이터베이스에 멤버를 저장합니다.
3. 관리자가 멤버별 QR 코드를 발급하거나 이메일로 발송합니다.
4. 관리자는 챌린지 현장에서 QR을 스캔해 참여를 기록합니다.
5. 결제가 필요한 경우, 관리자는 QR을 먼저 스캔한 뒤 아이템과 가격을 입력해 장부에 저장합니다.
6. Notion에서 멤버 명단, 챌린지 참여명단, 결제 장부를 확인합니다.

## 주요 페이지

### 홈

```text
/
```

다음 기능으로 이동할 수 있습니다.

- QR 체크인
- 멤버 관리
- 참여명단
- 결제 장부

### 멤버 관리

```text
/admin/participants
```

관리자가 멤버와 QR 코드를 관리하는 페이지입니다.

가능한 작업:

- 새 멤버 등록
- 기존 멤버 검색
- QR 코드 보기
- QR 코드 발급
- QR 코드 재발급
- QR 코드 이메일 발송

주의:

- 재발급하면 기존 QR 코드는 더 이상 체크인에 사용할 수 없습니다.
- 재발급해도 기존 참여 기록은 사라지지 않습니다.
- 같은 이메일의 멤버를 중복 등록하지 않는 것이 중요합니다.

### Google Form으로 멤버 등록하기

공개 가입 페이지 대신 Google Form으로 신청서를 받고, 응답이 들어오면 자동으로 Notion Member DB에 저장할 수 있습니다.

추천 Google Form 질문:

| Google Form 질문 | 앱으로 보내는 값 |
| --- | --- |
| 이름 | `name` |
| 직책 | `role` |
| 팀 | `team` |
| 메모 | `memo` |
| 젠더 | `gender` |
| 이메일 | `email` |
| 카카오톡 | `kakao` |
| 번호 | `phone` |
| 인스타 | `instagram` |
| 입사일 | `joinDate` |
| 학년 | `grade` |

동작 방식:

1. 사람이 Google Form을 제출합니다.
2. Google Form 응답이 Google Sheets에 쌓입니다.
3. Google Sheets의 Apps Script가 `/api/google-form`으로 응답을 보냅니다.
4. 앱이 Notion Member DB에 멤버를 생성하거나 기존 멤버를 업데이트합니다.
5. 이메일이 있으면 QR 코드가 이메일로 발송됩니다.

중복 처리:

- 같은 이메일이 이미 있으면 새 멤버를 만들지 않고 기존 멤버 정보를 업데이트합니다.
- 기존 멤버에게 QR 코드가 이미 있으면 그 QR 코드를 유지합니다.
- 기존 멤버에게 QR 코드가 없으면 새 QR 코드를 발급합니다.

Apps Script 설정 방법:

1. Google Form 응답을 Google Sheets에 연결합니다.
2. 응답 Google Sheet에서 `확장 프로그램` → `Apps Script`를 엽니다.
3. Form 응답을 `/api/google-form`으로 보내는 스크립트를 추가합니다.
4. Apps Script에서 쓰는 secret 값을 Vercel 환경변수 `GOOGLE_FORM_SECRET`과 같은 값으로 맞춥니다.
5. Apps Script 왼쪽의 `트리거`에서 제출 시 자동 실행되도록 설정합니다.
6. Vercel에도 `GOOGLE_FORM_SECRET` 환경변수를 등록하고 재배포합니다.

### QR 체크인

```text
/scan
```

챌린지 참여를 기록하는 페이지입니다.

사용 방법:

1. 챌린지 목록에서 오늘 진행할 챌린지를 선택합니다.
2. `카메라 시작` 버튼을 누릅니다.
3. 멤버의 QR 코드를 스캔합니다.
4. 체크인 결과와 멤버 이름을 확인합니다.

중복 체크인 방지:

같은 멤버가 같은 날짜에 같은 챌린지로 이미 체크인했다면 다시 저장되지 않습니다.

### 참여명단

```text
/checkins
```

오늘 특정 챌린지에 참여한 멤버 목록을 확인하는 페이지입니다.

사용 방법:

1. 챌린지를 선택합니다.
2. `참여명단 불러오기` 버튼을 누릅니다.
3. 오늘 참여한 멤버 이름과 이메일을 확인합니다.

### 결제 장부

```text
/payment
```

멤버 QR을 스캔해서 Notion Payments 장부에 결제 기록을 저장하는 페이지입니다.

현재 장부에 저장되는 컬럼:

| Notion 컬럼 | 저장 내용 |
| --- | --- |
| `Name` | 멤버 이름 |
| `Code` | 멤버 고유 QR 코드 |
| `Item` | 결제 아이템 |
| `Price` | 가격 |

사용 방법:

1. `/payment` 페이지로 이동합니다.
2. `QR 먼저 스캔하기` 버튼을 누릅니다.
3. 멤버의 QR 코드를 스캔합니다.
4. 스캔된 QR 코드를 확인합니다.
5. 아이템을 입력합니다.
   예: `회비`, `티셔츠`, `행사비`
6. 가격을 입력합니다.
   예: `20`
7. `장부에 저장` 버튼을 누릅니다.
8. Notion Payments 데이터베이스에 기록이 추가됩니다.

결제 장부는 체크인 기록과 별도로 저장됩니다.

## Notion 데이터베이스

이 앱은 Notion을 데이터베이스처럼 사용합니다.

### Member 데이터베이스

멤버 정보와 QR 코드를 저장합니다.

필요한 컬럼:

| 컬럼 이름 | 타입 |
| --- | --- |
| `이름` | Title |
| `직책` | Select |
| `팀` | Select |
| `메모` | Rich text |
| `젠더` | Select |
| `이메일` | Email |
| `카카오톡` | Rich text |
| `번호` | Phone number |
| `인스타` | Rich text |
| `입사일` | Date |
| `학년` | Select |
| `활동중` | Checkbox |
| `유니크 코드` | Rich text |

### Challenge 데이터베이스

챌린지별 참여명단을 저장합니다.

필요한 컬럼:

| 컬럼 이름 | 타입 |
| --- | --- |
| `Challenge Name` | Title |
| `Date` | Date |
| `참여명단` | Relation |

`참여명단`은 Member 데이터베이스와 연결되어 있어야 합니다.

### Payments 데이터베이스

결제 기록을 저장합니다.

필요한 컬럼:

| 컬럼 이름 | 타입 |
| --- | --- |
| `Name` | Title |
| `Code` | Rich text |
| `Item` | Rich text |
| `Price` | Rich text |

현재 `Price`는 텍스트로 저장됩니다. 나중에 합계 계산이 필요하면 Notion에서 `Price`를 Number 타입으로 바꾸고 코드도 같이 바꾸면 됩니다.

## iPhone에서 앱처럼 사용하기

1. Safari에서 배포 주소에 접속합니다.
2. 하단 공유 버튼을 누릅니다.
3. `홈 화면에 추가`를 선택합니다.
4. 홈 화면 아이콘으로 접속합니다.

카메라 스캔은 HTTPS 주소에서 사용하는 것이 좋습니다.

## 개발자 실행 방법

패키지 설치:

```bash
npm install
```

개발 서버 실행:

```bash
npm run dev
```

빌드 확인:

```bash
npm run build
```

Lint 확인:

```bash
npm run lint
```

## 환경변수

`.env.local`에 필요한 값:

```env
NOTION_TOKEN=
NOTION_MEMBERS_DATABASE_ID=
NOTION_MEMBERS_DATA_SOURCE_ID=
NOTION_CHECKINS_DATABASE_ID=
NOTION_CHECKINS_DATA_SOURCE_ID=
NOTION_PAYMENTS_DATABASE_ID=
NOTION_PAYMENTS_DATA_SOURCE_ID=
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

주의:

- `.env.local`은 GitHub에 올리면 안 됩니다.
- Notion 토큰과 Gmail 앱 비밀번호는 외부에 공유하면 안 됩니다.
- Vercel 배포 시에도 같은 환경변수를 Vercel 프로젝트 설정에 등록해야 합니다.
