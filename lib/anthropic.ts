import { anthropic } from "@ai-sdk/anthropic";

export const RESEARCH_MODEL = anthropic("claude-sonnet-4-6");

export const RESEARCH_SYSTEM_PROMPT = `You are a research assistant for AI/ML topics. Answer the user's question clearly and concisely. Be specific and technical.`;
