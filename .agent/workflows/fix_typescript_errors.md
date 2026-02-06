---
description: Systematically detect and fix TypeScript type errors in the project
---
1. Run Type Check
   Run the typescript compiler to identify all current errors.
   // turbo
   `npx tsc --noEmit`

2. Analyze Errors
   Read the output from step 1. Identify the files with the most critical or numerous errors. Focus on one or a few related files at a time.

3. Fix Errors Loop
   For each target file:
   - Read the file content using `view_file`.
   - Analyze the specific error messages (e.g., "Property 'x' does not exist on type 'y'", "Type 'a' is not assignable to type 'b'").
   - Fix the errors by:
     - Updating interface definitions in `types.ts` or local interfaces.
     - Adding necessary type assertions (`as Type`) if valid.
     - Adding missing properties to objects.
     - Correcting function signatures.
   - Use `replace_file_content` or `multi_replace_file_content` to apply fixes.

4. Verify Fixes
   Run the type checker again to verify that the errors are resolved and no new errors were introduced.
   // turbo
   `npx tsc --noEmit`

5. Repeat
   Repeat steps 2-4 until all error are resolved or the remaining errors are determined to be safe to ignore (and suppressed with `// @ts-ignore` or `// @ts-expect-error` if absolutely necessary and documented).
