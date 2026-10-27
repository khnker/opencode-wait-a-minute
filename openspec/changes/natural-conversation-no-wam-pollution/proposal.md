# Natural Conversation and Zero WAM Pollution

## Why

WAM currently injects intrusive `[wam]` prefixes, phase updates, and repetitive status counters into every chat turn, causing high friction and making interactions feel robotic and non-natural.

## What Changes

- Suppress all intrusive `[wam]` text injections into user-facing chat parts during conversational turns.
- Silence verbose status counters, N0/N1/N2 headers, and rigid contract barriers unless explicitly requested or during final summaries.
- Ensure the assistant interacts naturally and directly without chat pollution.

## Non-Goals

- Does not disable core state tracking, persistence, or telemetry behind the scenes.
