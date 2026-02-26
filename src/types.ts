export type Language = 'java' | 'cpp' | 'python' | 'javascript';

export interface Question {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  description: string;
  constraints: string[];
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  starterCode: Record<Language, string>;
  solution: {
    approaches: {
      name: string;
      description: string;
      complexity: {
        time: string;
        space: string;
      };
      code: string;
    }[];
  };
  hints: string[];
}

export interface TestSession {
  id: string;
  questions: Question[];
  currentQuestionIndex: number;
  userCodes: Record<string, Record<Language, string>>; // questionId -> language -> code
  language: Language;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
