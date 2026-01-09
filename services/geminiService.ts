
import { GoogleGenAI, Type, Modality, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { ChatMode, MineLocation, SiteSafety, SiteWeather, SiteVideo } from "../types";

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

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

const SYSTEM_INSTRUCTION = `You are a world-class Mining Geologist, Claims Specialist, and Field Safety Officer. 

CORE MISSION:
Analyze the specific mine locality, claim, or district provided by the user.

CRITICAL PROTOCOLS:
1. Focus research on coordinates and site names.
2. For ownership, check BLM records and county recorders.
3. For safety, identify specific environmental and physical hazards (shafts, rattlesnakes, flash flood zones).
4. For weather, provide local conditions and accessibility advice.
5. For media, find YouTube links that showcase exploration or history of the area.
6. Always cite sources.`;

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateChatResponse(
    message: string,
    mode: ChatMode,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [],
    contextLocality?: MineLocation
  ): Promise<{ text: string; links?: { title: string; uri: string }[] }> {
    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }]
    };

    let contextHeader = "";
    if (contextLocality) {
      contextHeader = `[ACTIVE LOCALITY CONTEXT]
Site Name: ${contextLocality.name}
Coordinates: ${contextLocality.coordinates.lat}, ${contextLocality.coordinates.lng}
Description: ${contextLocality.description.substring(0, 300)}
---
User Question: `;
    }

    const finalPrompt = contextHeader + message;
    const contents: any[] = [...history, { role: 'user', parts: [{ text: finalPrompt }] }];

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: config
      });

      let text = response.text || "";
      let links: { title: string; uri: string }[] = [];

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        links = chunks.map((c: any) => ({
          title: c.web?.title || 'Geological Resource',
          uri: c.web?.uri || ''
        })).filter((l: any) => l.uri);
      }

      return { text: text, links: links };
    } catch (err) {
      console.error("Gemini API Error:", err);
      return { text: "Error accessing claim records.", links: [] };
    }
  }

  async fetchSafetyInfo(loc: MineLocation): Promise<SiteSafety> {
    const prompt = `Research safety hazards and emergency services for "${loc.name}" at coordinates ${loc.coordinates.lat}, ${loc.coordinates.lng}. Include physical mine hazards (shafts), environmental hazards, and the nearest major hospital name. Return JSON.`;
    const schema = {
      type: Type.OBJECT,
      properties: {
        hazardLevel: { type: Type.STRING, description: "Low, Moderate, High, or Extreme" },
        hazards: { type: Type.ARRAY, items: { type: Type.STRING } },
        emergencyServices: { type: Type.STRING, description: "Nearest hospital name and city" }
      },
      required: ["hazardLevel", "hazards", "emergencyServices"]
    };
    return await this.generateStructuredResponse(prompt, schema);
  }

  async fetchWeatherInfo(loc: MineLocation): Promise<SiteWeather> {
    const prompt = `Provide current weather and 3-day trend for coordinates ${loc.coordinates.lat}, ${loc.coordinates.lng} near "${loc.name}". Include the best months for visiting this specific terrain. Return JSON.`;
    const schema = {
      type: Type.OBJECT,
      properties: {
        current: { type: Type.STRING },
        forecast: { type: Type.STRING },
        bestVisitTime: { type: Type.STRING }
      },
      required: ["current", "forecast", "bestVisitTime"]
    };
    return await this.generateStructuredResponse(prompt, schema);
  }

  async fetchYoutubeVideos(loc: MineLocation): Promise<SiteVideo[]> {
    const prompt = `Find 3 relevant YouTube exploration, history, or geological videos for the area of "${loc.name}" or its mining district. Coordinates: ${loc.coordinates.lat}, ${loc.coordinates.lng}. Return a JSON array of objects with title and url.`;
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING }
        },
        required: ["title", "url"]
      }
    };
    return await this.generateStructuredResponse(prompt, schema);
  }

  async generateStructuredResponse(
    prompt: string,
    schema: any
  ): Promise<any> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
      
      return JSON.parse(response.text?.trim() || "[]");
    } catch (error) {
      console.error("Structured Response Error:", error);
      return Array.isArray(schema.items) ? [] : {};
    }
  }

  async speakText(text: string): Promise<void> {
    try {
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
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (e) {
      console.error("TTS Error", e);
    }
  }
}
