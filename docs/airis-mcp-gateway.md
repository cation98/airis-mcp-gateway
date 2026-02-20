# airis-mcp-gateway 완전 설치 가이드

airis-mcp-gateway는 60개 이상의 MCP 서버를 단일 SSE 엔드포인트로 통합하는 Docker 기반 MCP 게이트웨이입니다.
`airis-find`, `airis-exec`, `airis-schema` 3개의 메타 도구만 노출하여 토큰 사용량을 ~98% 절감합니다.

---

## 아키텍처

```
Claude Code (모든 프로젝트)
    │
    ▼  SSE  http://localhost:9400/sse
┌─────────────────────────────────────────────┐
│  FastAPI Hybrid MCP Multiplexer (port 9400) │
│                                             │
│  airis-find   ← 서버/도구 검색              │
│  airis-exec   ← 도구 실행 (auto-enable)     │
│  airis-schema ← 도구 입력 스키마 확인       │
│                                             │
│  HOT (항상 실행): gateway-control, airis-commands  │
│  COLD (on-demand): tavily, magic, morphllm, ...    │
└─────────────────────────────────────────────┘
```

---

## 사전 요구사항

- **Docker Desktop** (또는 OrbStack)
- **1Password CLI** (`op`): `brew install 1password-cli`
- **1Password 앱**: Settings → Developer → "Integrate with 1Password CLI" 활성화
- **Claude Code**: 최신 버전

---

## 1단계: 저장소 설치

```bash
git clone https://github.com/agiletec-inc/airis-mcp-gateway ~/airis-mcp-gateway
cd ~/airis-mcp-gateway
cp mcp-config.json.example mcp-config.json  # 없으면 생략
```

---

## 2단계: 1Password Vault 확인

```bash
# 로그인 상태 확인
op whoami

# vault 목록 확인 (vault 이름 확인 필수 — User ID와 혼동 주의)
op vault list
```

API 키 저장 vault: **`Access Keys`**

---

## 3단계: API 키를 1Password에 저장

각 서비스 키를 1Password에 등록합니다. `<실제키값>`을 교체하세요.

```bash
# Tavily
op item create \
  --category="API Credential" \
  --title="Tavily API Key" \
  --vault="Access Keys" \
  "credential=<실제키값>"

# Magic (21st.dev)
op item create \
  --category="API Credential" \
  --title="Magic API Key" \
  --vault="Access Keys" \
  "credential=<실제키값>"

# Morphllm
op item create \
  --category="API Credential" \
  --title="Morphllm API Key" \
  --vault="Access Keys" \
  "credential=<실제키값>"
```

각 명령 실행 후 출력된 **Item ID**를 기록해둡니다.

### 현재 시스템 등록 Item ID (Access Keys vault)

| 서비스 | Item ID | Secret Reference |
|--------|---------|-----------------|
| Tavily API Key | `eg7qt7zy7qu2roup4xmmbv2q5i` | `op://Access Keys/Tavily API Key/credential` |
| Magic API Key | `3z46s5g7pokwhwn62yriiiihyi` | `op://Access Keys/Magic API Key/credential` |
| Morphllm API Key | `5olo7nq74lhxnjtcyhfuxcjmcq` | `op://Access Keys/Morphllm API Key/credential` |

---

## 4단계: .env 파일 구성

`~/airis-mcp-gateway/.env` 파일에 API 키를 주입합니다.

### 4-1. .env 파일에 플레이스홀더 추가

`~/airis-mcp-gateway/.env`의 External API Keys 섹션:

```bash
# External API Keys (필요한 것만 활성화)
# TAVILY_API_KEY=tvly-xxx
# MAGIC_API_KEY=your-key-here
# MORPH_API_KEY=your-key-here
```

### 4-2. 1Password에서 키 주입 (값 노출 없이)

```bash
# Tavily
op item get eg7qt7zy7qu2roup4xmmbv2q5i --fields credential --reveal 2>/dev/null | \
  xargs -I{} sed -i '' 's|# TAVILY_API_KEY=tvly-xxx|TAVILY_API_KEY={}|' ~/airis-mcp-gateway/.env

# Magic
op item get 3z46s5g7pokwhwn62yriiiihyi --fields credential --reveal 2>/dev/null | \
  xargs -I{} sed -i '' 's|# MAGIC_API_KEY=your-key-here|MAGIC_API_KEY={}|' ~/airis-mcp-gateway/.env

# Morphllm
op item get 5olo7nq74lhxnjtcyhfuxcjmcq --fields credential --reveal 2>/dev/null | \
  xargs -I{} sed -i '' 's|# MORPH_API_KEY=your-key-here|MORPH_API_KEY={}|' ~/airis-mcp-gateway/.env
```

### 4-3. 주입 결과 확인

```bash
grep -E "TAVILY|MAGIC|MORPH" ~/airis-mcp-gateway/.env
# 출력: 각 키가 주석 없이 값과 함께 표시되어야 함
```

---

## 5단계: docker-compose.yml 구성

`~/airis-mcp-gateway/docker-compose.yml`의 `api` 서비스에 다음이 설정되어 있어야 합니다.

### 5-1. 환경변수 (environment 섹션)

```yaml
    environment:
      - MCP_GATEWAY_URL=http://gateway:9390
      - MCP_CONFIG_PATH=/app/mcp-config.json
      - DYNAMIC_MCP=${DYNAMIC_MCP:-true}
      # External API keys
      - TAVILY_API_KEY=${TAVILY_API_KEY:-}
      - MAGIC_API_KEY=${MAGIC_API_KEY:-}
      - MORPH_API_KEY=${MORPH_API_KEY:-}
```

### 5-2. 워크스페이스 볼륨 (volumes 섹션)

morphllm이 로컬 코드에 접근하기 위한 IDE 프로젝트 디렉토리 마운트:

```yaml
    volumes:
      - ./mcp-config.json:/app/mcp-config.json:ro
      - ./config/gateway-config.yaml:/app/config/gateway-config.yaml:ro
      - ./profiles:/app/profiles:rw
      - ~/PycharmProjects:/workspaces/pycharm:rw
      - ~/RiderProjects:/workspaces/rider:rw
      - ~/WebstormProjects:/workspaces/webstorm:rw
      - ~/DataGripProjects:/workspaces/datagrip:rw
      - ~/DataspellProjects:/workspaces/dataspell:rw
      - cache-uv:/home/appuser/.cache/uv
      - cache-npm:/home/appuser/.npm
      - memory-data:/app/data
```

> IDE 디렉토리가 없으면 해당 마운트 라인을 제거하거나 실제 존재하는 경로로 교체합니다.

---

## 6단계: mcp-config.json API 키 환경변수 참조 확인

하드코딩된 키가 없어야 합니다. `mcp-config.json`에서 각 서버의 env 섹션:

```json
"tavily": {
  "args": ["...", "https://mcp.tavily.com/mcp/?tavilyApiKey=${TAVILY_API_KEY}"]
},
"magic": {
  "env": { "API_KEY": "${MAGIC_API_KEY}" }
},
"morphllm": {
  "env": {
    "MORPH_API_KEY": "${MORPH_API_KEY}",
    "ENABLED_TOOLS": "edit_file,warpgrep_codebase_search"
  }
}
```

하드코딩된 키가 있다면 `${ENV_VAR_NAME}` 형식으로 교체합니다.

---

## 7단계: 게이트웨이 시작

```bash
cd ~/airis-mcp-gateway
docker compose up -d
```

### 상태 확인

```bash
# 전체 서버 상태
curl http://localhost:9400/process/servers | jq

# 헬스 체크
curl http://localhost:9400/health

# 컨테이너 내 환경변수 확인 (값 마스킹)
docker exec airis-mcp-gateway env | grep -E "TAVILY|MAGIC|MORPH" | sed 's/=.*/=<hidden>/'

# 워크스페이스 마운트 확인
docker exec airis-mcp-gateway ls /workspaces/
```

> **⚠️ 중요**: `docker compose restart`는 `.env` 변경사항을 반영하지 않습니다.
> `.env` 수정 후에는 반드시 `docker compose up -d api`로 컨테이너를 **재생성**해야 합니다.

---

## 8단계: Claude Code 전역 MCP 등록

`~/.claude/mcp.json` 파일에 등록합니다 (모든 프로젝트에서 사용 가능):

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

```bash
# 등록 명령 (파일이 없는 경우)
claude mcp add --scope user --transport sse airis-mcp-gateway http://localhost:9400/sse
```

> **주의**: `~/.mcp.json`은 홈 디렉토리에서만 적용됩니다. 전역 설정은 반드시 `~/.claude/mcp.json`을 사용합니다.

---

## 동작 확인 및 테스트

### 메타 도구 사용 순서

```
1. airis-find  → 서버/도구 검색
2. airis-schema → 도구 입력 스키마 확인 (필요시)
3. airis-exec  → 도구 실행
```

### Tavily 테스트

```
airis-find server="tavily"
→ tavily:search 등 도구 목록 확인

airis-exec tool="tavily:search" arguments={"query": "test"}
```

### Magic 테스트

```
airis-find server="magic"
→ 4개 도구 확인 (component_builder, logo_search, inspiration, refiner)

airis-exec tool="magic:logo_search" arguments={"queries": ["github"], "format": "SVG"}
```

### Morphllm 테스트

```
airis-find server="morphllm"
→ 2개 도구 확인 (edit_file, warpgrep_codebase_search)

airis-exec tool="morphllm:warpgrep_codebase_search" arguments={
  "search_string": "Find Django model definitions",
  "repo_path": "/workspaces/pycharm/MyProject"
}
```

---

## 서버 목록 및 API 키 요약

| 서버 | 용도 | 환경변수 | 발급처 |
|------|------|---------|--------|
| context7 | 공식 문서 조회 | 없음 | — |
| fetch | URL 콘텐츠 가져오기 | 없음 | — |
| memory | 세션 간 메모리 | 없음 | — |
| sequential-thinking | 다단계 추론 | 없음 | — |
| serena | 심볼 기반 코드 탐색 | 없음 | — |
| playwright | 브라우저 자동화 | 없음 | — |
| chrome-devtools | Chrome DevTools 제어 | 없음 | — |
| tavily | 웹 검색 | `TAVILY_API_KEY` | app.tavily.com |
| magic | UI 컴포넌트 생성 | `MAGIC_API_KEY` | 21st.dev |
| morphllm | 코드 변환/검색 | `MORPH_API_KEY` | morphllm.com |
| github | GitHub 관리 | `GITHUB_TOKEN` | github.com/settings/tokens |
| supabase | Supabase 연동 | `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard |
| stripe | Stripe 결제 | `STRIPE_SECRET_KEY` | stripe.com |

---

## morphllm 워크스페이스 경로 참조

morphllm은 컨테이너 내부에서 실행되므로 **호스트 경로를 직접 사용할 수 없습니다**.

| 호스트 경로 | 컨테이너 내부 경로 |
|------------|-----------------|
| `~/PycharmProjects/프로젝트명` | `/workspaces/pycharm/프로젝트명` |
| `~/RiderProjects/프로젝트명` | `/workspaces/rider/프로젝트명` |
| `~/WebstormProjects/프로젝트명` | `/workspaces/webstorm/프로젝트명` |
| `~/DataGripProjects/프로젝트명` | `/workspaces/datagrip/프로젝트명` |
| `~/DataspellProjects/프로젝트명` | `/workspaces/dataspell/프로젝트명` |

---

## Cold 서버 Warm-up

cold 서버는 호출 시 자동으로 초기화되지만, 세션 시작 시 미리 warm-up할 수 있습니다.

```
# 명시적 warm-up
airis-find server="sequential-thinking"
airis-find server="memory"
airis-find server="tavily"
```

`~/.claude/CLAUDE.md`에 세션 시작 시 자동 warm-up 지시를 추가할 수 있습니다.

---

## 자동 시작 설정 (macOS)

시스템 재시작 후 자동으로 게이트웨이가 시작되도록 설정:

```bash
cd ~/airis-mcp-gateway
task autostart:install   # LaunchAgent 등록
task autostart:status    # 등록 상태 확인
```

---

## 문제 해결

```bash
# 로그 확인
docker compose -f ~/airis-mcp-gateway/docker-compose.yml logs api --tail=50

# 특정 서버 관련 에러 필터
docker compose logs api 2>&1 | grep -i "tavily\|magic\|morph"

# 서버 상태 확인
curl http://localhost:9400/process/servers | jq '.[] | {name, status}'

# 컨테이너 재생성 (모든 설정 재적용)
cd ~/airis-mcp-gateway && docker compose up -d api
```

### 주요 오류 패턴

| 오류 | 원인 | 해결 |
|------|------|------|
| `Authentication required` | 환경변수 미적용 | `docker compose up -d api` (restart 아님) |
| `Server not found` | mcp-config.json 오류 | 파일 확인 후 `docker compose restart` |
| `Circuit open` | 서버 반복 크래시 | 로그 확인 후 근본 원인 해결 |
| `ENOENT /workspaces/...` | 볼륨 미마운트 | docker-compose.yml volumes 섹션 확인 |

---

## 관련 파일 위치

| 파일 | 경로 | 역할 |
|------|------|------|
| 서버 설정 | `~/airis-mcp-gateway/mcp-config.json` | MCP 서버 정의, env 변수 참조 |
| 환경변수 | `~/airis-mcp-gateway/.env` | API 키 실제 값 (git 제외) |
| Docker 구성 | `~/airis-mcp-gateway/docker-compose.yml` | 컨테이너, env 주입, 볼륨 마운트 |
| 전역 MCP 등록 | `~/.claude/mcp.json` | Claude Code 전역 MCP 서버 목록 |
| API 키 관리 가이드 | `~/claudedocs/api-key-management.md` | 1Password 연동 상세 |

---

*최종 업데이트: 2026-02-19*
