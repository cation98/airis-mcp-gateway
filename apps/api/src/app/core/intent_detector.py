"""
Intent Detection Module for AIRIS MCP Gateway.

Detects user intent from natural language and maps to capabilities.
Uses rule-based pattern matching with optional LLM fallback.
"""
import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Capability(str, Enum):
    """The 7 canonical capabilities."""
    SEARCH = "search"
    SUMMARIZE = "summarize"
    RETRIEVE = "retrieve"
    PLAN = "plan"
    EDIT = "edit"
    EXECUTE = "execute"
    RECORD = "record"


@dataclass
class IntentResult:
    """Result of intent detection."""
    intent: str
    capability: Capability
    confidence: float
    implementation_hint: Optional[str] = None
    metadata: Optional[dict] = None


# Pattern definitions: (regex_pattern, intent_name, capability, impl_hint, base_confidence)
INTENT_PATTERNS: list[tuple[str, str, Capability, Optional[str], float]] = [
    # Search intents
    (r"\b(search|find|look up|google|lookup)\b.*\b(web|online|internet)\b",
     "web_search", Capability.SEARCH, "tavily", 0.95),
    (r"\b(latest|current|recent|今の|最新)\b",
     "web_search", Capability.SEARCH, "tavily", 0.85),
    (r"\b(how (do|to|can) (i|we|you) use|documentation|docs|api reference|公式)\b",
     "library_docs", Capability.SEARCH, "context7", 0.92),
    (r"\b(best practice|ベストプラクティス|推奨)\b",
     "library_docs", Capability.SEARCH, "context7", 0.88),
    (r"\bhttps?://\S+\b",
     "fetch_url", Capability.SEARCH, "fetch", 0.95),

    # Summarize intents
    (r"\b(security|vulnerability|脆弱性|セキュリティ|owasp)\b.*\b(check|audit|review|scan)\b",
     "security_analysis", Capability.SUMMARIZE, "sequential-thinking", 0.93),
    (r"\b(explain|説明|what does|どういう意味|how does this work)\b",
     "code_explanation", Capability.SUMMARIZE, None, 0.88),
    (r"\b(analyze|分析|assess|evaluate|評価)\b",
     "analysis", Capability.SUMMARIZE, "sequential-thinking", 0.85),
    (r"\b(compare|比較|difference|違い)\b",
     "comparison", Capability.SUMMARIZE, "sequential-thinking", 0.87),
    (r"\b(summarize|要約|まとめ|summary)\b",
     "summarization", Capability.SUMMARIZE, None, 0.90),

    # Retrieve intents
    (r"\b(what did we|前回|previous session|last time|覚えてる)\b",
     "recall_knowledge", Capability.RETRIEVE, "mindbase", 0.92),
    (r"\b(recall|思い出|remember when|以前の)\b",
     "recall_knowledge", Capability.RETRIEVE, "mindbase", 0.88),
    (r"\b(what was|何だっけ|どうだった)\b",
     "recall_knowledge", Capability.RETRIEVE, "mindbase", 0.82),

    # Plan intents
    (r"\b(plan|計画|roadmap|ロードマップ)\b",
     "task_planning", Capability.PLAN, "airis-agent", 0.90),
    (r"\b(break down|分解|decompose|ステップ)\b",
     "task_decomposition", Capability.PLAN, "airis-agent", 0.88),
    (r"\b(how should (i|we)|どうやって実装|implementation strategy)\b",
     "implementation_planning", Capability.PLAN, "airis-agent", 0.87),
    (r"\b(design|設計|architect|アーキテクチャ)\b",
     "design_planning", Capability.PLAN, "airis-agent", 0.85),
    (r"\b(pdca|confidence check|自信度)\b",
     "pdca_cycle", Capability.PLAN, "airis-agent", 0.95),

    # Edit intents
    (r"\b(refactor|リファクタ|restructure|再構成)\b",
     "code_refactoring", Capability.EDIT, "serena", 0.92),
    (r"\b(rename|リネーム|名前変更)\b.*\b(across|全体|project|プロジェクト)\b",
     "semantic_rename", Capability.EDIT, "serena", 0.93),
    (r"\b(fix|修正|correct|直して)\b",
     "code_fix", Capability.EDIT, None, 0.80),
    (r"\b(implement|実装|add|追加|create|作成)\b.*\b(feature|機能|function|関数)\b",
     "implementation", Capability.EDIT, None, 0.82),
    (r"\b(update|更新|modify|変更|change)\b",
     "code_modification", Capability.EDIT, None, 0.75),

    # Execute intents
    (r"\b(run|実行|execute|走らせて)\b",
     "run_command", Capability.EXECUTE, None, 0.88),
    (r"\b(build|ビルド|compile|コンパイル)\b",
     "build_execute", Capability.EXECUTE, None, 0.90),
    (r"\b(test|テスト)\b",
     "test_execute", Capability.EXECUTE, None, 0.88),
    (r"\b(deploy|デプロイ)\b",
     "deploy_execute", Capability.EXECUTE, None, 0.85),
    (r"\b(install|インストール)\b",
     "install_execute", Capability.EXECUTE, None, 0.87),

    # Record intents
    (r"\b(remember|覚えて|save|保存|store|記録)\b.*\b(this|これ|that|pattern|パターン)\b",
     "store_knowledge", Capability.RECORD, "mindbase", 0.92),
    (r"\b(note|メモ|record|記録)\b",
     "note_taking", Capability.RECORD, "mindbase", 0.85),
    (r"\b(learn|学習|教訓)\b.*\b(from|this)\b",
     "learning_capture", Capability.RECORD, "mindbase", 0.88),
]


class IntentDetector:
    """
    Rule-based intent detector with pattern matching.

    Fast and deterministic - no LLM calls needed for most cases.
    """

    def __init__(self, patterns: list = None):
        self.patterns = patterns or INTENT_PATTERNS
        self._compiled = [(re.compile(p, re.IGNORECASE), i, c, h, conf)
                          for p, i, c, h, conf in self.patterns]

    def detect(self, query: str) -> IntentResult:
        """
        Detect intent from query string.

        Returns the highest confidence match.
        """
        best_match: Optional[IntentResult] = None
        best_confidence = 0.0

        for pattern, intent, capability, hint, base_conf in self._compiled:
            match = pattern.search(query)
            if match:
                # Boost confidence based on match quality
                match_ratio = len(match.group()) / len(query)
                confidence = min(base_conf + (match_ratio * 0.1), 1.0)

                if confidence > best_confidence:
                    best_confidence = confidence
                    best_match = IntentResult(
                        intent=intent,
                        capability=capability,
                        confidence=confidence,
                        implementation_hint=hint,
                        metadata={"matched_text": match.group()}
                    )

        # Fallback to plan capability with low confidence
        if best_match is None:
            return IntentResult(
                intent="unknown",
                capability=Capability.PLAN,
                confidence=0.3,
                implementation_hint="airis-agent",
                metadata={"fallback": True}
            )

        return best_match

    def detect_all(self, query: str) -> list[IntentResult]:
        """
        Detect all matching intents, sorted by confidence.

        Useful for showing alternatives to the user.
        """
        results = []

        for pattern, intent, capability, hint, base_conf in self._compiled:
            match = pattern.search(query)
            if match:
                match_ratio = len(match.group()) / len(query)
                confidence = min(base_conf + (match_ratio * 0.1), 1.0)
                results.append(IntentResult(
                    intent=intent,
                    capability=capability,
                    confidence=confidence,
                    implementation_hint=hint,
                    metadata={"matched_text": match.group()}
                ))

        return sorted(results, key=lambda x: x.confidence, reverse=True)


# Singleton instance
_detector: Optional[IntentDetector] = None


def get_intent_detector() -> IntentDetector:
    """Get or create the intent detector singleton."""
    global _detector
    if _detector is None:
        _detector = IntentDetector()
    return _detector


def detect_intent(query: str) -> IntentResult:
    """Convenience function to detect intent from query."""
    return get_intent_detector().detect(query)
