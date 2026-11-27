# Sample import data

| File | Purpose |
| --- | --- |
| `web_exam_100_questions_fixed.csv` | 100 Web Development questions in the importer's exact schema (use with **Question bank → Import**) |
| `web_exam_100_questions_fixed.json` | The same 100 questions as JSON (identical data; importing it after the CSV reports all 100 as duplicates) |
| `original_web_exam_100_questions.csv` | The original file, kept for reference — it fails validation on every row |

## What was wrong with the original

Running the app's own validator (`validateQuestionRows`) on the original reported **100 errors / 0 valid rows**:

- `type` used `single` instead of the enum `MCQ_SINGLE`
- `multi_scoring` used `none` instead of `ALL_OR_NOTHING` / `PARTIAL`

The file contains 100 single-answer questions (4 options, 1 correct, 1 mark, 0.25 negative marks) across
8 topics. It has **no** multiple-select rows, so the "≥ 2 correct options" rule had nothing to apply to.

## Regenerate and validate

```bash
npx tsx scripts/fix-dataset.ts sample-data/original_web_exam_100_questions.csv
```

The script maps the enums, upper-cases difficulty, checks every correct-answer letter against the actual
options, checks required fields, writes both files, validates **both** with the importer's own logic and
confirms CSV and JSON parse to identical question data. Result: 100 rows, 0 errors, 0 duplicates.

## Columns (CSV)

`type, prompt, options (a|b|c|d), correct (letters, e.g. b or a|c), accepted (short answers, |-separated),
marks, negative_marks, difficulty (EASY|MEDIUM|HARD), subject, topic, multi_scoring (ALL_OR_NOTHING|PARTIAL)`
