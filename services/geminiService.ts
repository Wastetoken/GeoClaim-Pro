
import { GoogleGenAI, Type, Modality, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { ChatMode } from "../types";

// Helper for decoding base64 audio data
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper for decoding raw PCM bytes to AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const findLocalitiesNearbyDeclaration: FunctionDeclaration = {
  name: 'findLocalitiesNearby',
  parameters: {
    type: Type.OBJECT,
    description: 'Find mine localities within a specific area and radius from the local dataset.',
    properties: {
      latitude: { type: Type.NUMBER, description: 'The latitude of the center point.' },
      longitude: { type: Type.NUMBER, description: 'The longitude of the center point.' },
      radiusMiles: { type: Type.NUMBER, description: 'The radius in miles to search (default 20).' },
      locationName: { type: Type.STRING, description: 'The name of the town or area requested.' }
    },
    required: ['latitude', 'longitude'],
  },
};

const SYSTEM_INSTRUCTION = `You are a world-class Mining Geologist and Historical Researcher. 
Your goal is to provide accurate, deep analysis of mine localities in the USA.

RULES FOR SEARCH & GROUNDING:
1. When a user asks for "Geo-Reasoning" or "Mineralogy", conduct a deep search for USGS mineral reports and geological surveys for the specific coordinates or locality name.
2. If searching for safety or weather, find CURRENT localized reports for that specific terrain (mountains, desert, etc).
3. ALWAYS cite your sources. If the search tool returns data, incorporate it into a helpful narrative.
4. If you find YouTube videos or documentaries of the specific mine site, list them as high-priority resources.`;

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateChatResponse(
    message: string,
    mode: ChatMode,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [],
    image?: string
  ): Promise<{ text: string; links?: { title: string; uri: string }[]; functionCalls?: any[] }> {
    const modelMapping = {
      [ChatMode.NORMAL]: 'gemini-3-flash-preview',
      [ChatMode.THINKING]: 'gemini-3-pro-preview',
      [ChatMode.SEARCH]: 'gemini-3-flash-preview',
      [ChatMode.MAPS]: 'gemini-2.5-flash',
      [ChatMode.LITE]: 'gemini-flash-lite-latest',
    };

    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION
    };
    const modelName = modelMapping[mode];

    if (mode === ChatMode.THINKING) {
      config.thinkingConfig = { thinkingBudget: 24576 };
    }

    if (mode === ChatMode.SEARCH || mode === ChatMode.NORMAL || mode === ChatMode.THINKING) {
      config.tools = [{ googleSearch: {} }];
    } else if (mode === ChatMode.MAPS) {
      config.tools = [{ functionDeclarations: [findLocalitiesNearbyDeclaration] }];
    }

    const contents: any[] = [...history];
    const userParts: any[] = [{ text: message }];

    if (image) {
      userParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: image.split(',')[1]
        }
      });
    }

    contents.push({ role: 'user', parts: userParts });

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config
      });

      // Robust response parsing
      let text = response.text || "";
      
      // Fallback: If text is empty but candidates exist, try to find text in parts
      if (!text && response.candidates?.[0]?.content?.parts) {
        text = response.candidates[0].content.parts
          .filter(p => p.text)
          .map(p => p.text)
          .join('\n');
      }

      const functionCalls = response.functionCalls;
      let links: { title: string; uri: string }[] = [];

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        links = chunks.map((c: any) => ({
          title: c.web?.title || c.maps?.title || 'Geological Resource',
          uri: c.web?.uri || c.maps?.uri || ''
        })).filter((l: any) => l.uri);
      }

      // If we have links but no text, generate a fallback message
      if (!text && links.length > 0) {
          text = "I have successfully gathered geological and safety records for this site. You can access the specific research links below.";
      }

      return { text: text, links: links, functionCalls: functionCalls };
    } catch (err) {
      console.error("Gemini API Error:", err);
      return { text: "The geological database connection was interrupted. This usually happens if the search query is too specific for the current model. Try a broader location name.", links: [] };
    }
  }

  async speakText(text: string): Promise<void> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
      const source = outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContext.destination);
      source.start();
    }
  }
}
