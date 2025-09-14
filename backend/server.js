require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increase payload limit

// Initialize Gemini client
const ai = new GoogleGenAI({
  // API key is automatically picked from GEMINI_API_KEY environment variable
});

app.post("/api/recommend", async (req, res) => {
  const { products, prompt } = req.body;

  if (!products || !prompt) {
    return res.status(400).json({ error: "Missing products or prompt" });
  }

  // transform products to context string
  const productContext = products
    .map(
      (p) =>
        `ID: ${p.id}, Title: ${p.title}, Description: ${p.description}, Category: ${p.productType}`
    )
    .join("\n");

  try {
    // Send request to Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [
        "You are a sophisticated algorithm that recommends furniture and determines design themes.",
        `Given these products:\n${productContext}\nUser desires: "${prompt}"\n\nReturn ONLY a JSON object with these two fields:\n1. "recommendedIds": array of top 15 product IDs\n2. "theme": one of these themes [cozy, modern, gothic, nature, urban] that best matches the user's prompt. If the user's prompt is nonsensical or hard to decipher, stick with "cozy".\n\nExample format: {"recommendedIds": ["id1", "id2"], "theme": "modern"}`,
      ],
    });

    // Parse the JSON response, removing markdown formatting if present
    let responseText = response.text.trim();

    // Remove markdown code blocks if present
    if (responseText.startsWith("```json")) {
      responseText = responseText
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "");
    } else if (responseText.startsWith("```")) {
      responseText = responseText
        .replace(/```\s*/g, "")
        .replace(/```\s*$/g, "");
    }

    const parsedResponse = JSON.parse(responseText);

    // Extract and clean recommended IDs
    const recommendedIds = parsedResponse.recommendedIds.map((id) =>
      id.toString().split("/").pop()
    );

    // Validate theme
    const theme = parsedResponse.theme.toLowerCase();
    const validTheme = ["cozy", "modern", "gothic", "nature", "urban"].includes(
      theme
    )
      ? theme
      : "cozy";

    console.log("Theme detected:", validTheme);

    res.json({
      recommendedIds,
      theme: validTheme,
    });
  } catch (err) {
    console.error("Gemini request failed:", err);
    res.status(500).json({ error: "Gemini call failed" });
  }
});

let savedGrid = null;

app.post("/api/update-grid", (req, res) => {
  const { grid } = req.body;
  if (!grid) return res.status(400).json({ error: "Missing grid data" });

  savedGrid = grid; // persist in memory
  console.log("Grid updated:", savedGrid);
  res.json({ success: true });
});

app.get("/api/get-grid", (req, res) => {
  res.json({ grid: savedGrid || [] });
});

app.post("/api/send-data", (req, res) => {
  // Sends the Data in Batches
  res.send({
    data: [
      { id: 1, column_num: 2 },
      { id: 2, column_num: 4 },
    ],
  });
});

app.listen(4000, () => console.log("Server running on http://localhost:4000"));
