# Design: Completion Gate Adversarial Cases

## Approach
An agent can claim completion while state is incomplete; WAM must block false positives.

## Scope
- Cases: claim=done with missing evidence -> NOT VERIFIED; claim=done with a required action missing -> NOT VERIFIED.
- Claims to test: Done, Completed, Finished, All good.

## Validation Strategy
- Claim!= verified completion.
- Missing evidence -> NOT VERIFIED.
- Missing required action -> NOT VERIFIED.
- All four claim spellings covered.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
