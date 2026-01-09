
import { GoogleGenAI, Type, Modality, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { ChatMode, MineLocation } from "../types";

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

const SYSTEM_INSTRUCTION = `You are a world-class Mining Geologist, Claims Specialist, and Historical Researcher. 

CORE MISSION:
Analyze the specific mine locality or claim provided by the user. 

CRITICAL PROTOCOLS:
1. When a locality is provided in the context, focus ALL research and grounding on that specific site (Coordinates, Name).
2. For ownership queries, use Google Search grounding to look for:
   - BLM (Bureau of Land Management) LR2000/MLRS records.
   - County recorder records for the specific Lat/Lng provided.
   - Historical USGS bulletins (e.g., "USGS Mineral Resources of the US").
3. Always report active vs abandoned status if found in recent news or data.
4. Cite sources with specific URLs.
5. If the user refers to "this claim" or "this site", refer to the 'ACTIVE LOCALITY CONTEXT' provided in the message.`;

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

    // Construct the context string if a locality is selected
    let contextHeader = "";
    if (contextLocality) {
      contextHeader = `[ACTIVE LOCALITY CONTEXT]
Site Name: ${contextLocality.name}
Coordinates: ${contextLocality.coordinates.lat}, ${contextLocality.coordinates.lng}
Description: ${contextLocality.description.substring(0, 300)}
---
User Question: `;
    }

    // Only prepend context if the history is empty or it's a new context focus
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
      return { text: "Error accessing claim database records.", links: [] };
    }
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
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
      
      return JSON.parse(response.text?.trim() || "[]");
    } catch (error) {
      console.error("Structured Response Error:", error);
      throw error;
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
