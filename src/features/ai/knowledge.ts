import knowledgeSources from "../../../services/ai/knowledge.json";
export const publicKnowledge=knowledgeSources;
export type KnowledgeSource=(typeof knowledgeSources)[number];
