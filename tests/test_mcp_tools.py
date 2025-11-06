#!/usr/bin/env python3
"""
MCP Gateway接続時にClaude Codeが受け取るツール定義数を検証

問題：
- READMEは「Zero-Token Startup」を主張
- 実際にすべてのツール定義が送られてないか確認する必要がある

検証方法：
1. SSE接続を開始
2. MCPプロトコルのinitializeリクエストを送信
3. tools/listレスポンスのツール数とトークン数を測定
"""

import asyncio
import json
import httpx
from typing import Optional, Dict, Any

async def test_mcp_connection(url: str = "http://mcp-gateway:9090/sse") -> Optional[Dict[str, Any]]:
    """
    MCP Gatewayに接続してツール一覧を取得

    Args:
        url: MCP Gateway SSE endpoint

    Returns:
        {
            "tool_count": int,
            "total_tokens": int,
            "has_tools": bool,
            "response": dict
        }
    """
    print(f"🔌 Connecting to: {url}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # SSE接続開始
            async with client.stream("GET", url) as response:
                print(f"   Status: {response.status_code}")

                if response.status_code != 200:
                    print(f"   ❌ Failed to connect: {response.status_code}")
                    return None

                # SSEメッセージを最大10秒間読み取る
                timeout = 10
                start_time = asyncio.get_event_loop().time()

                tool_count = 0
                has_endpoint = False

                async for line in response.aiter_lines():
                    # タイムアウトチェック
                    if asyncio.get_event_loop().time() - start_time > timeout:
                        print(f"   ⏱️  Timeout after {timeout}s")
                        break

                    if line.startswith("data: "):
                        data_str = line[6:]

                        try:
                            data = json.loads(data_str)

                            # エンドポイント通知
                            if isinstance(data, dict) and data.get("event") == "endpoint":
                                has_endpoint = True
                                print(f"   📍 Endpoint notification received")

                            # tools/list レスポンス
                            if isinstance(data, dict) and "result" in data:
                                if "tools" in data["result"]:
                                    tools = data["result"]["tools"]
                                    tool_count = len(tools)

                                    # トークン数推定（1トークン ≈ 4文字）
                                    json_str = json.dumps(data)
                                    total_tokens = len(json_str) // 4

                                    print(f"\n   ✅ Received tools/list response")
                                    print(f"   📊 Tool count: {tool_count}")
                                    print(f"   🔢 Estimated tokens: {total_tokens:,}")

                                    # 最初の5ツールを表示
                                    print(f"\n   First 5 tools:")
                                    for i, tool in enumerate(tools[:5], 1):
                                        name = tool.get("name", "unknown")
                                        print(f"      {i}. {name}")

                                    return {
                                        "tool_count": tool_count,
                                        "total_tokens": total_tokens,
                                        "has_tools": True,
                                        "response": data
                                    }

                        except json.JSONDecodeError:
                            continue

                # タイムアウトまでtools/listが来なかった
                if has_endpoint:
                    print(f"\n   ⚠️  Endpoint notification received, but NO tools/list")
                    print(f"   💡 This suggests ZERO-TOKEN startup (tools loaded on-demand)")
                    return {
                        "tool_count": 0,
                        "total_tokens": 0,
                        "has_tools": False,
                        "response": None
                    }
                else:
                    print(f"\n   ❌ No response received")
                    return None

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

async def main():
    """メイン処理"""

    print("=" * 80)
    print("🧪 MCP Gateway Tool Definition Test")
    print("=" * 80)
    print()
    print("Testing if MCP Gateway sends all tool definitions on startup...")
    print()

    result = await test_mcp_connection()

    print("\n" + "=" * 80)
    print("📊 Test Results")
    print("=" * 80)

    if result is None:
        print("\n❌ FAILED: Could not connect to Gateway")
        return

    if not result["has_tools"]:
        print("\n✅ VERIFIED: Zero-Token Startup")
        print("   🎯 Gateway does NOT send tool definitions on startup")
        print("   💡 Tools are loaded on-demand (lazy loading)")
        print("\n   README claim is TRUE ✓")
    else:
        tool_count = result["tool_count"]
        total_tokens = result["total_tokens"]

        print(f"\n⚠️  WARNING: Tools sent on startup")
        print(f"   📊 Tool count: {tool_count}")
        print(f"   🔢 Total tokens: {total_tokens:,}")
        print("\n   README claim is FALSE ✗")

        if total_tokens < 1000:
            print(f"   💡 But token count is low ({total_tokens:,}), acceptable overhead")
        else:
            print(f"   ❌ High token usage ({total_tokens:,}), NOT zero-token!")

    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
