#!/usr/bin/env bash
set -euo pipefail

printf 'model\tthread\tblocked_claim_in_title\tsuccessful_results\terror_results\n'
while read -r model thread; do
	amp threads export "$thread" | jq -r --arg model "$model" --arg thread "$thread" '
		.messages as $messages
		| [$messages[] | .content[]? | select(.type == "tool_result") | .run.status] as $results
		| [
			$model,
			$thread,
			(.title | test("blocked|not readable|cannot.*(read|access|call)"; "i")),
			($results | map(select(. == "done")) | length),
			($results | map(select(. == "error")) | length)
		] | @tsv'
done <<'THREADS'
xai/grok-4.7 T-01a0d470-cd36-76cc-ba85-489102adc34a
xai/grok-4.7 T-01a0d470-cdc4-75c9-ba98-0b83e0d1d448
xai/grok-4.7 T-01a0d483-3191-72d4-91eb-53a1ccf924da
xai/grok-4.7 T-01a0d484-96f3-774a-8ae2-317438720e6b
anthropic/claude-opus-5-5 T-01a0d473-2f07-77b4-b722-1c9b2049d0ed
anthropic/claude-opus-5-5 T-01a0d486-fb43-7169-8054-fbd55d4e5a8f
THREADS
