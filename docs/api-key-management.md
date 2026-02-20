# API Key 관리 가이드

## 개요

Claude Code 및 MCP 서버에서 사용하는 API 키를 안전하게 보관하고 주입하는 방법을 정리합니다.

---

## 보안 원칙

```
❌ 절대 하면 안 되는 것
   - .env 파일을 git commit
   - CLAUDE.md에 직접 키 작성
   - 채팅창에 키 붙여넣기
   - .mcp.json에 하드코딩 후 공유

✅ 권장
   - 1Password Secret Reference 사용
   - 평문 키가 파일에 저장되지 않도록 유지
```

---

## 방법별 비교

```
┌──────────────────────────┬────────────┬───────────────────────────┐
│ 방법                      │ 보안 수준     │ 비고                       │
├──────────────────────────┼────────────┼───────────────────────────┤
│ ~/.zshrc 직접 export      │ 보통         │ 평문 저장, 간편              │
├──────────────────────────┼────────────┼───────────────────────────┤
│ macOS Keychain           │ 높음        │ 평문 미저장                  │
├──────────────────────────┼────────────┼───────────────────────────┤
│ ~/.claude/settings.json  │ 보통        │ Claude Code 전용           │
├──────────────────────────┼────────────┼───────────────────────────┤
│ 1Password CLI (op run)   │ 매우 높음  │ 평문 미저장, 권장               │
└──────────────────────────┴────────────┴───────────────────────────┘
```

---

## MCP 서버별 필요 API 키

```
┌─────────────────────┬──────────────────────────────────┬───────────────────────────┐
│ Server              │ 환경변수명                          │ 발급처                     │
├─────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ tavily              │ TAVILY_API_KEY                   │ app.tavily.com            │
├─────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ github              │ GITHUB_PERSONAL_ACCESS_TOKEN     │ github.com/settings/tokens│
├─────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ magic               │ MAGIC_API_KEY                    │ 21st.dev                  │
├─────────────────────┼──────────────────────────────────┼───────────────────────────┤
│ supabase            │ SUPABASE_URL + SERVICE_ROLE_KEY  │ supabase.com/dashboard    │
└─────────────────────┴──────────────────────────────────┴───────────────────────────┘
```

---

## macOS 설정

### 1Password CLI 설정 (권장)

```bash
# 1Password CLI 설치
brew install 1password-cli

# 1Password 앱과 CLI 연동 활성화
# 1Password 앱 → Settings → Developer → "Integrate with 1Password CLI" 체크

# 연동 확인
op whoami
```

### API 키를 1Password에 저장

vault명은 반드시 `op vault list`로 확인 후 사용 (User ID와 혼동 주의).

```bash
# vault 목록 확인
op vault list

# 저장 (vault명 또는 vault ID 사용)
op item create \
  --category="API Credential" \
  --title="Tavily API Key" \
  --vault="Access Keys" \
  "credential=your_api_key_here"
```

> **주의**: `--vault` 인자에 User ID를 사용하면 오류 발생. vault ID 또는 vault 이름을 사용할 것.

### Known Items (등록된 키 목록)

| 서비스 | 1Password Item ID | Vault | Secret Reference |
|--------|-------------------|-------|------------------|
| Tavily API Key | `eg7qt7zy7qu2roup4xmmbv2q5i` | Access Keys | `op://Access Keys/Tavily API Key/credential` |
| Magic API Key | `3z46s5g7pokwhwn62yriiiihyi` | Access Keys | `op://Access Keys/Magic API Key/credential` |
| Morphllm API Key | `5olo7nq74lhxnjtcyhfuxcjmcq` | Access Keys | `op://Access Keys/Morphllm API Key/credential` |

### Secret Reference 형식

```
op://[Vault Name]/[Item Title]/[Field]

예시:
  op://Access Keys/Tavily API Key/credential
  op://Personal/GitHub Token/password
```

### 방법 1: ~/.zshrc에서 동적 주입

```bash
# ~/.zshrc에 추가
export TAVILY_API_KEY=$(op read "op://Access Keys/Tavily API Key/credential")
```

### 방법 2: op run으로 Claude Code 실행 (최적)

```bash
# ~/.claude/.env 파일 생성 (평문 키 없이 참조 형식으로)
echo 'TAVILY_API_KEY=op://Access Keys/Tavily API Key/credential' > ~/.claude/.env
echo 'GITHUB_TOKEN=op://Personal/GitHub Token/password'         >> ~/.claude/.env

# ~/.zshrc에 alias 등록
echo "alias claude='op run --env-file ~/.claude/.env -- claude'" >> ~/.zshrc
source ~/.zshrc
```

### 방법 3: settings.json에 Secret Reference 등록

`~/.claude/settings.json`:

```json
{
  "env": {
    "TAVILY_API_KEY": "op://Access Keys/Tavily API Key/credential",
    "GITHUB_TOKEN": "op://Personal/GitHub Token/password"
  }
}
```

### 권장 최종 구성 (방법 2 + 방법 3 조합)

```
1. ~/.claude/.env          → op:// 참조 형식으로 키 목록 관리
2. ~/.claude/settings.json → op:// 참조 형식으로 env 등록
3. ~/.zshrc alias          → op run --env-file ~/.claude/.env -- claude
```

### airis-mcp-gateway .env 주입 패턴

airis-mcp-gateway의 `.env`에 직접 주입할 때 (키 값이 터미널에 노출되지 않음):

```bash
# 1. 1Password에서 키를 가져와 .env에 주입
op item get <item-id> --fields credential --reveal 2>/dev/null | \
  xargs -I{} sed -i '' 's|# KEY=placeholder|KEY={}|' ~/airis-mcp-gateway/.env

# 실제 예시 (Tavily)
op item get eg7qt7zy7qu2roup4xmmbv2q5i --fields credential --reveal 2>/dev/null | \
  xargs -I{} sed -i '' 's|# TAVILY_API_KEY=tvly-xxx|TAVILY_API_KEY={}|' ~/airis-mcp-gateway/.env

# 2. 컨테이너 재생성 (★ restart는 .env 변경 미반영 — 반드시 up -d 사용)
cd ~/airis-mcp-gateway && docker compose up -d api

# 3. 적용 확인 (값 마스킹)
docker exec airis-mcp-gateway env | grep TAVILY | sed 's/=.*/=<hidden>/'
```

---

## Windows 11 설정

### 1Password CLI 설치

```powershell
# winget으로 설치 (권장)
winget install AgileBits.1Password.CLI

# 또는 Scoop으로 설치
scoop bucket add extras
scoop install 1password-cli

# 설치 확인
op --version
```

1Password 앱 연동:
```
1Password 앱 → Settings → Developer
→ "Integrate with 1Password CLI" 체크
```

### PowerShell Profile 설정

Windows에서 `~/.zshrc` 역할은 PowerShell Profile이 담당합니다.

```powershell
# Profile 파일 위치 확인
echo $PROFILE

# Profile 파일 열기 (없으면 자동 생성)
notepad $PROFILE
```

Profile에 추가:
```powershell
# 1Password에서 키 동적 주입
$env:TAVILY_API_KEY = $(op read "op://Access Keys/Tavily API Key/credential")
```

### op run 방식 (권장)

```powershell
# ~/.claude/.env 파일 생성
New-Item -Path "$HOME\.claude" -ItemType Directory -Force
@"
TAVILY_API_KEY=op://Access Keys/Tavily API Key/credential
GITHUB_TOKEN=op://Personal/GitHub Token/password
"@ | Out-File -FilePath "$HOME\.claude\.env" -Encoding utf8
```

PowerShell Profile에 추가:
```powershell
function claude-op {
    op run --env-file "$HOME\.claude\.env" -- claude $args
}
Set-Alias claude claude-op
```

### WSL2 환경인 경우

Claude Code를 WSL2에서 사용한다면 macOS와 동일하게 설정합니다:

```bash
# WSL2 내부에서 1Password CLI 설치
curl -sS https://downloads.1password.com/linux/keys/1password.asc | \
  sudo gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] \
  https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | \
  sudo tee /etc/apt/sources.list.d/1password.list

sudo apt update && sudo apt install 1password-cli

# ~/.zshrc에 추가 (macOS와 동일)
echo "alias claude='op run --env-file ~/.claude/.env -- claude'" >> ~/.zshrc
source ~/.zshrc
```

---

## macOS vs Windows 11 비교

```
┌─────────────────────┬──────────────────────┬────────────────────────────┐
│ 항목                 │ macOS                │ Windows 11                 │
├─────────────────────┼──────────────────────┼────────────────────────────┤
│ CLI 설치             │ brew install         │ winget install             │
├─────────────────────┼──────────────────────┼────────────────────────────┤
│ Shell 설정 파일       │ ~/.zshrc             │ $PROFILE (PowerShell)      │
├─────────────────────┼──────────────────────┼────────────────────────────┤
│ alias 등록           │ alias claude='...'   │ Set-Alias / function       │
├─────────────────────┼──────────────────────┼────────────────────────────┤
│ .env 파일 위치        │ ~/.claude/.env       │ %USERPROFILE%\.claude\.env │
├─────────────────────┼──────────────────────┼────────────────────────────┤
│ Secret Reference    │ op:// 형식 동일        │ op:// 형식 동일               │
└─────────────────────┴──────────────────────┴────────────────────────────┘
```

> Windows에서 Claude Code를 사용한다면 **WSL2** 환경이 macOS와 동일하게
> 설정되어 가장 안정적입니다.

---

- 생성일: 2026-02-19
