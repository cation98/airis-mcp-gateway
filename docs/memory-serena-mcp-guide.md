# Memory MCP & Serena MCP & mindbase 사용 가이드

airis-mcp-gateway에 포함된 메모리 관련 MCP 서버들의 개념 비교와 실제 사용법 안내.

---

## 목차

1. [세 가지 메모리 레이어 개요](#개요)
2. [Memory MCP — 지식 그래프](#memory-mcp)
3. [Serena MCP — 코드 의미 지도 + 프로젝트 메모](#serena-mcp)
4. [mindbase — Semantic Vector Search](#mindbase)
5. [Knowledge Graph vs Semantic Search 비교](#knowledge-graph-vs-semantic-search)
6. [언제 무엇을 쓸까](#선택-기준)
7. [크로스-머신 공유](#크로스-머신-공유)
   - [Mac Studio 초기 설정](#memory-mcp-syncthing-공유-설정-추천)
   - [다른 머신 추가 설정 (Mac)](#mac-새-mac에서-설정)
   - [Windows 11 완전한 WSL2 설정](#windows-11-완전한-wsl2-설정-method-b)
   - [인터넷 원격 연결](#인터넷을-통한-원격-머신-연결)
   - [충돌 대응](#충돌-발생-시-대응)
8. [실전 워크플로우](#실전-워크플로우)

---

## 개요

airis-mcp-gateway 안에서 "기억"을 담당하는 MCP 서버는 세 가지이며, GitHub을 포함하면 네 가지 레이어입니다.

| 레이어 | 도구 | 저장 방식 | 검색 방식 | 저장 위치 |
|--------|------|-----------|-----------|-----------|
| **Memory MCP** | `memory:*` | Knowledge Graph (entity/relation) | 키워드/노드 탐색 | `memory-data` Docker volume |
| **mindbase** | `mindbase:*` | 텍스트 + vector embedding | **semantic 유사도 검색** | Supabase Cloud (pgvector) + 로컬 `.md` 파일 |
| **Serena MCP** | `serena:write_memory` 등 | 프로젝트별 markdown 파일 | 파일명 기반 조회 | `.serena/memories/*.md` (프로젝트 내) |
| **GitHub Commit** | git | 코드 변경 diff | git log/blame | git object store (영구) |

> **핵심 구분**
> - Memory MCP = "Claude가 무엇을 알고 있는가" (구조화된 지식)
> - mindbase = "Claude가 무엇을 알고 있는가" (자연어 검색 가능)
> - Serena MCP = "코드가 어떻게 연결되어 있는가"
> - GitHub = "코드가 어떻게 변해왔는가"

---

## Memory MCP

### 구조

knowledge graph 방식으로 **entity(노드)** + **relation(관계)** + **observation(사실)** 세 요소로 구성됩니다.

```
entity: "airis-mcp-gateway"
  └─ observation: "Docker 기반, port 9400"
  └─ observation: "memory-data 볼륨에 영속 저장"

entity: "Memory MCP"
  └─ observation: "knowledge graph 방식"

relation: "airis-mcp-gateway" --contains--> "Memory MCP"
```

### 도구 목록

| 도구 | 역할 |
|------|------|
| `memory:create_entities` | 노드 생성 |
| `memory:create_relations` | 노드 간 관계 설정 |
| `memory:add_observations` | 기존 노드에 사실 추가 |
| `memory:search_nodes` | 검색 |
| `memory:read_graph` | 전체 그래프 조회 |
| `memory:open_nodes` | 특정 노드 조회 |
| `memory:delete_entities` | 노드 삭제 |
| `memory:delete_observations` | 특정 사실 삭제 |
| `memory:delete_relations` | 관계 삭제 |

### 실제 사용 예시

**엔티티 생성**
```
airis-exec tool="memory:create_entities" arguments={
  "entities": [
    {
      "name": "o-guard",
      "entityType": "project",
      "observations": [
        "Windows 보안 에이전트 프로젝트",
        "C# .NET 기반",
        "FlaUI E2E 테스트 사용"
      ]
    }
  ]
}
```

**관계 설정**
```
airis-exec tool="memory:create_relations" arguments={
  "relations": [
    {
      "from": "o-guard",
      "to": "Parallels VM",
      "relationType": "runs-on"
    }
  ]
}
```

**검색**
```
airis-exec tool="memory:search_nodes" arguments={"query": "o-guard"}
airis-exec tool="memory:read_graph" arguments={}
```

### 데이터 영속성

`docker-compose.yml`의 `memory-data` named volume에 저장됩니다.
컨테이너를 재시작해도 데이터가 유지되며, `docker compose down -v` 실행 시 삭제됩니다.

---

## Serena MCP

### 두 가지 역할

Serena는 단순 메모리 서버가 아닙니다. **코드 탐색**과 **프로젝트 메모** 두 가지 역할을 합니다.

```
Serena MCP
├─ 코드 탐색 (LSP 기반)
│   ├─ 심볼 검색/참조 추적
│   ├─ 심볼 rename / body 교체
│   └─ 파일 구조 탐색
│
└─ 프로젝트 메모리
    ├─ write_memory / read_memory
    ├─ list_memories / edit_memory
    └─ 프로젝트별 markdown 파일로 저장
```

### 도구 목록

**프로젝트 관리**

| 도구 | 역할 |
|------|------|
| `serena:activate_project` | 작업할 프로젝트 전환 |
| `serena:get_current_config` | 현재 설정 확인 |
| `serena:check_onboarding_performed` | 온보딩 여부 확인 |
| `serena:onboarding` | 프로젝트 최초 등록 |
| `serena:open_dashboard` | 웹 대시보드 열기 |

**코드 탐색**

| 도구 | 역할 |
|------|------|
| `serena:list_dir` | 디렉토리 구조 조회 |
| `serena:find_file` | 파일 검색 |
| `serena:search_for_pattern` | 패턴 기반 코드 검색 |
| `serena:get_symbols_overview` | 파일의 심볼 전체 개요 |
| `serena:find_symbol` | 특정 심볼 위치 찾기 |
| `serena:find_referencing_symbols` | 심볼을 참조하는 모든 곳 찾기 |

**코드 편집 (심볼 기반)**

| 도구 | 역할 |
|------|------|
| `serena:rename_symbol` | 전체 코드베이스에서 심볼 rename |
| `serena:replace_symbol_body` | 심볼 body 교체 |
| `serena:insert_after_symbol` | 심볼 뒤에 내용 삽입 |
| `serena:insert_before_symbol` | 심볼 앞에 내용 삽입 |

**프로젝트 메모리**

| 도구 | 역할 |
|------|------|
| `serena:write_memory` | 코드 맥락 메모 저장 |
| `serena:read_memory` | 메모 읽기 |
| `serena:list_memories` | 저장된 메모 목록 |
| `serena:edit_memory` | 메모 수정 (regex 기반) |
| `serena:delete_memory` | 메모 삭제 |

### 등록된 프로젝트 목록 (2026-02-19 기준)

```
OCEAN
cds
it-asset-management
o-guard          ← 현재 active
o-guard-api-server
o-guard-web
safety-management-system
```

### 프로젝트 시작 순서

```
# 1. 현재 설정 확인
airis-exec tool="serena:get_current_config" arguments={}

# 2. 프로젝트 전환
airis-exec tool="serena:activate_project" arguments={"project": "o-guard-web"}

# 3. 온보딩 여부 확인 (처음 쓰는 프로젝트)
airis-exec tool="serena:check_onboarding_performed" arguments={}

# 4. 온보딩 실행 (false인 경우)
airis-exec tool="serena:onboarding" arguments={}
```

### 코드 탐색 예시

```
# 파일 구조 파악
airis-exec tool="serena:list_dir" arguments={"path": ".", "recursive": false}

# 심볼 개요 확인
airis-exec tool="serena:get_symbols_overview" arguments={"path": "src/auth.ts"}

# 특정 함수 위치 찾기
airis-exec tool="serena:find_symbol" arguments={"name": "getUserData"}

# 이 함수를 참조하는 모든 곳
airis-exec tool="serena:find_referencing_symbols" arguments={"name_path": "getUserData"}

# 전체 코드베이스에서 rename
airis-exec tool="serena:rename_symbol" arguments={
  "name_path": "getUserData",
  "new_name": "fetchUserData"
}
```

### 프로젝트 메모 예시

```
# 중요 결정사항 저장
airis-exec tool="serena:write_memory" arguments={
  "name": "auth-decisions",
  "content": "JWT 방식 채택. refresh token은 Redis에 저장. 만료 15분."
}

# 메모 목록
airis-exec tool="serena:list_memories" arguments={}

# 메모 읽기
airis-exec tool="serena:read_memory" arguments={"name": "auth-decisions"}
```

---

## mindbase

### 개요

mindbase는 airis-mcp-gateway에 포함된 MCP 서버입니다. Memory MCP와 별도로 존재하며, **pgvector 기반 semantic search**가 핵심입니다. Memory MCP를 공유하는 수단이 아니라, Memory MCP의 **대안**입니다.

### 아키텍처

```
mindbase MCP 서버 (ghcr.io/agiletec-inc/mindbase-mcp:latest)
    │
    ├─ DB: Supabase Cloud (pgvector v0.8.0)
    │      └─ Pooler: aws-1-ap-southeast-2.pooler.supabase.com:5432
    │      └─ 크로스-머신 자동 동기화 (외부 DB이므로)
    │
    ├─ Markdown 파일: 로컬 bind mount
    │      └─ ~/airis-mcp-gateway/data/mindbase-memories/
    │      └─ memory_list 시 사용 (파일 기반)
    │
    └─ Embedding: 로컬 Ollama (host.docker.internal:11434)
           └─ 모델: nomic-embed-text (768 dimensions)
```

> mindbase는 ephemeral Docker 컨테이너로 실행됩니다. 도구 호출마다 새 컨테이너가 생성되고 종료됩니다.
> - `memory_write`: DB + 로컬 `.md` 파일 양쪽에 저장
> - `memory_read`: 로컬 `.md` → DB fallback
> - `memory_list`: 로컬 `.md` 파일만 조회 (DB fallback 없음)
> - `memory_search`: DB semantic search (기본 threshold 0.7, 넓은 검색 시 0.3~0.5 권장)

### 도구 목록

| 도구 | 역할 |
|------|------|
| `mindbase:memory_write` | 텍스트 메모 저장 (자동으로 vector embedding 생성) |
| `mindbase:memory_read` | 이름으로 메모 읽기 |
| `mindbase:memory_list` | 저장된 메모 목록 |
| `mindbase:memory_search` | **semantic 유사도 검색** (핵심 기능) |
| `mindbase:memory_delete` | 메모 삭제 |

### 실제 사용 예시

```
# 메모 저장 (텍스트만 쓰면 됨, 구조 설계 불필요)
airis-exec tool="mindbase:memory_write" arguments={
  "name": "o-guard-auth-decision",
  "content": "o-guard 프로젝트에서 JWT 인증 방식을 사용하기로 결정했다. refresh token은 Redis에 저장."
}

# semantic 검색 — 저장한 단어와 다른 표현으로도 검색 가능
airis-exec tool="mindbase:memory_search" arguments={"query": "보안 관련 결정사항"}
# → "JWT 인증"이 "보안"과 의미적으로 유사하므로 찾아줌

# 목록 조회
airis-exec tool="mindbase:memory_list" arguments={}
```

### Warm-up

mindbase는 Docker MCP Gateway(`airis-mcp-gateway-core`)가 관리하는 cold 서버입니다.

```
airis-find server="mindbase"
```

> mindbase가 동작하려면 **로컬 Ollama**에 `nomic-embed-text` 모델이 필요합니다.
> ```bash
> ollama pull nomic-embed-text
> ```

---

## Knowledge Graph vs Semantic Search

Memory MCP(knowledge graph)와 mindbase(semantic search)는 **같은 "기억"을 저장하지만 검색 방식이 근본적으로 다릅니다.**

### 비유

| | Knowledge Graph (Memory MCP) | Semantic Search (mindbase) |
|---|---|---|
| **비유** | 도서관 분류 카드 시스템 | Google 검색 |
| **검색 원리** | 노드 이름 매칭 + 관계 순회 | 질문을 벡터로 변환 → 가장 가까운 벡터 찾기 |
| **저장 방식** | entity/relation/observation 구조 설계 필요 | 텍스트만 쓰면 자동 처리 |

### 같은 데이터, 다른 검색 결과

저장된 정보:
```
"o-guard 프로젝트에서 JWT 인증 방식을 사용하기로 결정했다"
"o-guard는 Parallels VM 위에서 실행된다"
"o-guard는 FlaUI로 E2E 테스트를 수행한다"
"safety-management-system은 Session 기반 인증을 사용한다"
```

**질문 1: "o-guard에 연결된 모든 기술 스택을 보여줘"**

| Knowledge Graph | Semantic Search |
|---|---|
| entity `o-guard`의 relation을 전부 순회 | "o-guard 기술 스택"과 유사한 텍스트 검색 |
| → JWT, Parallels VM, FlaUI **전부 확실히** 나옴 | → JWT, Parallels는 나오지만 FlaUI는 **빠질 수 있음** |
| **승자: Knowledge Graph** — 관계가 명시되어 있으므로 누락 없음 | |

**질문 2: "보안 관련해서 결정한 게 뭐였지?"**

| Knowledge Graph | Semantic Search |
|---|---|
| "보안"이라는 단어로 검색 | "보안 관련 결정" 의미와 유사한 것 검색 |
| → "JWT 인증"에 "보안"이란 단어가 없어서 **못 찾을 수 있음** | → "JWT 인증" + "Session 인증" 둘 다 **찾음** |
| | **승자: Semantic Search** — 단어가 달라도 의미로 매칭 |

**질문 3: "o-guard와 safety-management-system의 공통점은?"**

| Knowledge Graph | Semantic Search |
|---|---|
| 두 entity의 relation/observation을 가져와서 **교집합 비교** 가능 | "두 프로젝트 공통점" 검색 → **구조적 비교 불가** |
| → "둘 다 인증 관련 결정이 있다" 도출 가능 | |
| **승자: Knowledge Graph** — 명시적 구조가 비교를 가능하게 함 | |

### 내부 동작 비교

```
Knowledge Graph (memory)
┌──────────────────────────────────────┐
│  [o-guard] ──uses──→ [JWT]           │   ← 관계가 명시적으로 저장됨
│      │                               │
│      ├──runs-on──→ [Parallels VM]    │
│      │                               │
│      └──tests-with→ [FlaUI]         │
└──────────────────────────────────────┘
검색: 노드를 따라가며 관계를 추적
강점: "A와 연결된 모든 것" = 누락 없이 100% 정확
약점: entity/relation 구조를 미리 설계해야 함


Semantic Search (mindbase)
┌──────────────────────────────────────────────────┐
│ "o-guard에서 JWT 인증 사용"    → [0.82, 0.15, ...] │  ← 텍스트가
│ "Parallels VM에서 실행"        → [0.31, 0.67, ...] │     벡터(숫자 배열)로
│ "FlaUI로 E2E 테스트"          → [0.45, 0.22, ...] │     자동 변환됨
│ "SMS는 Session 인증 사용"     → [0.79, 0.18, ...] │
└──────────────────────────────────────────────────┘
검색: 질문도 벡터로 변환 → 코사인 유사도로 가장 가까운 벡터 찾기
강점: "보안 관련 뭐였지?" → 단어가 달라도 의미로 찾음
약점: 관계 추적 불가, 결과 누락 가능
```

### 상황별 유리한 검색 방식

| 질문 유형 | 유리한 쪽 | 이유 |
|-----------|-----------|------|
| "X와 관련된 **모든 것** 보여줘" | **Knowledge Graph** | relation 순회로 누락 없음 |
| "X → Y → Z 연결고리 따라가줘" | **Knowledge Graph** | 그래프 탐색 가능 |
| "뭐라고 했었는데... 기억이 가물가물" | **Semantic Search** | 모호한 질문도 의미 매칭 |
| "인증 관련은 프로젝트 상관없이 전부" | **Semantic Search** | JWT, Session, OAuth 등 다른 단어도 "인증"으로 묶임 |
| 저장 편의성 | **Semantic Search** | 텍스트만 쓰면 됨 (구조 설계 불필요) |
| 데이터 완전성 / 정확도 | **Knowledge Graph** | 명시적 구조라 빠짐 없음 |

### 실사용 관점 정리

- **Knowledge Graph** = Claude가 매번 entity/relation/observation을 정확하게 분류해서 저장해야 함. 구조가 잘 잡히면 강력하지만, 분류 실수 시 못 찾음.
- **Semantic Search** = 텍스트만 쓰면 끝. 나중에 "보안", "인증", "토큰" 등 어떤 표현으로 검색해도 의미가 비슷하면 찾아줌. 대신 "X에 연결된 모든 것을 빠짐없이" 보장은 못 함.

> 프로젝트 진행 상황이나 결정 사항을 기억하는 용도라면, **mindbase(semantic search)가 더 실용적**입니다. 저장 부담이 적고, "뭐였더라..."라는 모호한 검색에 강합니다.

---

## 선택 기준

| 상황 | 도구 |
|------|------|
| 프로젝트 간 관계/의존성 구조화 | **Memory MCP** `create_entities` + `create_relations` |
| "A와 연결된 모든 것" 빠짐없이 조회 | **Memory MCP** `open_nodes` (graph traversal) |
| 결정사항/진행상황 자유롭게 기록 | **mindbase** `memory_write` |
| "보안 관련 뭐였더라..." 모호한 검색 | **mindbase** `memory_search` (semantic) |
| 특정 프로젝트의 코드 맥락 메모 | **Serena** `write_memory` |
| 특정 함수가 어디서 호출되는지 파악 | **Serena** `find_referencing_symbols` |
| 함수/클래스 이름 전체 변경 | **Serena** `rename_symbol` |
| 팀원과 변경사항 공유 | **GitHub commit** |
| 특정 시점 코드로 롤백 | **GitHub** |

### 세 MCP 메모리 비교

| | Memory MCP | mindbase | Serena `write_memory` |
|---|---|---|---|
| **형식** | 구조화된 그래프 (entity/relation) | 자유형 텍스트 + vector | 자유형 markdown 파일 |
| **범위** | 전체 지식 베이스 | 전체 지식 베이스 | 활성화된 프로젝트 범위 |
| **검색** | 키워드/노드명 매칭 | **semantic 유사도** | 파일명 기반 조회 |
| **저장 편의** | 낮음 (구조 설계 필요) | **높음** (텍스트만 쓰면 됨) | 높음 (텍스트만 쓰면 됨) |
| **관계 추적** | **가능** (graph traversal) | 불가 | 불가 |
| **적합한 용도** | 프로젝트 간 관계, 구조적 지식 | 결정사항, 진행상황, 모호한 검색 | 특정 프로젝트의 코드 맥락 메모 |

---

## 크로스-머신 공유

### 데이터 범위: 머신 전체 vs 프로젝트별

Memory MCP와 mindbase는 **프로젝트 단위로 분리되지 않습니다.** 한 머신에서 Claude가 저장한 모든 데이터가 하나의 저장소에 섞입니다.

| | Memory MCP | mindbase | Serena |
|---|---|---|---|
| **데이터 범위** | **머신 전체** (1개 JSON 파일) | **머신 전체** (1개 DB) | **프로젝트별** 분리 |
| **저장 구조** | 모든 entity/relation이 한 파일에 혼재 | 모든 메모가 한 DB 테이블에 혼재 | `.serena/memories/`가 프로젝트마다 독립 |
| **git 공유 시** | 전체 프로젝트 데이터 통째로 | 전체 데이터 통째로 | **해당 프로젝트 메모만** 선택적 공유 |

```
Memory MCP bind mount 시 공유되는 범위:

~/airis-mcp-gateway/data/memory/memory.json  ← 이 파일 하나
  ├─ o-guard 관련 entity
  ├─ safety-management-system 관련 entity
  ├─ 개인 메모, 기타 모든 것
  └─ 전부 한 파일에 혼재 → git push 시 모두 공유됨

Serena 메모는 프로젝트별 분리:

~/RiderProjects/o-guard-winapp/.serena/memories/    ← o-guard만
~/PycharmProjects/OCEAN/.serena/memories/            ← OCEAN만
  → 각 프로젝트 repo에 해당 메모만 커밋 가능
```

> **프로젝트 단위 공유가 목적이라면 Serena `write_memory`가 가장 자연스럽습니다.**
>
> Memory MCP나 mindbase에서 프로젝트별 분리가 필요하면, 저장 시 prefix 규약을 직접 정해야 합니다:
> ```
> # 예: entity 이름에 프로젝트명 prefix
> memory:create_entities → name: "oguard:auth-decision"
> mindbase:memory_write  → name: "oguard:auth-decision"
> ```
> 이는 구조적 분리가 아닌 **규약에 의한 분리**이므로, 실수로 prefix 없이 저장하면 섞입니다.

### 각 MCP의 공유 가능 여부

| MCP | 기본 상태 | 공유 방법 |
|-----|-----------|-----------|
| **Memory MCP** | Docker named volume → 공유 불가 | bind mount + **Syncthing** (추천) |
| **mindbase** | ~~Docker named volume~~ → **Supabase Cloud 적용 완료** | `DATABASE_URL`을 Supabase pooler로 설정 → **크로스-머신 자동 공유** |
| **Serena** | 프로젝트 내 `.serena/memories/` 파일 | **그냥 git push 하면 됨** (별도 작업 불필요) |

### Memory MCP 공유 방안 비교

`@modelcontextprotocol/server-memory`는 `MEMORY_FILE_PATH` 환경변수로 저장 경로를 변경할 수 있습니다.
서버를 바꾸는 것이 아니라 **파일 위치만 공유 가능한 경로로 변경**하면 knowledge graph가 그대로 유지됩니다.

| 방법 | 플랫폼 | 동시 쓰기 안전 | 인프라 | 비용 |
|------|--------|---------------|--------|------|
| **Syncthing (추천)** | Mac + Windows + Linux | 충돌 감지 (유실 없음) | 없음 (P2P) | 무료 |
| SMB 네트워크 드라이브 | Mac + Windows | OS 잠금 (최강) | 서버/NAS 필요 | 서버 비용 |
| rclone + Cloudflare R2 | Mac + Windows | 없음 (유실 가능) | Cloudflare 계정 | 무료 |
| iCloud Drive | Mac 전용 | 없음 | 없음 | 무료 |
| Git 동기화 | 전체 | merge 가능 | GitHub 계정 | 무료 |

> **주의**: `server-memory`는 쓸 때마다 **파일 전체를 덮어쓰기**(`writeFileSync`)합니다.
> 잠금이나 충돌 감지가 없어서, 두 팀원이 동시에 쓰면 한쪽 데이터가 조용히 사라집니다.
> Syncthing은 이 상황에서 **충돌 파일을 보존**하므로 데이터 유실을 방지합니다.

---

### Memory MCP Syncthing 공유 설정 (추천)

#### 전제 조건

- macOS: Homebrew 설치됨
- Windows 11 WSL2: Docker Engine + Syncthing + Ollama (모두 WSL2 내부 설치)
- airis-mcp-gateway가 Docker Compose로 실행 중

#### Step 1: Named Volume → Bind Mount 전환

`~/airis-mcp-gateway/docker-compose.yml`의 api 서비스 volumes에서:

```yaml
# 변경 전 (named volume — 호스트 접근 불가)
volumes:
  - memory-data:/app/data

# 변경 후 (bind mount — Syncthing 동기화 가능)
volumes:
  - ./data/memory:/app/data              # Knowledge graph persistence (bind mount for Syncthing sync)
```

volumes 선언부에서도 제거:
```yaml
volumes:
  # memory-data: removed — now using bind mount (./data/memory) for Syncthing sync
```

호스트 디렉토리 생성 후 컨테이너 재생성:
```bash
mkdir -p ~/airis-mcp-gateway/data/memory
cd ~/airis-mcp-gateway && docker compose up -d api
```

동작 확인:
```bash
# 컨테이너 → 호스트 파일 동기화 확인
docker exec airis-mcp-gateway touch /app/data/.test
ls ~/airis-mcp-gateway/data/memory/.test   # 파일이 보이면 성공
docker exec airis-mcp-gateway rm /app/data/.test
```

#### Step 2: Syncthing 설치

**macOS**:
```bash
brew install syncthing
brew services start syncthing
# Web UI: http://localhost:8384
```

**Windows**:
1. [SyncTrayzor](https://github.com/canton7/SyncTrayzor/releases) 다운로드 후 설치 (시스템 트레이 앱)
2. 또는 [Syncthing 공식 바이너리](https://syncthing.net/downloads/) 다운로드 후 수동 실행
3. Web UI: http://localhost:8384

#### Step 3: 공유 폴더 등록

**macOS (CLI)**:
```bash
# 폴더 등록
syncthing cli config folders add \
  --id mcp-memory \
  --path ~/airis-mcp-gateway/data/memory \
  --label "MCP Memory (Knowledge Graph)"

# 파일 버전 관리 활성화 (충돌 시 10개 버전 보관)
API_KEY=$(sed -n 's/.*<apikey>\(.*\)<\/apikey>.*/\1/p' \
  ~/Library/Application\ Support/Syncthing/config.xml)

curl -s -X PATCH \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  "http://localhost:8384/rest/config/folders/mcp-memory" \
  -d '{"versioning":{"type":"simple","params":{"keep":"10"},"cleanupIntervalS":86400}}'
```

**Windows (Web UI)**:
1. http://localhost:8384 접속
2. "Add Folder" 클릭
3. Folder ID: `mcp-memory`
4. Folder Path: `C:\Users\<name>\mcp-memory`
5. File Versioning → Simple → Keep 10 Versions

#### Step 4: 디바이스 간 연결

각 머신에서 Device ID를 확인합니다:

```bash
# macOS
syncthing cli show system | python3 -c "import sys,json; print(json.load(sys.stdin)['myID'])"

# Windows (Web UI)
# Actions → Show ID
```

**상대 디바이스 추가** (양쪽 모두 수행):

Web UI(`http://localhost:8384`) → Remote Devices → Add Remote Device:
1. Device ID: 상대방의 ID 입력
2. Device Name: 알아볼 수 있는 이름 (예: "Mac-Office", "Win-Home")
3. Share Folders → "mcp-memory" 체크
4. Save

상대방 머신에서 "New Device" 알림이 뜨면 **Accept** 클릭.

#### Step 5: 동기화 확인

Web UI에서:
- **Remote Devices**: "Connected" 상태
- **Folders > mcp-memory**: "Up to Date" 상태

파일 동기화 테스트:
```
# 머신 A에서
airis-exec tool="memory:create_entities" arguments={
  "entities": [{"name":"sync-test","entityType":"test","observations":["동기화 테스트"]}]
}

# 머신 B에서 (수초 후)
cat ~/mcp-memory/memory.json   # (Windows: type C:\Users\<name>\mcp-memory\memory.json)
# → "sync-test" entity가 보이면 성공

# 테스트 데이터 삭제
airis-exec tool="memory:delete_entities" arguments={"entityNames":["sync-test"]}
```

---

### 인터넷을 통한 원격 머신 연결

Syncthing은 **별도 설정 없이 인터넷을 통한 원격 동기화를 지원**합니다.

기본 설정에서 이미 활성화된 기능:

| 기능 | 기본값 | 설명 |
|------|--------|------|
| **Global Discovery** | `True` | 인터넷 상의 Syncthing 디스커버리 서버로 디바이스 위치 등록/검색 |
| **Relay Servers** | `True` | NAT/방화벽 뒤에 있어도 릴레이 서버를 경유해 연결 |
| **NAT Traversal** | `True` | STUN/홀펀칭으로 직접 연결 시도 |
| **Local Discovery** | `True` | 같은 LAN이면 자동 발견 (추가 속도) |

```
연결 흐름:

같은 네트워크 (LAN):
  머신 A ←── Local Discovery ──→ 머신 B
  (직접 연결, 최고 속도)

다른 네트워크 (인터넷):
  머신 A ←── Global Discovery ──→ Syncthing 릴레이 서버 ←──→ 머신 B
  (NAT 홀펀칭 성공 시 직접 연결로 승격)

회사 방화벽 뒤:
  머신 A ←── HTTPS 릴레이 (443) ──→ 릴레이 서버 ←──→ 머신 B
  (대부분의 방화벽 통과 가능)
```

#### 연결 속도 최적화 (선택사항)

기본 릴레이 연결은 동작하지만 속도가 제한될 수 있습니다.
직접 연결(direct connection)을 원하면 **한쪽 머신**에서 포트 포워딩을 설정합니다:

```
라우터에서:
  외부 포트 22000 (TCP) → 내부 IP:22000
  외부 포트 22000 (UDP) → 내부 IP:22000
```

포트 포워딩 없이도 연결은 가능합니다 — 릴레이 서버가 자동으로 중계합니다.

#### 보안 고려사항

- Syncthing은 **TLS 1.3**으로 모든 통신을 암호화합니다
- Device ID는 X.509 인증서 기반 — 승인한 디바이스만 연결 가능
- 릴레이 서버는 암호화된 데이터를 중계할 뿐, 내용을 볼 수 없음
- 디스커버리 서버에는 IP 주소와 Device ID만 등록됨 (파일 내용 노출 없음)

#### 인터넷 연결 문제 해결

```bash
# 연결 상태 확인 (macOS)
API_KEY=$(sed -n 's/.*<apikey>\(.*\)<\/apikey>.*/\1/p' \
  ~/Library/Application\ Support/Syncthing/config.xml)

# 디바이스 연결 상태
curl -s -H "X-API-Key: $API_KEY" "http://localhost:8384/rest/system/connections" | python3 -m json.tool

# 연결 안 되면 확인할 사항:
# 1. 양쪽 Syncthing 실행 중인가?
# 2. Device ID를 정확히 입력했는가?
# 3. 양쪽에서 서로를 Remote Device로 추가했는가?
# 4. 폴더를 상대에게 공유했는가?
# 5. 방화벽이 Syncthing을 차단하는가? (TCP/UDP 22000, TCP 443)
```

---

### 다른 머신에서 Syncthing 설정 (Mac / Windows 11)

기존 Mac Studio에 Syncthing이 설정된 상태에서, 새 머신을 추가하는 절차입니다.

#### 사전 정보 확인

Mac Studio의 Device ID를 1Password에서 조회합니다:
```bash
op item get p5kwqsjou4fejs4r46bqvyokca --fields "Device ID"
# → F4SKNSE-HIXLCLH-7JX4LQV-HUDARIL-XCFTZEP-X5KPLUQ-4KYOI3K-OYNWYQO
```

---

#### [Mac] 새 Mac에서 설정

**1. airis-mcp-gateway 설치 및 bind mount 설정**

airis-mcp-gateway가 아직 없다면 먼저 설치합니다 (별도 가이드: `~/claudedocs/airis-mcp-gateway.md`).

기존에 설치되어 있다면 docker-compose.yml에서 bind mount로 변경:
```yaml
# api service volumes
volumes:
  - ./data/memory:/app/data    # bind mount (Syncthing sync)
```

```bash
mkdir -p ~/airis-mcp-gateway/data/memory
cd ~/airis-mcp-gateway && docker compose up -d api
```

**2. Syncthing 설치 및 시작**

```bash
brew install syncthing
brew services start syncthing
```

설치 확인:
```bash
syncthing --version
# Web UI: http://localhost:8384
```

**3. mcp-memory 폴더 등록**

```bash
# 폴더 등록
syncthing cli config folders add \
  --id mcp-memory \
  --path ~/airis-mcp-gateway/data/memory \
  --label "MCP Memory (Knowledge Graph)"

# API 키 조회 (REST API 호출용)
API_KEY=$(sed -n 's/.*<apikey>\(.*\)<\/apikey>.*/\1/p' \
  ~/Library/Application\ Support/Syncthing/config.xml)

# Simple File Versioning 활성화 (10개 버전 보관)
curl -s -X PATCH \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  "http://localhost:8384/rest/config/folders/mcp-memory" \
  -d '{"versioning":{"type":"simple","params":{"keep":"10"},"cleanupIntervalS":86400}}'
```

**4. Mac Studio 디바이스 추가**

```bash
# 이 Mac의 Device ID 확인 (Mac Studio 쪽에 입력할 때 필요)
syncthing cli show system | python3 -c "import sys,json; print(json.load(sys.stdin)['myID'])"
```

Web UI(`http://localhost:8384`) → Remote Devices → Add Remote Device:
1. Device ID: `F4SKNSE-HIXLCLH-7JX4LQV-HUDARIL-XCFTZEP-X5KPLUQ-4KYOI3K-OYNWYQO` (Mac Studio)
2. Device Name: `Mac-Studio` (식별용)
3. Share Folders → `mcp-memory` 체크
4. Save

**5. Mac Studio에서 승인**

Mac Studio Web UI(`http://localhost:8384`)에 "New Device" 알림이 뜹니다:
1. **Accept** 클릭
2. Share Folders → `mcp-memory` 체크
3. Save

> 또는 Mac Studio에서 CLI로 추가:
> ```bash
> # Mac Studio에서 실행 — <NEW_MAC_DEVICE_ID>를 새 Mac의 ID로 교체
> syncthing cli config devices add --device-id <NEW_MAC_DEVICE_ID>
> syncthing cli config folders mcp-memory devices add --device-id <NEW_MAC_DEVICE_ID>
> ```

**6. 동기화 확인**

```bash
# 연결 상태 확인
curl -s -H "X-API-Key: $API_KEY" "http://localhost:8384/rest/system/connections" \
  | python3 -c "import sys,json; [print(f'{k[:7]}... → {v[\"connected\"]}') for k,v in json.load(sys.stdin)['connections'].items()]"

# 파일 확인
ls ~/airis-mcp-gateway/data/memory/
# → memory.json이 Mac Studio에서 동기화되어 보이면 성공
```

---

#### [Windows 11] 완전한 WSL2 설정

Mac Studio의 airis-mcp-gateway + Memory MCP + Syncthing 스택을 Windows 11 WSL2에 복제하는 전체 절차입니다.
Docker Engine, Ollama, Syncthing 모두 WSL2 내부에 설치하므로 Windows 호스트에는 1Password Desktop만 필요합니다.

```
Windows 11 Host
├── 1Password Desktop App → agent socket to WSL2
│
└── WSL2 (Ubuntu)
    ├── Docker Engine (apt install)
    ├── Ollama → localhost:11434
    ├── Syncthing → localhost:8384
    ├── Claude Code CLI
    ├── 1Password CLI (op)
    ├── ~/airis-mcp-gateway/
    │   └── docker-compose.yml
    │       └── memory volume: ./data/memory:/app/data
    └── ~/.claude/mcp.json → http://localhost:9400/sse
```

---

##### Phase 1: Windows 호스트 + WSL2 사전 설치

Windows 호스트에는 1Password Desktop만 설치하고, 나머지는 모두 WSL2 내부에 설치합니다.

**1-1. 1Password Desktop + CLI 연동 (Windows 호스트)**

1. [1Password Desktop](https://1password.com/downloads) 설치 (Windows)
2. 1Password app → Settings → Developer → **"Integrate with 1Password CLI"** ✓
3. 같은 화면에서 **"Connect with 1Password CLI"** → WSL2 agent socket 자동 구성

> 이 설정이 활성화되면 WSL2 안에서 `op` CLI가 Windows 1Password의 인증을 공유합니다.

**1-2. Docker Engine (WSL2 내부)**

Docker Desktop 없이 WSL2 Ubuntu에 직접 Docker Engine을 설치합니다.

```bash
# WSL2 Ubuntu에서 실행
# Docker 공식 GPG 키 및 리포지토리 추가
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 현재 사용자를 docker 그룹에 추가 (sudo 없이 docker 사용)
sudo usermod -aG docker $USER
newgrp docker
```

**1-3. Ollama (WSL2 내부)**

```bash
# WSL2에서 실행
curl -fsSL https://ollama.com/install.sh | sh

# embedding 모델 다운로드 (mindbase 필수)
ollama pull nomic-embed-text
```

> mindbase는 작업 진행상태 메모리(semantic search)에 사용됩니다. pgvector DB를 Supabase 등 외부로 전환해도 embedding은 **각 머신의 로컬 Ollama**에서 수행되므로 Ollama 설치가 필수입니다.

**1-4. Syncthing (WSL2 내부)**

```bash
# WSL2에서 실행
sudo apt-get install syncthing
```

---

##### Phase 2: WSL2 환경 구성

WSL2 Ubuntu 터미널에서 실행합니다.

**2-1. 1Password CLI 설치**

→ `skill.md` Step 1 [WSL2] 절차를 따릅니다 (`~/.claude/skills/airis-mcp-gateway-setup/skill.md`).

```bash
curl -sS https://downloads.1password.com/linux/keys/1password.asc | \
  sudo gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] \
  https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | \
  sudo tee /etc/apt/sources.list.d/1password.list

sudo apt update && sudo apt install 1password-cli
```

**2-2. Claude Code CLI 설치**

```bash
# Node.js가 없다면 먼저 설치
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Claude Code 설치
npm install -g @anthropic-ai/claude-code
```

**2-3. 검증**

```bash
op whoami          # 1Password 연동 확인 (Windows 앱에서 인증 팝업)
docker ps          # Docker Engine 확인
claude --version   # Claude Code CLI 확인
ollama list        # Ollama 확인 (nomic-embed-text 모델 표시)
```

> `op whoami` 실행 시 Windows 1Password 앱에서 인증 팝업이 표시됩니다. 승인하면 연동 완료.

---

##### Phase 3: airis-mcp-gateway 설치 및 구성

**3-1. 레포지토리 클론**

→ `skill.md` Step 2 절차를 따릅니다.

```bash
git clone https://github.com/agiletec-inc/airis-mcp-gateway ~/airis-mcp-gateway
cd ~/airis-mcp-gateway
cp mcp-config.json.example mcp-config.json
```

**3-2. API 키 .env 주입**

→ `skill.md` Steps 3-4 [WSL2] 절차를 따릅니다.

1Password에 이미 API 키가 저장되어 있다면 주입만 수행:
```bash
# WSL2에서 실행 (GNU sed — '' 없이 -i 사용)
op item get eg7qt7zy7qu2roup4xmmbv2q5i --fields credential --reveal 2>/dev/null | \
  xargs -I{} sed -i 's|# TAVILY_API_KEY=tvly-xxx|TAVILY_API_KEY={}|' ~/airis-mcp-gateway/.env

op item get 3z46s5g7pokwhwn62yriiiihyi --fields credential --reveal 2>/dev/null | \
  xargs -I{} sed -i 's|# MAGIC_API_KEY=your-key-here|MAGIC_API_KEY={}|' ~/airis-mcp-gateway/.env

op item get 5olo7nq74lhxnjtcyhfuxcjmcq --fields credential --reveal 2>/dev/null | \
  xargs -I{} sed -i 's|# MORPH_API_KEY=your-key-here|MORPH_API_KEY={}|' ~/airis-mcp-gateway/.env

# 확인
grep -E "TAVILY|MAGIC|MORPH" ~/airis-mcp-gateway/.env
# → 각 키가 # 없이 표시되어야 함
```

> 새 시스템에서 1Password에 API 키가 아직 없다면 `skill.md` Step 3을 먼저 수행하세요.

**3-3. docker-compose.yml 수정 (핵심 변경사항)**

`~/airis-mcp-gateway/docker-compose.yml`의 `api` 서비스에서 다음을 변경합니다:

```yaml
services:
  api:
    volumes:
      # Memory MCP bind mount (Syncthing 동기화용)
      - ./data/memory:/app/data

      # Workspace volumes — WSL2 네이티브 경로 사용
      - ~/projects:/workspaces/projects:rw
```

> 모든 것이 WSL2 내부이므로 `/mnt/c/` 경로를 사용할 필요가 없습니다.
> WSL2 네이티브 파일시스템에서 직접 작업하면 I/O 성능이 가장 좋습니다.

volumes 선언부에서 `memory-data` named volume 제거:
```yaml
volumes:
  # memory-data: removed — now using bind mount for Syncthing sync
```

**3-4. 컨테이너 시작 및 검증**

→ `skill.md` Step 7 절차를 따릅니다.

```bash
cd ~/airis-mcp-gateway && docker compose up -d

# 검증
curl http://localhost:9400/health
curl http://localhost:9400/process/servers | jq
docker exec airis-mcp-gateway env | grep -E "TAVILY|MAGIC|MORPH" | sed 's/=.*/=<hidden>/'
docker exec airis-mcp-gateway ls /workspaces/
```

**3-5. Claude Code 글로벌 등록**

→ `skill.md` Step 8 절차를 따릅니다.

```bash
claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse
```

또는 `~/.claude/mcp.json` 직접 편집:
```json
{
  "mcpServers": {
    "airis-mcp-gateway": {
      "type": "sse",
      "url": "http://localhost:9400/sse"
    }
  }
}
```

**3-6. 자동 시작 설정**

→ `skill.md` Step 9 [WSL2] 절차를 따릅니다.

WSL2에서 systemd가 활성화된 경우:
```bash
# /etc/wsl.conf에 [boot] systemd=true 가 있는지 확인
cat /etc/wsl.conf

# airis-mcp-gateway 자동 시작
cd ~/airis-mcp-gateway && task autostart:install

# Syncthing 자동 시작
systemctl --user enable syncthing
systemctl --user start syncthing

# Ollama는 설치 시 자동으로 systemd 등록됨
systemctl status ollama
```

systemd가 없다면 `.bashrc`에 추가:
```bash
echo '# Auto-start services
if ! pgrep -x "ollama" > /dev/null; then ollama serve &>/dev/null & fi
if ! pgrep -x "syncthing" > /dev/null; then syncthing serve --no-browser &>/dev/null & fi
if ! docker ps &>/dev/null; then sudo service docker start; fi
cd ~/airis-mcp-gateway && docker compose up -d &>/dev/null' >> ~/.bashrc
```

---

##### Phase 4: Syncthing 연동 (Memory MCP 공유)

**4-1. mcp-memory 폴더 등록 (WSL2 CLI)**

```bash
# WSL2에서 실행 — Syncthing이 실행 중이어야 합니다
# API 키 확인
API_KEY=$(sed -n 's/.*<apikey>\(.*\)<\/apikey>.*/\1/p' ~/.local/state/syncthing/config.xml)

# mcp-memory 폴더 등록
syncthing cli config folders add \
  --id mcp-memory \
  --path ~/airis-mcp-gateway/data/memory \
  --label "MCP Memory (Knowledge Graph)"

# File Versioning 설정
syncthing cli config folders mcp-memory versioning set \
  --type simple --cleanup-interval-s 3600
syncthing cli config folders mcp-memory versioning params set \
  --key keep --value 10
```

> Folder ID는 Mac Studio와 반드시 동일해야 합니다 (`mcp-memory`).

**4-2. Mac Studio 디바이스 추가**

Mac Studio의 Device ID를 1Password에서 조회:
```bash
# WSL2에서
op item get p5kwqsjou4fejs4r46bqvyokca --fields "Device ID"
# → F4SKNSE-HIXLCLH-7JX4LQV-HUDARIL-XCFTZEP-X5KPLUQ-4KYOI3K-OYNWYQO
```

CLI로 디바이스 추가:
```bash
MAC_DEVICE_ID=$(op item get p5kwqsjou4fejs4r46bqvyokca --fields "Device ID")

# Mac Studio 디바이스 추가
syncthing cli config devices add --device-id "$MAC_DEVICE_ID" --name "Mac-Studio"

# mcp-memory 폴더에 Mac Studio 공유
syncthing cli config folders mcp-memory devices add --device-id "$MAC_DEVICE_ID"
```

**4-3. Mac Studio에서 승인**

Mac Studio Web UI(`http://localhost:8384`)에 "New Device" 알림 표시:
1. **Accept** 클릭
2. Share Folders → `mcp-memory` 체크
3. Save

또는 Mac Studio에서 CLI로 추가:
```bash
# Mac Studio에서 실행 — <WIN_DEVICE_ID>를 Windows WSL2의 ID로 교체
syncthing cli config devices add --device-id <WIN_DEVICE_ID>
syncthing cli config folders mcp-memory devices add --device-id <WIN_DEVICE_ID>
```

**4-4. WSL2의 Device ID를 1Password에 저장**

```bash
# WSL2에서 Device ID 확인
syncthing cli show system | jq -r '.myID'

# 1Password에 새 항목 생성
op item create --category="API Credential" --title="Syncthing - Windows WSL2" \
  --vault="Access Keys" "Device ID=<WSL2_DEVICE_ID>"
```

---

##### Phase 5: 전체 검증

**5-1. 서비스 상태 확인**

```bash
# WSL2에서
curl -s http://localhost:9400/health | jq
curl -s http://localhost:9400/ready  | jq
```

**5-2. Memory MCP 동기화 테스트**

```bash
# Windows(WSL2)에서 테스트 entity 생성
# Claude Code 세션에서:
airis-exec tool="memory:create_entities" arguments={
  "entities": [{"name":"win-sync-test","entityType":"test","observations":["Windows sync test"]}]
}
```

Mac Studio에서 확인 (수초 후):
```bash
grep "win-sync-test" ~/airis-mcp-gateway/data/memory/memory.json
# → 결과가 보이면 동기화 성공
```

**5-3. Syncthing 연결 상태 확인**

```bash
# WSL2에서
syncthing cli show connections | jq
# → Mac-Studio 디바이스가 "connected": true 로 표시

# 또는 Web UI로 확인: http://localhost:8384
# Remote Devices → Mac-Studio: Connected (녹색)
# Folders → MCP Memory: Up to Date
```

**5-4. 테스트 데이터 정리**

```
airis-exec tool="memory:delete_entities" arguments={"entityNames":["win-sync-test"]}
```

**5-5. MCP 도구 기능 테스트**

```
# airis-mcp-gateway meta-tools
airis-find server="memory"
airis-find server="mindbase"
airis-find server="tavily"

# mindbase (Ollama 연동 확인)
airis-exec tool="mindbase:memory_write" arguments={
  "name": "win-test-memo",
  "content": "Windows WSL2 setup complete"
}
airis-exec tool="mindbase:memory_search" arguments={"query": "setup complete"}
airis-exec tool="mindbase:memory_delete" arguments={"name": "win-test-memo"}
```

---

##### Troubleshooting (WSL2 관련)

| 증상 | 원인 | 해결 |
|------|------|------|
| `op whoami` 실패 | 1Password Desktop에서 CLI 연동 미활성화 | 1Password → Settings → Developer → "Integrate with 1Password CLI" ✓ |
| `docker: permission denied` | 사용자가 docker 그룹에 없음 | `sudo usermod -aG docker $USER && newgrp docker` |
| `sed -i` 후 `.env` 변경 안 됨 | BSD sed 문법 사용 (`sed -i ''`) | WSL2는 GNU sed — `''` 제거: `sed -i 's|...|...|'` |
| `docker compose up -d` 후 키 미반영 | `docker compose restart` 사용 | 반드시 `docker compose up -d` 사용 (컨테이너 재생성) |
| Syncthing에서 mcp-memory가 "Unshared" | 폴더 경로 또는 ID 불일치 | Folder ID가 양쪽 모두 `mcp-memory`인지 확인 |
| Syncthing config.xml 위치 모름 | WSL2와 macOS 경로 다름 | WSL2: `~/.local/state/syncthing/config.xml` |
| Ollama `systemctl status` 실패 | systemd 미활성화 | `/etc/wsl.conf`에 `[boot] systemd=true` 추가 후 `wsl --shutdown` |
| mindbase 검색 결과 없음 | nomic-embed-text 모델 미설치 | `ollama pull nomic-embed-text` 실행 |
| Memory 파일 동기화 안 됨 | Syncthing 미연결 또는 폴더 미공유 | `syncthing cli show connections` 또는 Web UI에서 상태 확인 |

##### 참조 문서

| 문서 | 경로 | 내용 |
|------|------|------|
| airis-mcp-gateway 설치 skill | `~/.claude/skills/airis-mcp-gateway-setup/skill.md` | 전체 설치 절차 (macOS/WSL2 공통) |
| airis-mcp-gateway 상세 가이드 | `~/claudedocs/airis-mcp-gateway.md` | MCP 서버 목록, warm-up, 전역 등록 |
| API 키 관리 가이드 | `~/claudedocs/api-key-management.md` | 1Password 연동, Known Items |
| Syncthing - Mac Studio ID | 1Password: `p5kwqsjou4fejs4r46bqvyokca` | Device ID 조회 |

---

#### 3대 이상 머신 연결 시

Syncthing은 **메시 네트워크**로 동작합니다. N대의 머신을 연결할 때:

```
머신 A ←→ 머신 B
  ↕          ↕
머신 C ←→ 머신 D
```

모든 머신 쌍이 서로 연결될 필요는 없지만, **모든 머신에서 동일한 Folder ID(`mcp-memory`)를 사용**해야 합니다.

**추가 머신 등록 순서:**
1. 새 머신에 Syncthing 설치
2. mcp-memory 폴더 등록 (Folder ID: `mcp-memory`)
3. **기존 머신 중 최소 1대**의 Device ID를 추가
4. 기존 머신에서 새 머신을 Accept + mcp-memory 공유
5. Syncthing이 자동으로 나머지 머신들과도 동기화

> 팀원별 Device ID를 1Password의 "Syncthing - [머신이름]" 항목으로 관리하면 편리합니다.

#### 플랫폼별 Syncthing 설정 파일 위치

| 항목 | macOS | Windows 11 WSL2 |
|------|-------|-----------------|
| **설정 파일** | `~/Library/Application Support/Syncthing/config.xml` | `~/.local/state/syncthing/config.xml` |
| **API 키 위치** | config.xml 내 `<apikey>` 태그 | config.xml 내 `<apikey>` 태그 |
| **로그** | `brew services info syncthing` | `journalctl --user -u syncthing` |
| **자동 시작** | `brew services start syncthing` | `systemctl --user enable syncthing` |
| **Web UI** | `http://localhost:8384` | `http://localhost:8384` |
| **데이터 포트** | TCP/UDP 22000 | TCP/UDP 22000 |

---

### 충돌 발생 시 대응

두 머신이 동시에 `memory:create_entities` 등을 실행하면:

```
~/airis-mcp-gateway/data/memory/
  ├─ memory.json                                          ← 최종 승자
  └─ memory.json.sync-conflict-20260220-143022-F4SKNSE    ← 패배한 버전 (보존됨)
```

충돌 확인 및 병합:
```bash
# 충돌 파일 확인
ls ~/airis-mcp-gateway/data/memory/*.sync-conflict* 2>/dev/null

# 있으면: 두 파일을 비교하여 수동 병합 후 conflict 파일 삭제
# memory.json은 JSONL 형식 (라인 기반)이라 diff로 비교 가능
diff memory.json memory.json.sync-conflict-*
```

> Simple File Versioning이 활성화되어 있으므로, `.stversions/` 디렉토리에 최근 10개 버전이 보관됩니다. 실수로 잘못 병합해도 이전 버전으로 복구할 수 있습니다.

---

### mindbase 외부 DB 전환

`~/airis-mcp-gateway/catalogs/airis-catalog.yaml`의 mindbase env에서:
```yaml
# 변경 전 (로컬 Docker PostgreSQL)
DATABASE_URL: postgresql://mindbase:mindbase@mindbase-postgres-dev:5432/mindbase

# 변경 후 (외부 PostgreSQL — Supabase, Neon 등)
DATABASE_URL: postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres
```

> mindbase의 외부 DB 전환 시, 모든 머신에 **Ollama + nomic-embed-text** 모델이 필요합니다.
> ```bash
> ollama pull nomic-embed-text
> ```

### Serena 메모리 git 공유

Serena 메모리는 이미 프로젝트 폴더 안에 있으므로 별도 설정이 필요 없습니다:
```bash
# .gitignore에서 제외되어 있는지 확인
grep ".serena" .gitignore
# 출력이 없으면 이미 git 추적 대상

# 커밋
git add .serena/memories/
git commit -m "chore: add serena project memories"
```

---

## 실전 워크플로우

### 세션 시작 패턴

```
# 1. Memory에서 이전 컨텍스트 복원
airis-exec tool="memory:search_nodes" arguments={"query": "현재 작업 프로젝트명"}

# 2. Serena 프로젝트 활성화
airis-exec tool="serena:activate_project" arguments={"project": "o-guard-web"}

# 3. Serena 메모 확인
airis-exec tool="serena:list_memories" arguments={}
```

### 세션 종료 패턴

```
# 1. 오늘 작업한 내용을 Memory에 저장
airis-exec tool="memory:add_observations" arguments={
  "observations": [
    {
      "entityName": "o-guard-web",
      "contents": ["로그인 폼 컴포넌트 구현 완료, 토큰 저장 방식 미결정"]
    }
  ]
}

# 2. 코드 맥락 메모는 Serena에 저장
airis-exec tool="serena:write_memory" arguments={
  "name": "login-status",
  "content": "LoginForm.tsx 구현 완료. AuthContext 연동 미완료. 다음 세션에 이어서."
}
```

### 대규모 리팩터링 패턴

```
# 1. 영향 범위 먼저 파악
airis-exec tool="serena:find_referencing_symbols" arguments={"name_path": "UserModel"}

# 2. 심볼 개요로 구조 파악
airis-exec tool="serena:get_symbols_overview" arguments={"path": "src/models/UserModel.ts"}

# 3. 결정사항 메모
airis-exec tool="serena:write_memory" arguments={
  "name": "refactor-usermodel",
  "content": "UserModel → User 로 rename 결정. 참조 파일 12개 확인."
}

# 4. 전체 rename 실행
airis-exec tool="serena:rename_symbol" arguments={
  "name_path": "UserModel",
  "new_name": "User"
}
```

---

## Warm-up

세 서버 모두 cold 서버입니다. 세션 시작 시 한 번 호출하면 활성화됩니다.

```
airis-find server="memory"
airis-find server="serena"
airis-find server="mindbase"
```

자동 warm-up이 필요하면 `~/.claude/CLAUDE.md`에 세션 시작 지시를 추가합니다.

---

## 관련 문서

| 문서 | 경로 |
|------|------|
| airis-mcp-gateway 설치 가이드 | `~/claudedocs/airis-mcp-gateway.md` |
| API 키 관리 가이드 | `~/claudedocs/api-key-management.md` |

---

*최종 업데이트: 2026-02-20 (Windows 11 WSL2 완전한 설정 가이드 추가)*
