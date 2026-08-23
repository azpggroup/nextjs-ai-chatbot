#!/usr/bin/env node
/**
 * Enhance a real product photo using Gemini 2.5 Flash Image (Nano Banana).
 * Sends the source image inline as base64 — no third-party image hosting involved.
 *
 * Usage:
 *   node scripts/gemini-image-enhance.js <input-image-path> <output-image-path> [extra-style-notes]
 *
 * Requires GEMINI_API_KEY in .env (loaded from process.env; run with `node --env-file=.env` or export manually).
 */

const fs = require("node:fs");
const path = require("node:path");

const MODEL = "gemini-2.5-flash-image";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const BRAND_STYLE_PROMPT = `
You are enhancing a real estate marketing photo for "Đại Chúng Properties", a quiet-luxury Vietnamese real estate brand.

STRICT RULES:
- Keep the real architecture, interior layout, furniture, and structure EXACTLY as shown in the source photo. Do not add, remove, or redesign any structural or furniture elements.
- Do NOT invent new rooms, views, people, or objects that are not in the original photo.
- Only enhance: lighting quality, color grading, atmosphere, and overall polish.

STYLE DIRECTION (from brand guideline):
- Color palette: charcoal black, champagne gold / bronze accents, ivory white, deep navy blue.
- Lighting: warm, natural, golden-hour quality light; soft shadows; avoid harsh flat lighting.
- Mood: quiet luxury — calm, spacious, understated elegance. Not flashy, not oversaturated.
- Sharpen clarity and remove noise/haze while keeping the image photorealistic (not illustrated, not AI-plastic looking).
- Subtle warm glow on surfaces (marble, water, glass) to convey premium quality.

Output one enhanced photorealistic image only.
`.trim();

async function main() {
  const [, , inputPath, outputPath, extraNotes] = process.argv;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: node scripts/gemini-image-enhance.js <input-image-path> <output-image-path> [extra-style-notes]"
    );
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    process.exit(1);
  }

  const absInput = path.resolve(inputPath);
  const imageBuffer = fs.readFileSync(absInput);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = guessMimeType(absInput);

  const promptText = extraNotes
    ? `${BRAND_STYLE_PROMPT}\n\nADDITIONAL NOTES FOR THIS IMAGE:\n${extraNotes}`
    : BRAND_STYLE_PROMPT;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  console.log(`Sending ${absInput} (${imageBuffer.length} bytes) to ${MODEL}...`);

  const res = await fetch(`${API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini API error ${res.status}: ${errText}`);
    process.exit(1);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData || p.inline_data);
  const inlineData = imagePart?.inlineData ?? imagePart?.inline_data;

  if (!inlineData?.data) {
    console.error("No image returned by Gemini. Full response:");
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const outBuffer = Buffer.from(inlineData.data, "base64");
  const absOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absOutput), { recursive: true });
  fs.writeFileSync(absOutput, outBuffer);

  console.log(`Saved enhanced image to ${absOutput} (${outBuffer.length} bytes)`);
}

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
