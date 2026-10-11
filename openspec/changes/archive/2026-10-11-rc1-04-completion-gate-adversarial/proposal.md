# Change: Completion Gate Adversarial Cases

## Why
An agent can claim completion while state is incomplete; WAM must block false positives.

## What Changes
- Cases: claim=done with missing evidence -> NOT VERIFIED; claim=done with a required action missing -> NOT VERIFIED.
- Claims to test: Done, Completed, Finished, All good.

## Non-goals
- Trusting agent claims as verification.

## Expected Result
Every unverified completion claim is rejected by the completion gate.

## Validation
- [ ] Claim!= verified completion.
- [ ] Missing evidence -> NOT VERIFIED.
- [ ] Missing required action -> NOT VERIFIED.
- [ ] All four claim spellings covered.

## Program
- RC1 item: RC1-04 (C)
- Priority: P0
