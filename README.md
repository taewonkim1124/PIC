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
- 비밀번호 변경

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

자동 QR 이메일 발송 설정:

1. Google 계정에서 2단계 인증을 켭니다.
2. Google 계정 보안 설정에서 앱 비밀번호를 생성합니다.
3. 앱 비밀번호 이름은 `PIC QR`처럼 알아보기 쉽게 설정합니다.
4. `.env.local`에 Gmail 계정과 앱 비밀번호를 넣습니다.
5. Vercel 환경변수에도 같은 값을 등록합니다.
6. Vercel production을 재배포합니다.

필요한 Gmail 환경변수:

```env
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=google-app-password
```

이 설정이 끝나면 Google Form 제출 시 다음 순서로 자동 처리됩니다.

1. Form 응답이 Google Sheet에 저장됩니다.
2. Apps Script가 `/api/google-form`으로 응답을 보냅니다.
3. 앱이 Notion Member DB에 멤버를 생성하거나 업데이트합니다.
4. QR 코드가 없으면 새로 발급합니다.
5. 멤버 이메일로 QR 코드가 자동 발송됩니다.

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

같은 멤버가 같은 날짜에 같은 챌린지로 이미 체크인했다면 다시 저장되지 않습니다. 체크인은 `Challenge Check-ins` DB에 한 명당 한 줄씩 저장됩니다.

중복 체크인은 `Check-in Key`로 막습니다.

```text
memberPageId:challengePageId:YYYY-MM-DD
```

현재 앱은 챌린지를 `Challenge Name + Date`로 찾거나 만들기 때문에 날짜별 Challenge 페이지를 사용합니다. 그래서 `memberPageId:challengePageId`만으로도 같은 날짜 중복은 막을 수 있지만, 나중에 같은 Challenge 페이지를 여러 날짜에 재사용할 가능성까지 고려해서 날짜를 포함합니다.

### 참여명단

```text
/checkins
```

오늘 특정 챌린지에 참여한 멤버 목록을 확인하는 페이지입니다.

사용 방법:

1. 챌린지를 선택합니다.
2. `참여명단 불러오기` 버튼을 누릅니다.
3. 오늘 참여한 멤버 이름과 이메일을 확인합니다.

표시되는 정보:

- 멤버 이름
- 이메일
- 체크인 시각
- 체크인 방식
- 처리 관리자
- 체크인 상태

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

챌린지 하나당 한 페이지를 유지합니다.

필요한 컬럼:

| 컬럼 이름 | 타입 |
| --- | --- |
| `Challenge Name` | Title |
| `Date` | Date |
| `Check-ins` | Relation |
| `Participant Count` | Rollup |
| `Participants` | Rollup |

`참여명단`은 기존 데이터 보존용으로 남겨둘 수 있습니다. 앱은 더 이상 이 relation 배열을 읽어서 덮어쓰지 않습니다. 실제 체크인 기록은 아래 `Challenge Check-ins` 데이터베이스가 기준입니다.

Rollup 설정:

| 컬럼 이름 | 설정 |
| --- | --- |
| `Participant Count` | Relation: `Check-ins`, Property: `Member`, Calculate: `Count unique values` |
| `Participants` | Relation: `Check-ins`, Property: `Member`, Calculate: `Show unique values` |

### Challenge Check-ins 데이터베이스

QR 스캔 1번마다 한 줄씩 저장되는 실제 체크인 기록입니다.

자동 생성:

```bash
node scripts/create-challenge-checkins-database.mjs
```

이 스크립트는 기존 Challenge 데이터베이스와 같은 Notion 페이지 아래에 `Challenge Check-ins` DB를 만들고, `.env.local`에 필요한 ID를 추가합니다.

기존에 만든 `Challenge Check-ins` DB의 컬럼명을 새 구조에 맞추려면 다음 스크립트를 사용합니다.

```bash
node scripts/update-challenge-checkins-schema.mjs
```

이 스크립트는 `Name`을 `Check-in`으로, `Date`를 `Check-in Date`로, `Checked In By`를 `Recorded By`로 이름만 바꾸고, `Check-in Key`가 없으면 추가합니다. 기존 체크인 페이지는 삭제하지 않습니다.

필요한 컬럼:

| 컬럼 이름 | 타입 |
| --- | --- |
| `Check-in` | Title |
| `Member` | Relation |
| `Challenge` | Relation |
| `Checked In At` | Date |
| `Check-in Date` | Date |
| `Method` | Select |
| `Recorded By` | Rich text |
| `Status` | Select |
| `Check-in Key` | Rich text |

중요:

- `Member`는 Member 데이터베이스와 연결합니다.
- `Challenge`는 Challenge 데이터베이스와 연결합니다.
- 앱은 `Challenge Check-ins` DB를 기준으로 중복 체크인을 막고 참여명단을 불러옵니다.
- `Checked In At`은 실제 스캔 시간이므로 `last_edited_time`보다 정확합니다.
- `Check-in Date`는 `America/New_York` 기준 날짜입니다.
- `Status`는 정상 체크인은 `Valid`, 취소 기록은 `Cancelled`를 사용합니다.

각 챌린지 페이지 내부에 전체 체크인 명단을 보려면 `Challenge Check-ins` DB의 linked view를 추가합니다. 자세한 설정과 기존 데이터 migration 절차는 [Challenge Check-ins 전환 가이드](docs/challenge-checkins-migration.md)를 참고하세요.

### Payments 데이터베이스

결제 기록을 저장합니다.

필요한 컬럼:

| 컬럼 이름 | 타입 |
| --- | --- |
| `Name` | Title |
| `Code` | Rich text |
| `Item` | Rich text |
| `Price` | Rich text |
| `Recorded By` | Rich text |
| `Recorded At` | Date |

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
NOTION_CHALLENGE_CHECKINS_DATABASE_ID=
NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID=
NOTION_PAYMENTS_DATABASE_ID=
NOTION_PAYMENTS_DATA_SOURCE_ID=
NOTION_ADMINS_DATABASE_ID=
NOTION_ADMINS_DATA_SOURCE_ID=
GMAIL_USER=
GMAIL_APP_PASSWORD=
GOOGLE_FORM_SECRET=
APP_AUTH_SECRET=
ADMIN_USERS=
ADMIN_PASSWORD=
```

로그인 권한:

- 운영진 계정은 Notion Admins DB에 직접 입력해서 관리합니다.
- 로그인한 사람 이름이 결제 장부의 `Recorded By`에 저장됩니다.
- `ADMIN_USERS`, `ADMIN_PASSWORD`는 Notion Admins DB를 쓰기 전 임시/백업용입니다.

개별 관리자 계정 예시:

```env
ADMIN_USERS=[{"username":"taewon","password":"change-this-password","name":"김태원"},{"username":"minjun","password":"change-this-password","name":"김민준"}]
```

### Notion 관리자 DB

관리자 DB 컬럼:

| 컬럼 이름 | 타입 |
| --- | --- |
| `Name` | Title |
| `Username` | Rich text |
| `Password Hash` | Rich text |
| `Active` | Checkbox |
| `활동중` | Select 또는 Status |

비밀번호 입력 방법:

- 간단하게 쓰려면 회장이 정한 임시 비밀번호를 `Password Hash` 칸에 그대로 넣어도 됩니다.
- 운영진이 첫 로그인에 성공하면 앱이 그 값을 자동으로 해시값으로 바꿔 저장합니다.
- 처음부터 해시값으로 넣고 싶으면 아래 명령을 사용합니다.

비밀번호 해시 생성:

```bash
node scripts/hash-admin-password.mjs 사용할비밀번호
```

생성된 해시를 `Password Hash`에 넣고, `Active`를 체크하면 해당 관리자가 로그인할 수 있습니다. `활동중` 컬럼을 Select 또는 Status로 쓰는 경우에는 값이 `활동중`, `재직`, `현직` 중 하나일 때만 로그인할 수 있습니다.

관리자 계정 추가 순서:

1. 회장이 임시 비밀번호를 정합니다.
2. Notion Admins DB에 `Name`, `Username`, `Password Hash`, `Active`를 직접 입력합니다.
3. `Password Hash`에는 임시 비밀번호를 그대로 넣거나, 해시 생성 명령으로 만든 값을 넣습니다.
4. 운영진에게 `Username`과 임시 비밀번호를 전달합니다.
5. 운영진은 로그인 후 `/account/password`에서 본인 비밀번호로 변경합니다.

이 방식을 쓰려면 Vercel 환경변수에 `NOTION_ADMINS_DATA_SOURCE_ID`를 등록해야 합니다.

주의:

- `.env.local`은 GitHub에 올리면 안 됩니다.
- Notion 토큰과 Gmail 앱 비밀번호는 외부에 공유하면 안 됩니다.
- Vercel 배포 시에도 같은 환경변수를 Vercel 프로젝트 설정에 등록해야 합니다.

## Challenge Check-ins 구조와 migration

현재 체크인은 `Challenge Check-ins` 데이터베이스에 한 명당 한 줄씩 저장합니다. 기존처럼 Challenges DB의 `참여명단` relation 배열을 직접 덮어쓰지 않습니다.

올바른 relation 구조:

| DB | 속성 | 연결 |
| --- | --- | --- |
| `Challenge Check-ins` | `Challenge` | Challenges DB로 연결 |
| `Challenges` | `Check-ins` | `Challenge`의 반대편 양방향 relation |

중요: 위 두 속성은 따로 만든 relation 두 개가 아니라 Notion의 같은 양방향 relation 쌍이어야 합니다. 그래야 체크인 페이지에서 `Challenge`를 지정하면 Challenges DB의 `Check-ins`에도 자동으로 보입니다.

새 DB 생성:

```bash
node scripts/create-challenge-checkins-database.mjs
```

이미 relation을 잘못 만든 경우 먼저 dry-run으로 확인합니다.

```bash
node scripts/repair-challenge-checkins-relation.mjs
```

자동 복구를 시도할 때만 `--write`를 붙입니다.

```bash
node scripts/repair-challenge-checkins-relation.mjs --write
```

Notion에서 직접 만드는 Rollup:

| 속성 | 설정 |
| --- | --- |
| `Participant Count` | Relation: `Check-ins`, Property: `Member`, Calculate: `Count unique values` |
| `Participants` | Relation: `Check-ins`, Property: `Member`, Calculate: `Show unique values` |

각 Challenge 페이지 안에서 체크인 명단을 보려면 `/linked view of database`로 `Challenge Check-ins` DB를 넣고, `Challenge contains 현재 페이지`, `Status is Valid` 필터를 추가한 뒤 `Checked In At` 오름차순으로 정렬합니다.

기존 `참여명단` 데이터를 새 DB로 옮기기 전에는 dry-run을 먼저 실행합니다. 아무 옵션 없이 실행해도 dry-run입니다.

```bash
node scripts/migrate-legacy-challenge-checkins.mjs --dry-run
```

실제 생성은 아래 명령으로만 실행합니다.

```bash
node scripts/migrate-legacy-challenge-checkins.mjs --write
```

migration은 `참여명단` relation을 pagination해서 끝까지 읽고, 이미 존재하는 `Status = Valid`의 `Check-in Key`는 건너뜁니다. 기존 `참여명단` relation은 삭제하거나 비우지 않습니다.

자세한 절차는 [Challenge Check-ins 전환 가이드](docs/challenge-checkins-migration.md)를 참고하세요.
