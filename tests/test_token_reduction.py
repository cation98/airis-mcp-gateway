#!/usr/bin/env python3
"""
OpenMCP Lazy Loading Patternのトークン削減効果を測定

比較:
1. Docker MCP Gateway (http://gateway.localhost:9390/sse) - オリジナル
2. FastAPI Proxy (http://api.gateway.localhost:9400/api/v1/mcp/sse) - Schema Partitioned
"""

import asyncio
import httpx
import json
from typing import Dict, Any, Optional


async def fetch_tools_via_gateway(url: str) -> Optional[Dict[str, Any]]:
    """
    MCP GatewayからSSE経由でtools/listを取得

    Args:
        url: SSE endpoint URL

    Returns:
        tools/list レスポンス
    """
    print(f"\n🔌 Connecting to: {url}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("GET", url) as response:
            print(f"   Status: {response.status_code}")

            # SSEメッセージを読み取る
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]

                    try:
                        data = json.loads(data_str)

                        # tools/list レスポンスを探す
                        if isinstance(data, dict):
                            method = data.get("method")

                            if method == "tools/list":
                                print(f"   ✅ Received tools/list response")
                                return data

                            # エンドポイント通知は無視
                            if "event" in line and "endpoint" in line:
                                continue

                    except json.JSONDecodeError:
                        pass

    return None


def calculate_token_estimate(data: Dict[str, Any]) -> int:
    """
    JSONデータのトークン数を推定

    近似: 1トークン ≈ 4文字
    """
    json_str = json.dumps(data)
    return len(json_str) // 4


def analyze_tools(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    tools/listレスポンスを分析

    Returns:
        {
            "tool_count": int,
            "total_tokens": int,
            "tools": [{"name": str, "tokens": int}]
        }
    """
    if "result" not in data or "tools" not in data["result"]:
        return {
            "tool_count": 0,
            "total_tokens": 0,
            "tools": []
        }

    tools = data["result"]["tools"]
    tool_count = len(tools)
    total_tokens = calculate_token_estimate(data)

    tool_details = []
    for tool in tools:
        tool_name = tool.get("name", "unknown")
        tool_tokens = calculate_token_estimate(tool)
        tool_details.append({
            "name": tool_name,
            "tokens": tool_tokens
        })

    # トークン数でソート
    tool_details.sort(key=lambda x: x["tokens"], reverse=True)

    return {
        "tool_count": tool_count,
        "total_tokens": total_tokens,
        "tools": tool_details
    }


async def main():
    """メイン処理"""

    print("=" * 80)
    print("🧪 OpenMCP Lazy Loading Pattern - Token Reduction Test")
    print("=" * 80)

    # 1. Docker MCP Gateway（オリジナル）
    print("\n📊 Step 1: Fetch from Docker MCP Gateway (Original)")
    gateway_data = await fetch_tools_via_gateway("http://mcp-gateway:9390/sse")

    if not gateway_data:
        print("❌ Failed to fetch from Gateway")
        return

    gateway_analysis = analyze_tools(gateway_data)

    print(f"\n   Tool Count: {gateway_analysis['tool_count']}")
    print(f"   Total Tokens: {gateway_analysis['total_tokens']:,}")
    print(f"\n   Top 10 Tools by Token Size:")
    for i, tool in enumerate(gateway_analysis['tools'][:10], 1):
        print(f"      {i:2}. {tool['name']:30} {tool['tokens']:5,} tokens")

    # 2. FastAPI Proxy（Schema Partitioned）
    print("\n📊 Step 2: Fetch from FastAPI Proxy (Schema Partitioned)")
    proxy_data = await fetch_tools_via_gateway("http://api.gateway.localhost:9400/api/v1/mcp/sse")

    if not proxy_data:
        print("❌ Failed to fetch from Proxy")
        return

    proxy_analysis = analyze_tools(proxy_data)

    print(f"\n   Tool Count: {proxy_analysis['tool_count']}")
    print(f"   Total Tokens: {proxy_analysis['total_tokens']:,}")
    print(f"\n   Top 10 Tools by Token Size:")
    for i, tool in enumerate(proxy_analysis['tools'][:10], 1):
        print(f"      {i:2}. {tool['name']:30} {tool['tokens']:5,} tokens")

    # 3. 比較
    print("\n" + "=" * 80)
    print("📊 Comparison Results")
    print("=" * 80)

    token_reduction = gateway_analysis['total_tokens'] - proxy_analysis['total_tokens']
    reduction_percent = (token_reduction / gateway_analysis['total_tokens'] * 100) if gateway_analysis['total_tokens'] > 0 else 0

    print(f"\n   Original (Gateway):     {gateway_analysis['total_tokens']:6,} tokens")
    print(f"   Partitioned (Proxy):    {proxy_analysis['total_tokens']:6,} tokens")
    print(f"   Reduction:              {token_reduction:6,} tokens ({reduction_percent:.1f}%)")

    # expandSchema ツールが追加されているか確認
    proxy_tools = {tool['name'] for tool in proxy_analysis['tools']}
    has_expand_schema = "expandSchema" in proxy_tools

    print(f"\n   expandSchema tool added: {'✅ Yes' if has_expand_schema else '❌ No'}")

    # 目標達成確認
    print("\n" + "=" * 80)
    print("🎯 Goal Achievement")
    print("=" * 80)

    if reduction_percent >= 75:
        print(f"   ✅ SUCCESS: {reduction_percent:.1f}% reduction (target: 75-90%)")
    elif reduction_percent >= 50:
        print(f"   ⚠️  PARTIAL: {reduction_percent:.1f}% reduction (target: 75-90%)")
    else:
        print(f"   ❌ INSUFFICIENT: {reduction_percent:.1f}% reduction (target: 75-90%)")

    if has_expand_schema:
        print(f"   ✅ expandSchema tool is available for on-demand schema expansion")
    else:
        print(f"   ❌ expandSchema tool is missing")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
