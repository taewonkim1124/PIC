# Challenge Check-ins 전환 가이드

이 문서는 기존 `Challenges DB`의 `참여명단` relation에 쌓인 기록을 새 `Challenge Check-ins DB` 구조로 전환하는 방법입니다.

## 새 구조

기존:

```text
Challenges DB 한 페이지
└─ 참여명단 relation 배열에 여러 멤버 추가
```

변경 후:

```text
Challenge Check-ins DB
└─ 체크인 한 건마다 페이지 한 개 생성
```

현재 앱은 챌린지를 날짜별 페이지로 찾거나 만듭니다. 즉 같은 챌린지 이름이라도 날짜가 다르면 다른 Challenge 페이지가 됩니다. 그래서 중복 키는 다음 형식을 사용합니다.

```text
memberPageId:challengePageId:YYYY-MM-DD
```

날짜를 포함하는 이유는 나중에 같은 Challenge 페이지를 여러 날짜에 재사용하는 구조로 바뀌어도 중복 체크인 기준이 안전하게 유지되기 때문입니다.

## 필요한 DB 속성

### Challenge Check-ins DB

| 컬럼 이름 | 타입 | 설명 |
| --- | --- | --- |
| `Check-in` | Title | 체크인 기록 제목 |
| `Member` | Relation | Members DB 연결 |
| `Challenge` | Relation | Challenges DB 연결 |
| `Checked In At` | Date | 실제 체크인 시각 |
| `Check-in Date` | Date | America/New_York 기준 날짜 |
| `Method` | Select | `QR`, `Manual` |
| `Recorded By` | Rich text | 처리 관리자 |
| `Status` | Select | `Valid`, `Cancelled` |
| `Check-in Key` | Rich text | 중복 확인 키 |

## Challenges DB Rollup 설정

Challenges DB에서 다음 속성을 직접 추가합니다.

### Check-ins relation

1. Challenges DB를 엽니다.
2. 새 속성 `Check-ins`를 만듭니다.
3. 타입을 `Relation`으로 선택합니다.
4. 대상 데이터베이스를 `Challenge Check-ins`로 선택합니다.
5. Challenge Check-ins DB의 `Challenge` relation과 연결되는 양방향 relation으로 둡니다.

### Participant Count rollup

1. Challenges DB에서 새 속성 `Participant Count`를 만듭니다.
2. 타입을 `Rollup`으로 선택합니다.
3. Relation: `Check-ins`
4. Property: `Member`
5. Calculate: `Count unique values`

### Participants rollup

1. Challenges DB에서 새 속성 `Participants`를 만듭니다.
2. 타입을 `Rollup`으로 선택합니다.
3. Relation: `Check-ins`
4. Property: `Member`
5. Calculate: `Show unique values`

## 챌린지 페이지 내부 linked view 설정

각 Challenge 페이지 안에서 해당 챌린지의 체크인만 보려면 Notion에서 직접 linked view를 만듭니다.

1. Challenge 페이지 하나를 엽니다.
2. 본문에 `/linked` 또는 `/linked view of database`를 입력합니다.
3. `Challenge Check-ins` DB를 선택합니다.
4. 필터를 추가합니다.
5. `Challenge` contains `현재 챌린지 페이지`로 설정합니다.
6. `Status` is `Valid` 필터를 추가합니다.
7. 정렬을 `Checked In At` ascending으로 설정합니다.
8. 보기 이름을 `Valid Check-ins`처럼 지정합니다.

이렇게 하면 각 챌린지 페이지 안에서 멤버, 체크인 시각, 방식, 처리 관리자, 상태를 시간순으로 확인할 수 있습니다.

## 기존 데이터 migration

기존 `참여명단` relation은 자동 삭제하지 않습니다. 먼저 dry-run으로 생성될 기록을 확인합니다.

```bash
node scripts/migrate-legacy-challenge-checkins.mjs
```

문제가 없으면 실제 생성합니다.

```bash
node scripts/migrate-legacy-challenge-checkins.mjs --write
```

주의:

- migration은 기존 Challenges DB의 `참여명단` relation을 읽기만 합니다.
- 기존 `참여명단` relation은 삭제하거나 덮어쓰지 않습니다.
- 이미 같은 `Check-in Key`와 `Status=Valid` 기록이 있으면 건너뜁니다.
- 기존 데이터에는 정확한 개인별 체크인 시간이 없으므로 `Checked In At`은 migration용 임시 시간으로 저장됩니다.
