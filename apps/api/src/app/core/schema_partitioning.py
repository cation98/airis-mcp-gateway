"""
OpenMCP Lazy Loading Pattern実装

トークン消費を75-90%削減するためのスキーマ分割ロジック。
"""

from typing import Any, Dict, List, Optional
import copy


class SchemaPartitioner:
    """
    JSON Schemaをトップレベルプロパティのみに分割。

    OpenMCP Pattern:
    - tools/list: 軽量なスキーマ（トップレベルのみ）を返す
    - expandSchema: 必要に応じて詳細を段階的に取得
    """

    def __init__(self):
        # フルスキーマをメモリにキャッシュ
        self.full_schemas: Dict[str, Dict[str, Any]] = {}
        self.tool_docs: Dict[str, str] = {}

    def store_full_schema(self, tool_name: str, full_schema: Dict[str, Any]):
        """
        フルスキーマを保存（expandSchema用）

        Args:
            tool_name: ツール名
            full_schema: 完全なinputSchema
        """
        self.full_schemas[tool_name] = copy.deepcopy(full_schema)
        # ツール自体がmutateされる可能性もあるのでdocは別管理

    def store_tool_description(self, tool_name: str, description: Optional[str]):
        """
        ツール説明文を保存（遅延読み出し用）
        """
        if description:
            self.tool_docs[tool_name] = description.strip()

    def get_tool_description(self, tool_name: str) -> Optional[str]:
        """
        保存済みツール説明文を取得
        """
        return self.tool_docs.get(tool_name)

    def partition_schema(self, schema: Dict[str, Any], depth: int = 1) -> Dict[str, Any]:
        """
        スキーマをトップレベルプロパティのみに分割

        Args:
            schema: 元のJSON Schema
            depth: 残す階層の深さ（デフォルト: 1 = トップレベルのみ）

        Returns:
            軽量化されたスキーマ

        Example:
            Input (1000 tokens):
            {
                "type": "object",
                "properties": {
                    "amount": {"type": "number"},
                    "metadata": {
                        "type": "object",
                        "properties": {
                            "shipping": {
                                "type": "object",
                                "properties": {
                                    "address": {...}
                                }
                            }
                        }
                    }
                }
            }

            Output (50 tokens):
            {
                "type": "object",
                "properties": {
                    "amount": {"type": "number"},
                    "metadata": {"type": "object"}  # ネスト削除
                }
            }
        """
        if not isinstance(schema, dict):
            return schema

        partitioned = copy.deepcopy(schema)

        # propertiesが存在する場合
        if "properties" in partitioned and depth > 0:
            new_properties = {}

            for key, value in partitioned["properties"].items():
                if isinstance(value, dict):
                    # トップレベルのtypeとdescriptionのみ残す
                    new_prop = {}

                    if "type" in value:
                        new_prop["type"] = value["type"]

                    if "description" in value:
                        new_prop["description"] = value["description"]

                    # enumやconstは残す（選択肢が必要）
                    if "enum" in value:
                        new_prop["enum"] = value["enum"]

                    if "const" in value:
                        new_prop["const"] = value["const"]

                    # format, pattern等のバリデーションは残す
                    if "format" in value:
                        new_prop["format"] = value["format"]

                    if "pattern" in value:
                        new_prop["pattern"] = value["pattern"]

                    # required, default も残す
                    if "required" in value:
                        new_prop["required"] = value["required"]

                    if "default" in value:
                        new_prop["default"] = value["default"]

                    # 配列の場合は items を再帰的に軽量化
                    if value.get("type") == "array" and isinstance(value.get("items"), dict):
                        new_prop["items"] = self.partition_schema(value["items"], max(depth - 1, 0))

                    # ネストしたpropertiesは削除（type情報のみ残る）
                    # これによりトークン削減

                    new_properties[key] = new_prop
                else:
                    new_properties[key] = value

            partitioned["properties"] = new_properties

        # itemsが存在する場合（配列）
        if "items" in partitioned and isinstance(partitioned["items"], dict):
            partitioned["items"] = self.partition_schema(partitioned["items"], depth - 1)

        return partitioned

    def expand_schema(
        self,
        tool_name: str,
        path: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        指定されたパスのスキーマ詳細を取得

        Args:
            tool_name: ツール名
            path: スキーマパス（例: ["metadata", "shipping"]）
                  Noneの場合は完全なスキーマを返す

        Returns:
            指定パスのスキーマ、またはNone（見つからない場合）

        Example:
            expand_schema("stripe_create_payment", ["metadata", "shipping"])
            → metadata.shipping 配下の完全なスキーマを返す
        """
        if tool_name not in self.full_schemas:
            return None

        schema = self.full_schemas[tool_name]

        # パス指定なし = 完全なスキーマ
        if not path:
            return copy.deepcopy(schema)

        # パスをたどる
        current = schema
        for key in path:
            if isinstance(current, dict):
                if key in current:
                    current = current[key]
                elif "properties" in current and key in current["properties"]:
                    current = current["properties"][key]
                else:
                    return None
            else:
                return None

        return copy.deepcopy(current)

    def get_token_reduction_estimate(self, full_schema: Dict[str, Any]) -> Dict[str, int]:
        """
        トークン削減効果の推定

        Args:
            full_schema: 完全なスキーマ

        Returns:
            {"full": フルトークン数推定, "partitioned": 分割後トークン数推定, "reduction": 削減率%}
        """
        import json

        full_json = json.dumps(full_schema)
        partitioned_json = json.dumps(self.partition_schema(full_schema))

        # JSON長をトークン数の近似値とする（実際は約4文字 = 1トークン）
        full_tokens = len(full_json) // 4
        partitioned_tokens = len(partitioned_json) // 4

        reduction = int((1 - partitioned_tokens / full_tokens) * 100) if full_tokens > 0 else 0

        return {
            "full": full_tokens,
            "partitioned": partitioned_tokens,
            "reduction": reduction
        }


# グローバルインスタンス（FastAPIで共有）
schema_partitioner = SchemaPartitioner()
