#!/usr/bin/env python3
"""
脚本功能：从 YAML 文件中提取 JSON 数据并生成 Schema
1. 提取 JSON 数据，裁剪长字符串 (>64字符)
2. 保存裁剪后的数据为 .json 文件
3. 生成并保存 Schema 为 .schema.json 文件

输入：YAML 文件（包含 JSON 字符串或块标量格式的 responseBody）
输出：每个 YAML 对应一个文件夹，包含 .json 和 .schema.json 文件
"""

import yaml
import json
import os
import glob
from typing import Any, Dict, List


def truncate_string(value: str, max_length: int = 64) -> str:
    """
    裁剪长字符串，超过 max_length 的部分用 '....' 替换
    """
    if not isinstance(value, str):
        return value

    if len(value) <= max_length:
        return value

    return value[:max_length] + "...."


def truncate_long_strings(data: Any, max_length: int = 64) -> Any:
    """
    递归遍历数据结构，裁剪所有叶子节点的长字符串
    """
    if isinstance(data, str):
        return truncate_string(data, max_length)

    if isinstance(data, list):
        return [truncate_long_strings(item, max_length) for item in data]

    if isinstance(data, dict):
        return {key: truncate_long_strings(value, max_length) for key, value in data.items()}

    # 数字、bool、None 等直接返回
    return data


def generate_json_schema(data: Any) -> Dict[str, Any]:
    """
    根据 JSON 数据生成 JSON Schema
    支持嵌套对象、数组、基本类型、SSE 事件结构
    """
    if data is None:
        return {"type": "null"}

    if isinstance(data, bool):
        return {"type": "boolean"}

    if isinstance(data, int):
        return {"type": "integer"}

    if isinstance(data, float):
        return {"type": "number"}

    if isinstance(data, str):
        return {"type": "string"}

    if isinstance(data, list):
        if len(data) == 0:
            return {"type": "array", "items": {}}

        # 收集所有元素的 schema
        item_schemas = [generate_json_schema(item) for item in data]

        # 如果所有元素 schema 相同，使用单一 schema
        unique_schemas = []
        for schema in item_schemas:
            if schema not in unique_schemas:
                unique_schemas.append(schema)

        if len(unique_schemas) == 1:
            return {"type": "array", "items": unique_schemas[0]}
        else:
            return {"type": "array", "items": {"oneOf": unique_schemas}}

    if isinstance(data, dict):
        # 特殊处理：SSE 事件结构
        if "sse_events" in data and "event_count" in data:
            sse_event_schema = {
                "type": "object",
                "properties": {
                    "event": {"type": "string"},
                    "data": {"oneOf": [
                        {"type": "object"},
                        {"type": "string"}
                    ]}
                },
                "required": ["event", "data"],
                "additionalProperties": False
            }

            return {
                "type": "object",
                "properties": {
                    "sse_events": {
                        "type": "array",
                        "items": sse_event_schema
                    },
                    "event_count": {"type": "integer"}
                },
                "required": ["sse_events", "event_count"],
                "additionalProperties": False
            }

        # 普通对象
        properties = {}
        required = []

        for key, value in data.items():
            properties[key] = generate_json_schema(value)
            required.append(key)

        return {
            "type": "object",
            "properties": properties,
            "required": required,
            "additionalProperties": False
        }

    return {"type": "string"}


def merge_schemas(schemas: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    合并多个 JSON Schema，用于处理多个样本
    """
    if not schemas:
        return {}

    if len(schemas) == 1:
        return schemas[0]

    first_schema = schemas[0]

    if first_schema.get("type") == "object":
        all_properties = {}
        all_required = set()

        for schema in schemas:
            if "properties" in schema:
                all_properties.update(schema["properties"])
            if "required" in schema:
                all_required.update(schema["required"])

        return {
            "type": "object",
            "properties": all_properties,
            "required": list(all_required),
            "additionalProperties": False
        }

    if first_schema.get("type") == "array":
        return first_schema

    return first_schema


def parse_sse_content(sse_text: str) -> List[Dict[str, Any]]:
    """
    解析 SSE (Server-Sent Events) 格式的文本
    返回事件列表，每个事件包含 event 和 data
    """
    events = []
    lines = sse_text.strip().split('\n')

    current_event = {}
    for line in lines:
        line = line.strip()
        if not line:
            if current_event:
                events.append(current_event)
                current_event = {}
            continue

        if line.startswith('event:'):
            current_event['event'] = line.split(':', 1)[1].strip()
        elif line.startswith('data:'):
            data_str = line.split(':', 1)[1].strip()
            try:
                current_event['data'] = json.loads(data_str)
            except:
                current_event['data'] = data_str

    if current_event:
        events.append(current_event)

    return events


def parse_yaml_file(file_path: str) -> Dict[str, Any]:
    """
    解析 YAML 文件，提取需要的字段
    """
    result = {
        "originalRequestHeaders": [],
        "originalBody": [],
        "responseBody": [],
        "responseHeaders": []
    }

    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            data = yaml.safe_load(f)
        except Exception as e:
            print(f"  YAML 解析错误: {e}")
            return result

    if not data:
        return result

    for field_name in result.keys():
        if field_name in data:
            value = data[field_name]

            if field_name == "responseBody":
                if isinstance(value, str):
                    sse_events = parse_sse_content(value)
                    if sse_events:
                        result[field_name].append({
                            "sse_events": sse_events,
                            "event_count": len(sse_events)
                        })
                elif isinstance(value, (dict, list)):
                    result[field_name].append(value)
            else:
                if isinstance(value, str):
                    try:
                        parsed = json.loads(value)
                        result[field_name].append(parsed)
                    except json.JSONDecodeError:
                        result[field_name].append(value)
                elif isinstance(value, (dict, list)):
                    result[field_name].append(value)

    return result


def main():
    """主函数"""
    yaml_files = sorted(glob.glob("*.yaml"))

    for yaml_file in yaml_files:
        if not os.path.exists(yaml_file):
            print(f"警告: 文件 {yaml_file} 不存在，跳过")
            continue

        print(f"正在处理: {yaml_file}")

        # 解析 YAML 文件
        data = parse_yaml_file(yaml_file)

        # 创建输出目录
        folder_name = yaml_file.replace('.yaml', '')
        os.makedirs(folder_name, exist_ok=True)

        # 处理每个字段
        for field_name, samples in data.items():
            if not samples:
                print(f"  警告: {field_name} 没有数据")
                continue

            print(f"  处理 {field_name}: {len(samples)} 个样本")

            # 取第一个样本（通常只有一个）
            sample = samples[0]

            # 1. 保存裁剪后的数据为 .json
            truncated_data = truncate_long_strings(sample)
            data_file = os.path.join(folder_name, f"{field_name}.json")
            with open(data_file, 'w', encoding='utf-8') as f:
                json.dump(truncated_data, f, indent=2, ensure_ascii=False)
            print(f"    -> 数据: {data_file}")

            # 2. 生成并保存 Schema 为 .schema.json
            schemas = [generate_json_schema(s) for s in samples]
            merged_schema = merge_schemas(schemas)

            final_schema = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "description": f"Schema for {field_name} from {yaml_file}",
                "sample_count": len(samples),
                **merged_schema
            }

            schema_file = os.path.join(folder_name, f"{field_name}.schema.json")
            with open(schema_file, 'w', encoding='utf-8') as f:
                json.dump(final_schema, f, indent=2, ensure_ascii=False)
            print(f"    -> Schema: {schema_file}")

        print(f"完成: {folder_name}\n")

    print("所有处理完成！")


if __name__ == "__main__":
    main()
