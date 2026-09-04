# Context

## Goal

Keep the useful Flockdoc feature set consistent when signed out, with identity-dependent cloud sharing and realtime collaboration excluded.

## Reported regression

In a signed-out spreadsheet, selecting any cell other than A1 returns to A1 after the local autosave runs.

## Reproduction

- Open the local signed-out workspace.
- Create and open a spreadsheet.
- Select E5.
- The name box shows E5 immediately and A1 about 1.5 seconds later.

## Root cause

`SpreadsheetEditor` forwards a locally produced snapshot to its parent. The parent stores that same snapshot on the item. The editor then treats the resulting prop update as an external snapshot and calls `applySnapshot`, which recreates the Univer workbook and resets its active selection.

