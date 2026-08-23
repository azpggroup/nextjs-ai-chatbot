#!/usr/bin/env node
/**
 * Generate an ILLUSTRATIVE cover/info slide for a carousel post (not a real product photo).
 * Sends the brand logo inline as base64 and asks Gemini to compose a designed graphic slide
 * around it. Real product photos are never touched by this script — only the logo is used
 * as reference input.
 *
 * Usage:
 *   node scripts/gemini-cover-slide.js <logo-path> <output-image-path> <project-name> [subtitle]
 *
 * Requires GEMINI_API_KEY in the environment.
 */

const fs = require("node:fs");
const path = require("node:path");

const MODEL = "gemini-2.5-flash-image";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function buildPrompt(projectName, subtitle) {
  return `
You are designing a cover slide (slide 1 of a social media carousel) for "Đại Chúng Properties",
a quiet-luxury Vietnamese real estate brand. This is a DESIGN GRAPHIC, not a real estate photo —
do not depict any building, room, or architecture.

Use the attached logo EXACTLY as provided (do not redraw, distort, or recolor it) and place it
tastefully within the composition.

Composition:
- Background: elegant abstract/minimal composition using the brand palette — charcoal black,
  champagne gold / bronze accents, ivory white, deep navy blue. Think subtle gradients, fine gold
  linework, generous negative space. No photographic imagery, no people, no building renders.
- Place the logo in a clear focal position (e.g. upper area or centered), with breathing room
  around it.
- Below or near the logo, render the project name "${projectName}" in large, elegant serif or
  thin sans-serif typography, ivory or champagne gold color, properly centered and fully legible
  (no spelling mistakes, no distorted letters).
${subtitle ? `- Below the project name, add a smaller line of text: "${subtitle}" in a refined, understated style.` : ""}
- Square format (1:1), suitable for Instagram/Facebook carousel.
- Overall mood: quiet luxury, editorial, understated — not flashy, no slogans, no price mentions,
  no stock-photo clichés.

Output one final designed image only.
`.trim();
}

async function main() {
  const [, , logoPath, outputPath, projectName, subtitle] = process.argv;

  if (!logoPath || !outputPath || !projectName) {
    console.error(
      "Usage: node scripts/gemini-cover-slide.js <logo-path> <output-image-path> <project-name> [subtitle]"
    );
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    process.exit(1);
  }

  const absLogo = path.resolve(logoPath);
  const logoBuffer = fs.readFileSync(absLogo);
  const base64Logo = logoBuffer.toString("base64");
  const mimeType = guessMimeType(absLogo);

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(projectName, subtitle) },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Logo,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  console.log(`Generating cover slide for "${projectName}" using ${MODEL}...`);

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

  console.log(`Saved cover slide to ${absOutput} (${outBuffer.length} bytes)`);
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
