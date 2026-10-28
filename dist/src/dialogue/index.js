import {
  DIALOGUE_INTENTS,
  mergeObservations,
  normalizeObservation,
} from "./observation.js";
import { dialogueStateFromTask, normalizeDialogueState } from "./dialogue-state.js";
import { heuristicObserve } from "./heuristic-observer.js";
import { observeWithLlm } from "./llm-observer.js";
import { reduceDialogue } from "./reducer.js";

const DEFAULT_LLM_THRESHOLD = 0.75;

function shouldUseLlm(observation, threshold) {
  return (
    observation.intent === DIALOGUE_INTENTS.UNKNOWN ||
    observation.confidence < threshold ||
    observation.ambiguity === "high"
  );
}

export async function observeDialogueTurn({
  message,
  taskState,
  dictionary = null,
  complete = null,
  threshold = DEFAULT_LLM_THRESHOLD,
  timeoutMs = 2500,
  now = Date.now,
} = {}) {
  const dialogue = normalizeDialogueState(
    taskState?.dialogue || dialogueStateFromTask(taskState)
  );

  let cached = null;
  try {
    cached = dictionary?.get(message, taskState, dialogue) || null;
  } catch {
    cached = null;
  }

  let observation;
  let source;
  let learned = false;

  if (cached) {
    observation = normalizeObservation(cached);
    source = "dictionary";
  } else {
    const heuristic = heuristicObserve({ message, taskState });
    observation = heuristic;
    source = "heuristic";

    if (typeof complete === "function" && shouldUseLlm(heuristic, threshold)) {
      try {
        const llm = await observeWithLlm({
          message,
          taskState,
          dialogueState: dialogue,
          complete,
          timeoutMs,
        });
        if (llm) {
          observation = mergeObservations(llm, heuristic);
          source = "llm";
        }
      } catch {
        // The deterministic observer is always available.
      }
    }

    try {
      learned = Boolean(
        dictionary?.set(message, taskState, dialogue, observation, { source })
      );
    } catch {
      learned = false;
    }
  }

  const reduction = reduceDialogue(dialogue, observation, { taskState });
  return {
    ...reduction,
    state: { ...reduction.state, updatedAt: now() },
    source,
    learned,
  };
}
