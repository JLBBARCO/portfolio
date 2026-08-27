import fs from 'fs';
import path from 'path';

// Função para converter buffer/imagem em cores predominantes (Node.js)
async function extractProfileColors(imageUrl) {
  // Exemplo de extração ou cálculo de cores a partir dos dados do buffer da imagem
  // Retorne um array de HEX de cores baseadas na sua regra
  return ['#121214', '#8257e5', '#e1e1e6']; 
}

export default async function handler(req, res) {
  // Autenticação para garantir que somente a Vercel chame esta rota
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Não autorizado');
  }

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const USERNAME = process.env.GITHUB_USERNAME;

    const headers = GITHUB_TOKEN ? { Authorization: `bearer ${GITHUB_TOKEN}` } : {};

    // 1. Busca perfil no GitHub
    const userRes = await fetch(`https://api.github.com/users/${USERNAME}`, { headers });
    const userData = await userRes.json();

    // 2. Busca repositórios / projetos
    const reposRes = await fetch(`https://api.github.com/users/${USERNAME}/repos?per_page=100`, { headers });
    const reposData = await reposRes.json();

    // 3. Extrai tecnologias únicas dos repositórios
    const languages = [...new Set(reposData.map(repo => repo.language).filter(Boolean))];

    // 4. Calcula as cores com base na foto de perfil obtida
    const profileColors = await extractProfileColors(userData.avatar_url);

    // Estrutura atualizada
    const payload = {
      profile: {
        avatar_url: userData.avatar_url,
        name: userData.name,
        bio: userData.bio,
        colors: profileColors
      },
      technologies: languages,
      projects: reposData.map(repo => ({
        name: repo.name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        language: repo.language
      })),
      updatedAt: new Date().toISOString()
    };

    // Salva o resultado no KV Storage da Vercel ou responde diretamente
    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
