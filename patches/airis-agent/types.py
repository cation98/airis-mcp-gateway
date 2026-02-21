"""Types for the AIRIS Orchestrator."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


# Cost rates per 1K tokens (in USD)
# Based on Anthropic pricing as of 2024
COST_RATES: dict[str, dict[str, float]] = {
    "claude-opus-4-5": {"input": 0.015, "output": 0.075},
    "claude-sonnet-4": {"input": 0.003, "output": 0.015},
    "claude-3-opus": {"input": 0.015, "output": 0.075},
    "claude-3-sonnet": {"input": 0.003, "output": 0.015},
    "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
    "default": {"input": 0.003, "output": 0.015},
}


class Intent(Enum):
    """7 core intents supported by AIRIS."""
    SEARCH_DOCS = "search.docs"    # Documentation search (context7 > fetch)
    SEARCH_WEB = "search.web"      # Web search (tavily > fetch)
    SUMMARIZE = "summarize"        # Content summarization
    RETRIEVE = "retrieve"          # Memory retrieval (mindbase)
    PLAN = "plan"                  # DAG planning
    EDIT = "edit"                  # Code editing (serena)
    EXECUTE = "execute"            # Step execution
    RECORD = "record"              # Memory recording (mindbase)


class StepStatus(Enum):
    """Status of a plan step."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class Policy:
    """Execution policy constraints."""
    time_budget_ms: int = 90000        # 90 seconds default
    token_budget: int = 30000          # Token limit
    confidence_floor: float = 0.90     # Minimum confidence to proceed
    max_retries: int = 3               # Max retry attempts
    cost_ceiling: float = 1.0          # Cost limit in USD


@dataclass
class Step:
    """A single step in an execution plan."""
    id: str
    intent: Intent
    args: dict[str, Any]
    deps: list[str] = field(default_factory=list)  # Step IDs this depends on
    success_criteria: str = ""
    estimated_tokens: int = 0
    estimated_ms: int = 0
    status: StepStatus = StepStatus.PENDING
    result: Optional[dict[str, Any]] = None
    confidence: float = 0.0
    retries: int = 0


@dataclass
class Plan:
    """Execution plan with DAG of steps."""
    id: str
    goal: str
    steps: list[Step]
    context: dict[str, Any] = field(default_factory=dict)

    def next_ready(self) -> Optional[Step]:
        """Get next step ready for execution (all deps completed)."""
        for step in self.steps:
            if step.status == StepStatus.PENDING and self._are_deps_completed(step):
                return step
        return None

    def get_all_ready(self) -> list[Step]:
        """
        Get ALL steps ready for parallel execution.

        Returns all steps whose dependencies are completed,
        enabling concurrent execution of independent steps.
        """
        return [
            step for step in self.steps
            if step.status == StepStatus.PENDING and self._are_deps_completed(step)
        ]

    def _are_deps_completed(self, step: Step) -> bool:
        """Check if all dependencies of a step are completed."""
        return all(
            self._get_step(dep_id).status == StepStatus.COMPLETED
            for dep_id in step.deps
            if self._get_step(dep_id)
        )

    def _get_step(self, step_id: str) -> Optional[Step]:
        """Get step by ID."""
        for step in self.steps:
            if step.id == step_id:
                return step
        return None

    def is_complete(self) -> bool:
        """Check if all steps are completed or failed."""
        return all(
            s.status in (StepStatus.COMPLETED, StepStatus.FAILED, StepStatus.SKIPPED)
            for s in self.steps
        )

    def overall_confidence(self) -> float:
        """Calculate overall plan confidence."""
        completed = [s for s in self.steps if s.status == StepStatus.COMPLETED]
        if not completed:
            return 0.0
        return sum(s.confidence for s in completed) / len(completed)

    def validate(self) -> tuple[bool, Optional[str]]:
        """
        Validate plan structure.

        Returns:
            (is_valid, error_message) - error_message is None if valid
        """
        # Check for missing dependencies
        step_ids = {s.id for s in self.steps}
        for step in self.steps:
            for dep_id in step.deps:
                if dep_id not in step_ids:
                    return False, f"Step '{step.id}' depends on unknown step '{dep_id}'"

        # Check for circular dependencies
        cycle = self._find_cycle()
        if cycle:
            return False, f"Circular dependency detected: {' -> '.join(cycle)}"

        return True, None

    def _find_cycle(self) -> Optional[list[str]]:
        """
        Find circular dependency using DFS.

        Returns the cycle path if found, None otherwise.
        """
        # Build adjacency list (step -> dependencies)
        graph: dict[str, list[str]] = {s.id: list(s.deps) for s in self.steps}

        # Track visit state: 0=unvisited, 1=visiting, 2=visited
        state: dict[str, int] = {s.id: 0 for s in self.steps}
        path: list[str] = []

        def dfs(node: str) -> Optional[list[str]]:
            if state[node] == 1:  # Found cycle
                # Extract cycle from path
                cycle_start = path.index(node)
                return path[cycle_start:] + [node]
            if state[node] == 2:  # Already fully explored
                return None

            state[node] = 1  # Mark as visiting
            path.append(node)

            for dep in graph.get(node, []):
                if dep in graph:  # Only check valid deps
                    result = dfs(dep)
                    if result:
                        return result

            path.pop()
            state[node] = 2  # Mark as visited
            return None

        # Check from each node
        for step_id in graph:
            if state[step_id] == 0:
                result = dfs(step_id)
                if result:
                    return result

        return None


@dataclass
class DoRequest:
    """Request for airis.do."""
    intent: str                              # Intent string (e.g., "edit", "search.docs")
    args: dict[str, Any]                     # Intent-specific arguments
    policy: Optional[Policy] = None          # Execution policy
    trace: bool = False                      # Enable tracing


@dataclass
class DoResponse:
    """Response from airis.do."""
    status: str                              # "ok", "error", "partial"
    data: dict[str, Any]                     # Result data
    usage: dict[str, Any] = field(default_factory=dict)  # Token/latency stats
    trace: Optional[list[dict]] = None       # Execution trace if enabled


@dataclass
class Implementation:
    """Implementation mapping for an intent."""
    server: str                              # MCP server name
    tool: str                                # Tool name
    priority: int = 0                        # Higher = preferred


# Intent -> Implementation mappings (fallback chain)
INTENT_IMPLEMENTATIONS: dict[Intent, list[Implementation]] = {
    Intent.SEARCH_DOCS: [
        Implementation(server="context7", tool="get-library-docs", priority=2),
        Implementation(server="fetch", tool="fetch", priority=1),
    ],
    Intent.SEARCH_WEB: [
        Implementation(server="tavily", tool="tavily_search", priority=2),
        Implementation(server="fetch", tool="fetch", priority=1),
    ],
    Intent.RETRIEVE: [
        Implementation(server="mindbase", tool="search_memories", priority=2),
        Implementation(server="memory", tool="search_nodes", priority=1),
    ],
    Intent.EDIT: [
        Implementation(server="serena", tool="replace_symbol_body", priority=2),
    ],
    Intent.RECORD: [
        Implementation(server="mindbase", tool="memory_write", priority=2),
        Implementation(server="memory", tool="create_entities", priority=1),
    ],
    # SUMMARIZE can use LLM servers if available, otherwise falls back to heuristic
    Intent.SUMMARIZE: [
        Implementation(server="airis-llm", tool="summarize", priority=3),
        Implementation(server="openai", tool="chat_completion", priority=2),
        Implementation(server="anthropic", tool="complete", priority=1),
    ],
    # PLAN and EXECUTE are internal only (no external implementations)
}
