import { GoogleGenAI, Type } from "@google/genai";
import { Language, Question } from "./types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Check localStorage first for user-provided key
    const customKey = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_GEMINI_API_KEY') : null;
    const apiKey = customKey || process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("API_KEY_MISSING");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

const MODEL_NAME = "gemini-3-flash-preview"; 

const questionSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    difficulty: { type: Type.STRING },
    topic: { type: Type.STRING },
    description: { type: Type.STRING },
    constraints: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    examples: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          input: { type: Type.STRING },
          output: { type: Type.STRING },
          explanation: { type: Type.STRING }
        }
      }
    },
    starterCode: {
      type: Type.OBJECT,
      properties: {
        java: { type: Type.STRING },
        cpp: { type: Type.STRING },
        python: { type: Type.STRING },
        javascript: { type: Type.STRING }
      }
    },
    solution: {
      type: Type.OBJECT,
      properties: {
        approaches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              complexity: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  space: { type: Type.STRING }
                }
              },
              code: { type: Type.STRING }
            }
          }
        }
      }
    },
    hints: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["id", "title", "difficulty", "topic", "description", "starterCode", "solution", "hints"]
};

export async function generateMockTest(topic: string, count: number = 3): Promise<Question[]> {
  try {
    console.log(`Generating mock test for topic: ${topic}`);
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: `Generate a mock test with ${count} DSA questions on the topic "${topic}". 
      Focus on interview preparation. Ensure questions are LeetCode style.
      Include starter code for Java, C++, Python, and JavaScript.
      Provide 3 detailed solution approaches (e.g., Brute Force, Optimized, Most Optimal) with code for each.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: questionSchema
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error in generateMockTest:", error);
    throw error;
  }
}

export async function fetchSingleQuestionByTitle(title: string, index: number, total: number): Promise<Question> {
  try {
    console.log(`Fetching details for question: ${title} (${index + 1}/${total})`);
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: `Identify the DSA question titled "${title}". 
      Provide full details in LeetCode style.
      Include starter code for Java, C++, Python, and JavaScript.
      Provide 3 detailed solution approaches with code for each.
      
      CRITICAL INSTRUCTIONS:
      1. Use proper line breaks (\\n) in all code strings.
      2. Format the response as a single JSON object matching the Question schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error in fetchSingleQuestionByTitle:", error);
    throw error;
  }
}

export async function runCodeMock(code: string, language: Language, question: Question) {
  try {
    console.log(`Running code mock for question: ${question.title}`);
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: `Act as a code execution engine. 
      Question: ${question.title}
      Description: ${question.description}
      Examples: ${JSON.stringify(question.examples)}
      User Code (${language}):
      ${code}
      
      Evaluate if the code is correct for the given examples. 
      Return a JSON object with:
      - status: "Accepted" or "Wrong Answer" or "Runtime Error"
      - results: array of { exampleIndex, passed, actualOutput, expectedOutput, consoleLog }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  exampleIndex: { type: Type.NUMBER },
                  passed: { type: Type.BOOLEAN },
                  actualOutput: { type: Type.STRING },
                  expectedOutput: { type: Type.STRING },
                  consoleLog: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error in runCodeMock:", error);
    throw error;
  }
}

export async function generateSingleQuestion(topic: string, index: number, total: number): Promise<Question> {
  try {
    console.log(`Generating question ${index + 1}/${total} for topic: ${topic}`);
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: `Generate a high-quality LeetCode-style DSA question for an interview.
      Topic: ${topic}
      Question Number: ${index + 1} of ${total}
      
      CRITICAL INSTRUCTIONS:
      1. Use proper line breaks (\\n) in all code strings. Do not collapse code into a single line.
      2. Provide a clear, concise description.
      3. Include starter code for Java, C++, Python, and JavaScript.
      4. Provide 3 detailed solution approaches (Brute Force, Optimized, Most Optimal).
      5. Each approach must have:
         - A step-by-step explanation.
         - Complexity analysis.
         - Clean, commented code with proper indentation and line breaks.
      
      Format the response as a single JSON object matching the Question schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error in generateSingleQuestion:", error);
    throw error;
  }
}

export async function translateSolution(question: Question, targetLanguage: string): Promise<string> {
  try {
    console.log(`Translating solution for ${question.title} to ${targetLanguage}`);
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: `Translate the following DSA solutions into ${targetLanguage}.
      Question: ${question.title}
      Solutions: ${JSON.stringify(question.solution.approaches)}
      
      CRITICAL: 
      - Maintain proper line breaks (\\n) and indentation.
      - Add helpful comments in ${targetLanguage} explaining the logic.
      - Return the result as a Markdown string with headers for each approach.`,
    });

    return response.text || "Translation failed.";
  } catch (error) {
    console.error("Error in translateSolution:", error);
    return "Failed to translate solution.";
  }
}

export async function getLearningContent(language: string, topic: string) {
  try {
    console.log(`Generating deep learning content for ${language} - ${topic}`);
    // We'll make a more detailed prompt to encourage more content
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: `You are a world-class technical instructor. Create an extensive, practical learning module for "${topic}" in "${language}".
      
      STRUCTURE:
      1. **Executive Summary**: Why this topic matters in real-world engineering.
      2. **Deep Dive Theory**: Explain the "Why" and "How" with clear analogies.
      3. **Syntax & Patterns**: Show the standard way to implement this in ${language}.
      4. **PRACTICAL EXAMPLES (The Core)**: 
         - Provide at least 3 distinct, real-world code examples.
         - Example 1: Basic/Introductory.
         - Example 2: Intermediate/Common Use Case.
         - Example 3: Advanced/Performance Optimized.
         - All code must have extensive line-by-line comments and proper line breaks.
      5. **Interview Corner**: 
         - Top 5 interview questions on this topic.
         - How to spot this pattern in a problem description.
      6. **Hands-on Lab**: A challenging exercise for the user to try.
      
      Format in rich Markdown with clear headings and high-quality code blocks.`,
    });

    return response.text || "Failed to generate content.";
  } catch (error) {
    console.error("Error in getLearningContent:", error);
    throw error;
  }
}

export async function getExpertAdvice(message: string, context?: string) {
  try {
    const response = await getAI().models.generateContent({
      model: MODEL_NAME,
      contents: `You are a Principal Engineer and Lead Interviewer at a Tier-1 Tech company. 
      Provide a deep-dive, practical response to: "${message}"
      ${context ? `Current Context: ${context}` : ""}
      
      REQUIREMENTS:
      - Be extremely detailed and practical.
      - Use real-world engineering examples.
      - Include code snippets or architectural diagrams (in text/mermaid) if applicable.
      - Break down complex strategies into actionable steps.
      - Focus on both technical correctness and communication skills.
      
      Format in professional Markdown.`,
    });

    return response.text || "Expert is currently unavailable.";
  } catch (error) {
    console.error("Error in getExpertAdvice:", error);
    throw error;
  }
}
