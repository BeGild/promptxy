#!/usr/bin/env python3
"""
验证生成的 JSON Schema 是否正确
"""

import json
import os


def verify_schema(file_path: str) -> bool:
    """验证单个 Schema 文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)

        # 检查基本结构
        assert "$schema" in schema, "缺少 $schema"
        assert "type" in schema, "缺少 type"
        assert "description" in schema, "缺少 description"

        # 检查类型
        if schema["type"] == "object":
            assert "properties" in schema, "对象类型必须有 properties"
            assert "required" in schema, "对象类型必须有 required"
            assert "additionalProperties" in schema, "建议设置 additionalProperties"
        elif schema["type"] == "array":
            assert "items" in schema, "数组类型必须有 items"

        return True
    except Exception as e:
        print(f"  ❌ 验证失败: {e}")
        return False


def main():
    print("正在验证生成的 JSON Schema...\n")

    # 自动发现所有文件夹
    import glob
    folders = [f for f in glob.glob("2026-*/") if os.path.isdir(f)]
    folders.sort()

    all_passed = True

    for folder in folders:
        if not os.path.exists(folder):
            print(f"⚠️  文件夹不存在: {folder}")
            continue

        print(f"📁 {folder}:")

        schema_files = [f for f in os.listdir(folder) if f.endswith('.schema.json')]

        if not schema_files:
            print("  ⚠️  无 Schema 文件")
            continue

        for schema_file in sorted(schema_files):
            file_path = os.path.join(folder, schema_file)
            is_valid = verify_schema(file_path)

            if is_valid:
                # 读取并显示基本信息
                with open(file_path, 'r', encoding='utf-8') as f:
                    schema = json.load(f)
                print(f"  ✅ {schema_file} (type: {schema['type']}, samples: {schema.get('sample_count', 0)})")
            else:
                all_passed = False

    print("\n" + "="*50)
    if all_passed:
        print("✅ 所有 Schema 验证通过！")
    else:
        print("❌ 部分 Schema 验证失败")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())
