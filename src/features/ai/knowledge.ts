import documents from "../../../services/ai/knowledge.json";
export const publicKnowledge=documents;
export type KnowledgeSource=(typeof documents)[number];
