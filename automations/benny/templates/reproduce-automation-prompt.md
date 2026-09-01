# Reproduce webhook instruction

After the trusted triage phase returns `[benny:bug]` or `[benny:performance]`, read `.amp/benny/configuration.yaml` and `.amp/benny/skills/reproduce-and-fix-issues/SKILL.md`. Preserve source coordinates. Require the configured app-control skill and feature map. Verify existing fixes without racing them. Attempt one bounded fix only after two real reproductions and before-and-after evidence. Open only a draft PR, and only when explicitly authorized.
