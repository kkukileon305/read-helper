import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';

const SYSTEM_PROMPT = `
You are an expert Taiwanese Mandarin teacher. 
Your task is to analyze the provided Traditional Chinese text and identify vocabulary words that a learner might find difficult.
Constraints:
1. Ignore any non-Traditional Chinese characters. 
2. The context is strictly Taiwanese Mandarin.
3. For each difficult word, provide its Bopomofo (Zhuyin Fuhao - ㄅㄆㄇㄈ) pronunciation. You MUST NOT use Hanyu Pinyin.
4. Provide the Korean translation/meaning for each difficult word.
5. Return the analysis as a JSON object strictly following the schema below.
6. The \`analyzed_text\` should be an array of segments that fully reconstruct the original input when combined. Regular, easy text gets \`type: "text"\`, and the difficult vocabulary gets \`type: "word"\`.

JSON Schema:
{
  "analyzed_text": [
    { "type": "text", "content": "這是" },
    { "type": "word", "word": "蘋果", "zhuyin": "ㄆㄧㄥˊ ㄍㄨㄛˇ", "meaning": "사과" }
  ]
}
`;

export async function POST({ request }) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string') {
      return json({ error: 'Valid text is required' }, { status: 400 });
    }

    const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return json({ error: 'API key not configured on server' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text }] }],
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return json(data);
  } catch (error) {
    console.error('Gemini API Error:', error);
    return json({ error: 'Failed to analyze text' }, { status: 500 });
  }
}
