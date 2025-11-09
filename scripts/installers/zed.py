"""Zed installer."""

from pathlib import Path
import json

from .base import EditorInstaller


def strip_json_comments(text: str) -> str:
    """Remove // and /* */ comments while respecting string literals."""
    result = []
    in_string = False
    escape = False
    i = 0
    length = len(text)

    while i < length:
        ch = text[i]

        if in_string:
            result.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue

        if ch == '"':
            in_string = True
            result.append(ch)
            i += 1
            continue

        if ch == '/' and i + 1 < length:
            next_ch = text[i + 1]
            if next_ch == '/':
                i += 2
                while i < length and text[i] not in "\r\n":
                    i += 1
                continue
            if next_ch == '*':
                i += 2
                while i + 1 < length and not (text[i] == '*' and text[i + 1] == '/'):
                    i += 1
                i += 2
                continue

        result.append(ch)
        i += 1

    return "".join(result)


class ZedInstaller(EditorInstaller):
    """Zed installer - modify context_servers in settings.json"""

    def name(self) -> str:
        return "Zed"

    def config_path(self) -> Path:
        return Path.home() / ".config" / "zed" / "settings.json"

    def install(self) -> bool:
        """Update only the context_servers block in settings.json."""
        config = self.config_path()

        try:
            with open(config) as handle:
                content = handle.read()

            clean_content = strip_json_comments(content)
            settings = json.loads(clean_content)

            settings["context_servers"] = {
                self.context.server_name: {
                    "command": "curl",
                    "args": ["-N", self.context.sse_url],
                }
            }

            with open(config, "w") as handle:
                json.dump(settings, handle, indent=2)
                handle.write("\n")

            return True
        except Exception as exc:
            print(f"   ❌ Failed: {exc}")
            return False

    def uninstall(self, backup_path) -> bool:
        """Remove AIRIS Gateway from context_servers."""
        config = self.config_path()
        if not config.exists():
            return True

        try:
            with open(config) as handle:
                content = handle.read()
            clean_content = strip_json_comments(content)
            settings = json.loads(clean_content)

            context_servers = settings.get("context_servers", {})
            if self.context.server_name in context_servers:
                del context_servers[self.context.server_name]
                settings["context_servers"] = context_servers

                with open(config, "w") as handle:
                    json.dump(settings, handle, indent=2)
                    handle.write("\n")

            return True
        except Exception as exc:
            print(f"   ⚠️  Failed to clean Zed config: {exc}")
            return False
