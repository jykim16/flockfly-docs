# Plan

## Test scenarios

1. Execute `format_range`; expect the persistence callback exactly once after formatting and activation complete.
2. Trigger the mounted WebMCP presentation callback; expect `onSnapshot` to receive `workbook.save()`.
3. Preserve the existing remote merge echo regression behavior.

## Implementation

- Add an optional presentation-change callback to WebMCP registration and the format tool.
- Wire the callback to the mounted workbook's existing snapshot persistence path.
- Serialize snapshot saves behind pending spreadsheet operations.
- Run targeted tests, full tests, typecheck, and production build.

