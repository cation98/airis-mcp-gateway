"""
Capability Router for AIRIS MCP Gateway.

Routes detected intents to appropriate MCP server implementations
based on gateway-config.yaml configuration.
"""
import os
import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Any

from .intent_detector import IntentResult, Capability


GATEWAY_CONFIG_PATH = os.getenv(
    "GATEWAY_CONFIG_PATH",
    "/app/config/gateway-config.yaml"
)


@dataclass
class Implementation:
    """An MCP server implementation for a capability."""
    name: str
    priority: int
    mode: Optional[str]  # "hot", "cold", or None (native)
    conditions: dict = field(default_factory=dict)
    config: dict = field(default_factory=dict)


@dataclass
class CapabilityConfig:
    """Configuration for a single capability."""
    description: str
    implementations: list[Implementation]
    fallback: str = "native"


@dataclass
class RoutingResult:
    """Result of capability routing."""
    capability: Capability
    implementation: str
    mode: Optional[str]
    confidence: float
    fallback_chain: list[str]
    metadata: dict = field(default_factory=dict)


class CapabilityRouter:
    """
    Routes intents to MCP implementations based on configuration.

    Loads gateway-config.yaml and provides intelligent routing.
    """

    def __init__(self, config_path: str = None):
        self.config_path = Path(config_path or GATEWAY_CONFIG_PATH)
        self.config: dict = {}
        self.capabilities: dict[str, CapabilityConfig] = {}
        self.intent_patterns: dict = {}
        self.routing_config: dict = {}

        # Try to load config
        self._load_config()

    def _load_config(self) -> bool:
        """Load and parse gateway-config.yaml."""
        if not self.config_path.exists():
            print(f"[CapabilityRouter] Config not found: {self.config_path}")
            self._load_defaults()
            return False

        try:
            with open(self.config_path) as f:
                self.config = yaml.safe_load(f)

            self._parse_capabilities()
            self._parse_intent_patterns()
            self._parse_routing()
            print(f"[CapabilityRouter] Loaded config: {self.config_path}")
            return True

        except Exception as e:
            print(f"[CapabilityRouter] Config load error: {e}")
            self._load_defaults()
            return False

    def _load_defaults(self):
        """Load default configuration when config file is missing."""
        self.capabilities = {
            cap.value: CapabilityConfig(
                description=f"Default {cap.value} capability",
                implementations=[
                    Implementation(
                        name="native",
                        priority=1,
                        mode=None,
                        conditions={}
                    )
                ],
                fallback="native"
            )
            for cap in Capability
        }
        self.routing_config = {
            "default_capability": "plan",
            "default_implementation": "airis-agent",
            "thresholds": {
                "high_confidence": 0.9,
                "medium_confidence": 0.7,
                "low_confidence": 0.5
            },
            "fallback_chain": ["native", "ask_user"]
        }

    def _parse_capabilities(self):
        """Parse capabilities section from config."""
        caps = self.config.get("capabilities", {})
        for cap_name, cap_data in caps.items():
            if not isinstance(cap_data, dict):
                continue

            impls = []
            for impl_data in cap_data.get("implementations", []):
                impls.append(Implementation(
                    name=impl_data.get("name", "native"),
                    priority=impl_data.get("priority", 99),
                    mode=impl_data.get("mode"),
                    conditions=impl_data.get("conditions", {}),
                    config=impl_data.get("config", {})
                ))

            self.capabilities[cap_name] = CapabilityConfig(
                description=cap_data.get("description", ""),
                implementations=sorted(impls, key=lambda x: x.priority),
                fallback=cap_data.get("fallback", "native")
            )

    def _parse_intent_patterns(self):
        """Parse intent_patterns section from config."""
        self.intent_patterns = self.config.get("intent_patterns", {})

    def _parse_routing(self):
        """Parse routing section from config."""
        self.routing_config = self.config.get("routing", {
            "default_capability": "plan",
            "default_implementation": "airis-agent",
            "thresholds": {
                "high_confidence": 0.9,
                "medium_confidence": 0.7,
                "low_confidence": 0.5
            },
            "fallback_chain": ["native", "ask_user"]
        })

    def route(self, intent_result: IntentResult) -> RoutingResult:
        """
        Route an intent result to the best implementation.

        Args:
            intent_result: The detected intent

        Returns:
            RoutingResult with selected implementation
        """
        capability = intent_result.capability
        cap_config = self.capabilities.get(capability.value)

        if not cap_config:
            # Use default
            return RoutingResult(
                capability=capability,
                implementation=self.routing_config.get("default_implementation", "native"),
                mode=None,
                confidence=intent_result.confidence,
                fallback_chain=self.routing_config.get("fallback_chain", ["native"]),
                metadata={"reason": "no_capability_config"}
            )

        # Find matching implementation
        selected: Optional[Implementation] = None
        fallback_chain = []

        for impl in cap_config.implementations:
            fallback_chain.append(impl.name)

            if self._matches_conditions(impl, intent_result):
                selected = impl
                break

        # Use hint from intent if no match
        if selected is None and intent_result.implementation_hint:
            for impl in cap_config.implementations:
                if impl.name == intent_result.implementation_hint:
                    selected = impl
                    break

        # Use first available
        if selected is None and cap_config.implementations:
            selected = cap_config.implementations[0]

        # Final fallback
        if selected is None:
            return RoutingResult(
                capability=capability,
                implementation=cap_config.fallback,
                mode=None,
                confidence=intent_result.confidence,
                fallback_chain=[cap_config.fallback],
                metadata={"reason": "fallback"}
            )

        return RoutingResult(
            capability=capability,
            implementation=selected.name,
            mode=selected.mode,
            confidence=intent_result.confidence,
            fallback_chain=fallback_chain[fallback_chain.index(selected.name) + 1:] if selected.name in fallback_chain else [],
            metadata={
                "intent": intent_result.intent,
                "conditions_matched": True
            }
        )

    def _matches_conditions(self, impl: Implementation, intent: IntentResult) -> bool:
        """Check if an implementation matches the intent conditions."""
        conditions = impl.conditions

        # Check intent type
        if "intents" in conditions:
            if intent.intent not in conditions["intents"]:
                return False

        # All conditions passed (or no conditions)
        return True

    def get_hot_servers(self) -> list[str]:
        """Get list of HOT mode servers that should always be running."""
        hot_servers = []
        for cap_config in self.capabilities.values():
            for impl in cap_config.implementations:
                if impl.mode == "hot" and impl.name not in hot_servers:
                    hot_servers.append(impl.name)
        return hot_servers

    def get_cold_servers(self) -> list[str]:
        """Get list of COLD mode servers that start on-demand."""
        cold_servers = []
        for cap_config in self.capabilities.values():
            for impl in cap_config.implementations:
                if impl.mode == "cold" and impl.name not in cold_servers:
                    cold_servers.append(impl.name)
        return cold_servers


# Singleton instance
_router: Optional[CapabilityRouter] = None


def get_capability_router() -> CapabilityRouter:
    """Get or create the capability router singleton."""
    global _router
    if _router is None:
        _router = CapabilityRouter()
    return _router


def route_intent(intent_result: IntentResult) -> RoutingResult:
    """Convenience function to route an intent."""
    return get_capability_router().route(intent_result)
