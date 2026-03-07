// /api/screenshot.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    // Chama a API do Microlink para obter a screenshot
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
    const response = await fetch(microlinkUrl);

    if (!response.ok) {
      throw new Error("Failed to fetch from Microlink");
    }

    const data = await response.json();
    const screenshotUrl = data.data?.screenshot?.url;

    if (!screenshotUrl) {
      throw new Error("Screenshot URL not found");
    }

    // Fetch a imagem da URL fornecida pelo Microlink
    const imageResponse = await fetch(screenshotUrl);

    if (!imageResponse.ok) {
      throw new Error("Failed to fetch screenshot image");
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Define headers para retornar a imagem
    res.setHeader(
      "Content-Type",
      imageResponse.headers.get("content-type") || "image/png",
    );
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate"); // Cache por 1 hora

    return res.status(200).send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error("Error generating screenshot:", error);
    return res.status(500).json({ error: "Failed to generate screenshot" });
  }
}
