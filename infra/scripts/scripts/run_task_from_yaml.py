#!/usr/bin/env python3
"""Lightweight task runner that maps YAML definitions to docker compose commands."""

from __future__ import annotations

import argparse
import os
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Dict, List


def _parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_list(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_simple_yaml(path: Path) -> Dict[str, str]:
    """Tiny YAML parser for `key: value` pairs (no nested structures)."""
    data: Dict[str, str] = {}
    with path.open("r", encoding="utf-8") as handle:
        for line_no, raw_line in enumerate(handle, 1):
            stripped = raw_line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if ":" not in raw_line:
                raise ValueError(f"{path}:{line_no} is missing ':' delimiter")
            key, value = raw_line.split(":", 1)
            key = key.strip()
            value = value.strip()
            if not key:
                raise ValueError(f"{path}:{line_no} has empty key")
            if key in data:
                raise ValueError(f"{path}:{line_no} redefines '{key}'")
            data[key] = value
    return data


def _build_compose_command(defn: Dict[str, str]) -> List[str]:
    service = defn.get("service")
    command = defn.get("command")
    if not service or not command:
        missing = ["service" if not service else None, "command" if not command else None]
        raise ValueError(f"Missing required keys: {', '.join(filter(None, missing))}")

    profile = defn.get("profile")
    forward_uid_gid = _parse_bool(defn.get("forward_uid_gid", "false"))
    pass_env = _parse_list(defn.get("pass_env", ""))

    compose_cmd: List[str] = ["docker", "compose"]
    if profile:
        compose_cmd.extend(["--profile", profile])
    compose_cmd.extend(["run", "--rm"])

    if forward_uid_gid:
        compose_cmd.extend([f"-e", f"UID={os.getuid()}", f"-e", f"GID={os.getgid()}"])

    for env_name in pass_env:
        compose_cmd.extend(["-e", env_name])

    compose_cmd.append(service)

    expanded_command = os.path.expandvars(command)
    command_args = shlex.split(expanded_command)

    if not command_args:
        raise ValueError("Command definition produced no arguments")

    compose_cmd.extend(command_args)
    return compose_cmd


def main() -> None:
    parser = argparse.ArgumentParser(description="Run dockerized tasks from YAML definition files.")
    parser.add_argument("--file", required=True, help="Path to the YAML task definition.")
    args = parser.parse_args()

    task_file = Path(args.file).resolve()
    if not task_file.exists():
        print(f"❌ Task file not found: {task_file}", file=sys.stderr)
        sys.exit(1)

    try:
        definition = _parse_simple_yaml(task_file)
        command = _build_compose_command(definition)
    except ValueError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        sys.exit(1)

    pretty = " ".join(shlex.quote(part) for part in command)
    print(f"▶ {pretty}")

    proc = subprocess.run(command)
    sys.exit(proc.returncode)


if __name__ == "__main__":
    main()
