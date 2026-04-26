// Wraps @agentic/llm so the rest of the codebase calls a single function.
// Also provides JSON-mode-flavored extraction: we instruct the model to
// produce a single fenced JSON block, then strip the fence before parsing.

import { createClient, type LLMClient } from "@agentic/llm";

export interface LlmCall {
    system: string;
    user: string;
    maxTokens?: number;
}

const MODEL_DIRECTOR =
    process.env.WORLD_MODEL_DIRECTOR ?? "minimax/MiniMax-M2.7";
const MODEL_CHARACTER =
    process.env.WORLD_MODEL_CHARACTER ?? "minimax/MiniMax-M2.7";
const MODEL_SCRIBE =
    process.env.WORLD_MODEL_SCRIBE ?? "minimax/MiniMax-M2.7";
const MODEL_GENESIS =
    process.env.WORLD_MODEL_GENESIS ?? "minimax/MiniMax-M2.7";

let _clients: Partial<Record<string, LLMClient>> = {};

function clientFor(modelString: string): LLMClient {
    const cached = _clients[modelString];
    if (cached) return cached;
    const c = createClient(modelString);
    _clients[modelString] = c;
    return c;
}

function modelIdFromString(modelString: string): string {
    const slash = modelString.indexOf("/");
    return slash >= 0 ? modelString.slice(slash + 1) : modelString;
}

async function callRaw(modelString: string, call: LlmCall): Promise<string> {
    const client = clientFor(modelString);
    const res = await client.createMessage({
        model: modelIdFromString(modelString),
        system: call.system,
        messages: [{ role: "user", content: call.user }],
        tools: [],
        maxTokens: call.maxTokens ?? 2048,
    });
    const text = res.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("");
    return text.trim();
}

const FENCE = /```(?:json)?\s*([\s\S]*?)\s*```/;

export function extractJson(raw: string): unknown {
    // Accept either a fenced block or a bare JSON object/array.
    const trimmed = raw.trim();
    let candidate = trimmed;
    const m = trimmed.match(FENCE);
    if (m && m[1]) {
        candidate = m[1];
    } else {
        // Find the first { or [ and the matching last } or ]. Crude but tolerant.
        const firstObj = trimmed.indexOf("{");
        const firstArr = trimmed.indexOf("[");
        let start = -1;
        if (firstObj === -1) start = firstArr;
        else if (firstArr === -1) start = firstObj;
        else start = Math.min(firstObj, firstArr);
        if (start === -1) {
            throw new Error(`No JSON found in model output:\n${raw}`);
        }
        const open = trimmed[start];
        const close = open === "{" ? "}" : "]";
        const end = trimmed.lastIndexOf(close);
        if (end <= start) {
            throw new Error(`Unbalanced JSON in model output:\n${raw}`);
        }
        candidate = trimmed.slice(start, end + 1);
    }
    try {
        return JSON.parse(candidate);
    } catch (err) {
        throw new Error(
            `Failed to parse JSON from model output: ${(err as Error).message}\n--- raw ---\n${raw}`,
        );
    }
}

export interface CallOpts {
    system: string;
    user: string;
    maxTokens?: number;
}

export const callDirector = (o: CallOpts) => callRaw(MODEL_DIRECTOR, o);
export const callCharacter = (o: CallOpts) => callRaw(MODEL_CHARACTER, o);
export const callScribe = (o: CallOpts) => callRaw(MODEL_SCRIBE, o);
export const callGenesis = (o: CallOpts) => callRaw(MODEL_GENESIS, o);
