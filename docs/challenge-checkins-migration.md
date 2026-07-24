# Challenge Check-ins 전환 가이드

이 문서는 기존 `Challenges DB`의 `참여명단` relation에 체크인 멤버를 모아두던 방식을, `Challenge Check-ins DB`에 체크인 한 건마다 페이지 한 개를 만드는 방식으로 전환하는 절차입니다.

## 현재 문제

기존 방식은 Challenge 페이지 하나의 `참여명단` relation 배열을 읽고, 새 멤버를 추가한 전체 배열을 다시 덮어썼습니다.

이 방식은 참가자가 많을 때 relation 일부만 읽힐 수 있고, 동시에 두 관리자가 스캔하면 한쪽 기록이 덮어써질 수 있으며, 사람별 실제 체크인 시각과 처리 관리자를 정확히 남기기 어렵습니다.

새 방식은 `Challenge Check-ins DB`에 아래처럼 저장합니다.

```text
멤버 한 명 + 챌린지 하나 + 체크인 날짜 = 체크인 페이지 한 개
```

현재 앱은 날짜별 챌린지를 만들 수 있으므로 중복 방지 키는 날짜를 포함합니다.

```text
memberPageId:challengePageId:YYYY-MM-DD
```

## 올바른 DB 구조

### Members DB

기존 회원 DB를 그대로 사용합니다.

### Challenges DB

챌린지 하나당 페이지 한 개를 유지합니다.

필요한 주요 속성:

| 속성 | 타입 |
| --- | --- |
| `Challenge Name` | Title |
| `Date` | Date |
| `Check-ins` | Relation |
| `Participant Count` | Rollup |
| `Participants` | Rollup |

`Check-ins`는 `Challenge Check-ins DB`의 `Challenge`와 연결된 실제 양방향 relation이어야 합니다.

### Challenge Check-ins DB

체크인 한 건마다 페이지 한 개를 생성합니다.

| 속성 | 타입 |
| --- | --- |
| `Check-in` | Title |
| `Member` | Relation to Members DB |
| `Challenge` | Relation to Challenges DB |
| `Checked In At` | Date |
| `Check-in Date` | Date |
| `Method` | Select: `QR`, `Manual` |
| `Recorded By` | Rich text |
| `Status` | Select: `Valid`, `Cancelled` |
| `Check-in Key` | Rich text |

중요: `Challenge Check-ins DB`의 `Challenge`와 `Challenges DB`의 `Check-ins`는 서로 따로 만든 relation 두 개가 아니라 하나의 양방향 relation 쌍이어야 합니다.

## 코드가 자동으로 하는 작업

새 DB를 만들 때는 아래 명령을 사용합니다.

```bash
node scripts/create-challenge-checkins-database.mjs
```

이 스크립트는 `Challenge Check-ins DB`를 만들고, `Challenge` relation을 `Challenges DB`에 연결합니다. 이때 reciprocal property 이름을 `Check-ins`로 지정하므로 Notion이 정상 처리하면 Challenges DB에도 `Check-ins` relation이 자동으로 생깁니다.

기존 체크인 생성 API는 더 이상 Challenges DB의 `참여명단` relation 배열을 직접 수정하지 않습니다. 체크인 성공 시 `Challenge Check-ins DB`에 새 페이지를 만들고, 중복 확인은 `Status = Valid`인 같은 `Check-in Key` 기록이 있는지 검색해서 처리합니다.

## Notion에서 직접 해야 하는 작업

### Participant Count Rollup

Challenges DB에서 새 속성을 추가합니다.

```text
Name: Participant Count
Type: Rollup
Relation: Check-ins
Property: Member
Calculate: Count unique values
```

### Participants Rollup

Challenges DB에서 새 속성을 추가합니다.

```text
Name: Participants
Type: Rollup
Relation: Check-ins
Property: Member
Calculate: Show unique values
```

참고: Cancelled 기록까지 relation에는 연결될 수 있습니다. 취소 기록을 제외한 화면은 linked view에서 `Status is Valid` 필터를 쓰는 것이 가장 안전합니다.

### 챌린지 페이지 내부 linked view

각 Challenge 페이지 안에서 해당 챌린지의 체크인 명단을 시간순으로 보려면 Notion에서 직접 linked view를 만듭니다.

1. Challenge 페이지를 엽니다.
2. 본문에서 `/linked` 또는 `/linked view of database`를 입력합니다.
3. `Challenge Check-ins` DB를 선택합니다.
4. 필터를 추가합니다.
5. `Challenge` contains `현재 Challenge 페이지`로 설정합니다.
6. `Status` is `Valid` 필터를 추가합니다.
7. 정렬을 `Checked In At` ascending으로 설정합니다.
8. 보기 이름을 `Valid Check-ins`처럼 바꿉니다.

이렇게 하면 멤버, 체크인 시각, QR/Manual 방식, 처리 관리자, 상태를 챌린지 페이지 안에서 확인할 수 있습니다.

## 잘못된 relation 복구

이미 `Challenge Check-ins DB`의 `Challenge`와 `Challenges DB`의 `Check-ins`를 각각 따로 만든 경우, 먼저 dry-run으로 상태를 확인합니다.

```bash
node scripts/repair-challenge-checkins-relation.mjs
```

자동 복구를 시도하려면 다음 명령을 사용합니다.

```bash
node scripts/repair-challenge-checkins-relation.mjs --write
```

이 스크립트는 기존 페이지나 relation 값을 삭제하지 않습니다. Notion API가 기존 single relation을 dual relation으로 바꾸는 것을 거부하면, 스크립트가 실패 원인을 출력합니다.

정상 판정 기준:

1. `Challenge Check-ins.Challenge`가 Challenges DB를 가리킵니다.
2. `Challenges.Check-ins`가 Challenge Check-ins DB를 가리킵니다.
3. 두 relation이 모두 `dual_property`입니다.
4. 양쪽의 `synced_property_id`가 실제 상대 property ID와 서로 일치합니다.

자동 복구가 실패하면 Notion UI에서 직접 확인합니다.

1. `Challenge Check-ins` DB를 엽니다.
2. `Challenge` 속성 설정을 엽니다.
3. 연결 대상이 `Challenges DB`인지 확인합니다.
4. reciprocal property가 `Check-ins`로 표시되도록 설정합니다.
5. `Challenges DB`를 열고 `Check-ins` relation에 체크인 페이지들이 자동으로 보이는지 확인합니다.
6. 기존에 따로 만든 단방향 `Check-ins` relation은 바로 삭제하지 말고, 새 relation이 정상 동작하는 것을 확인한 뒤 숨기거나 정리합니다.

## 기존 참여명단 Migration

기존 `참여명단` relation은 삭제하거나 변경하지 않습니다. migration은 기존 relation을 읽어서 `Challenge Check-ins DB`에 없는 기록만 추가합니다.

먼저 dry-run으로 예상 생성 건수와 건너뛸 건수를 확인합니다.

```bash
node scripts/migrate-legacy-challenge-checkins.mjs --dry-run
```

아무 옵션 없이 실행해도 dry-run입니다.

```bash
node scripts/migrate-legacy-challenge-checkins.mjs
```

실제 생성은 명시적으로 `--write`를 붙였을 때만 실행합니다.

```bash
node scripts/migrate-legacy-challenge-checkins.mjs --write
```

migration 동작:

1. 모든 Challenge 페이지를 pagination해서 조회합니다.
2. 각 Challenge의 `참여명단` relation property ID를 확인합니다.
3. `pages.properties.retrieve`를 사용해서 relation item을 끝까지 pagination합니다.
4. 기존 `Status = Valid` 체크인의 `Check-in Key`를 pagination해서 모읍니다.
5. 없는 기록만 생성합니다.
6. 같은 migration을 다시 실행해도 같은 `Check-in Key`는 건너뜁니다.
7. 기존 `참여명단` relation은 삭제하거나 비우지 않습니다.

기본 dry-run 출력은 운영 page ID나 `Check-in Key`를 나열하지 않고 집계만 보여줍니다. 세부 대상 목록까지 확인해야 할 때만 `--verbose`를 추가합니다.

```bash
node scripts/migrate-legacy-challenge-checkins.mjs --dry-run --verbose
```

## 필요한 환경변수

```env
NOTION_TOKEN=
NOTION_MEMBERS_DATA_SOURCE_ID=
NOTION_CHECKINS_DATABASE_ID=
NOTION_CHECKINS_DATA_SOURCE_ID=
NOTION_CHALLENGE_CHECKINS_DATABASE_ID=
NOTION_CHALLENGE_CHECKINS_DATA_SOURCE_ID=
```

실제 secret이나 database ID는 GitHub에 커밋하지 말고 `.env.local`과 Vercel 환경변수에만 넣습니다.

## Migration 이후 확인

1. `Challenge Check-ins DB`에 체크인 페이지가 생성됐는지 확인합니다.
2. 각 체크인 페이지의 `Member`, `Challenge`, `Checked In At`, `Check-in Date`, `Method`, `Recorded By`, `Status`, `Check-in Key`가 채워졌는지 확인합니다.
3. Challenges DB에서 해당 Challenge의 `Check-ins` relation에 체크인 페이지가 자동으로 보이는지 확인합니다.
4. `Participant Count`와 `Participants` rollup이 값이 나오는지 확인합니다.
5. 앱의 `/checkins` 화면에서 챌린지를 선택했을 때 같은 기록이 보이는지 확인합니다.

## 제한

- Notion API가 이미 만들어진 단방향 relation을 양방향 relation으로 직접 변환하지 못할 수 있습니다.
- legacy migration의 `Checked In At`은 과거 실제 스캔 시간이 없으므로 해당 날짜의 New York 정오 시간으로 저장합니다. 여름에는 `-04:00`, 겨울에는 `-05:00` offset을 사용합니다.
- 중복 정책은 `Status = Valid`만 막습니다. `Cancelled` 기록만 있으면 다시 체크인할 수 있습니다.
