# Tasks

## Provider Usage Schema

* [ ] Define provider-neutral usage schema.
* [ ] Record token source for every measurement.
* [ ] Capture provider-reported input tokens.
* [ ] Capture provider-reported output tokens.
* [ ] Capture provider-reported total tokens.
* [ ] Capture cached/reasoning token fields when available.

## Runner

* [ ] Implement real-model runner interface.
* [ ] Implement provider adapter boundary.
* [ ] Implement baseline execution.
* [ ] Implement WAM execution.
* [ ] Implement paired-run state reset.
* [ ] Generate unique pair IDs.

## WAM Event Provenance

* [ ] Capture WAM snapshot events.
* [ ] Capture WAM fast-path events.
* [ ] Capture context rebuild events.
* [ ] Capture partial/full rebuild events.
* [ ] Capture verification events.

## Verification

* [ ] Implement completion verification.
* [ ] Implement requirement verification.

## Repeated Runs

* [ ] Implement repeated paired runs.
* [ ] Implement min/p25/median/p75/max.
* [ ] Preserve negative savings.
* [ ] Implement exclusion reasons.

## Provenance

* [ ] Record actual Git SHA.
* [ ] Record dirty-tree state.
* [ ] Record model/provider configuration.
* [ ] Record scenario/runner/analyzer versions.

## Evidence Artifacts

* [ ] Implement raw evidence persistence.
* [ ] Implement summary generation from raw evidence.
* [ ] Implement report generation from raw evidence.
* [ ] Implement real-model evidence charts.

## Tests

* [ ] Add tests for provider usage normalization.
* [ ] Add tests for missing provider usage.
* [ ] Add tests for failed verification.
* [ ] Add tests for negative savings.
* [ ] Add tests for dirty-tree provenance.
* [ ] Add deterministic raw-to-summary reproducibility test.

## Documentation & Evidence

* [ ] Document real-model benchmark invocation.
* [ ] Document provider requirements.
* [ ] Run at least five paired executions for the first real evidence set.
