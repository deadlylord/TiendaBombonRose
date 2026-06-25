import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API Description Generation Endpoint
  app.post('/api/gemini/generate-description', async (req, res) => {
    const { productName, imageUrl } = req.body;
    if (!productName) {
      return res.status(400).json({ error: 'El nombre del producto es requerido' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'No se encontró la clave de API de Gemini. Por favor, configúrala en el menú de Secrets del proyecto.' });
    }

    try {
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const parts: any[] = [{
        text: `Genera una descripción atractiva y muy breve para una tienda de ropa llamada "Bombon Store". 
        Producto actual: "${productName}". 
        Tono: Moderno y sofisticado. 
        Idioma: Español. 
        Instrucciones: 
        1. Analiza la imagen adjunta para destacar materiales, texturas, accesorios o detalles específicos que se vean.
        2. Sugiere un NOMBRE CORTO y llamativo para el producto (máximo 4 palabras).
        3. Genera una DESCRIPCIÓN de máximo 30 palabras en un solo párrafo.
        
        Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
        {
          "name": "nombre sugerido",
          "description": "descripción sugerida"
        }`
      }];

      if (imageUrl) {
        try {
          const responseImage = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const base64Data = Buffer.from(responseImage.data, 'binary').toString('base64');
          const mimeType = responseImage.headers['content-type'] || 'image/jpeg';
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType
            }
          });
        } catch (imageErr: any) {
          console.error("Error fetching image for Gemini:", imageErr.message || imageErr);
          // Continue without image if fetch fails
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction: "Eres un redactor experto en moda y branding. Tu tarea es generar un nombre corto y una descripción para productos de ropa. Responde siempre en formato JSON puro, sin markdown ni texto adicional.",
          responseMimeType: "application/json"
        },
        contents: [{ parts }]
      });

      if (!response.text) {
        return res.status(500).json({ error: 'La IA devolvió una respuesta vacía.' });
      }

      const cleanedText = response.text.trim();
      
      let nameSugerido = productName;
      let descSugerida = "Sin descripción generada.";

      try {
        const result = JSON.parse(cleanedText);
        nameSugerido = result.name || productName;
        descSugerida = result.description || descSugerida;
      } catch (e) {
        console.error("Error parsing AI JSON on server:", e);
        descSugerida = cleanedText;
      }

      res.json({ name: nameSugerido, description: descSugerida });
    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      res.status(500).json({ error: error.message || 'Error al generar descripción.' });
    }
  });

  // Instagram OAuth Routes
  app.get('/api/auth/instagram/url', (req, res) => {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/instagram/callback`;
    
    if (!clientId) {
      return res.status(500).json({ error: 'INSTAGRAM_CLIENT_ID not configured' });
    }

    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user_profile,user_media&response_type=code`;
    res.json({ url: authUrl });
  });

  app.get('/auth/instagram/callback', async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/instagram/callback`;

    if (!code) {
      return res.status(400).send('No code provided');
    }

    try {
      // 1. Exchange code for short-lived token
      const formData = new URLSearchParams();
      formData.append('client_id', clientId!);
      formData.append('client_secret', clientSecret!);
      formData.append('grant_type', 'authorization_code');
      formData.append('redirect_uri', redirectUri);
      formData.append('code', code as string);

      const tokenResponse = await axios.post('https://api.instagram.com/oauth/access_token', formData);
      const shortLivedToken = tokenResponse.data.access_token;

      // 2. Exchange for long-lived token
      const longLivedResponse = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: clientSecret,
          access_token: shortLivedToken
        }
      });

      const longLivedToken = longLivedResponse.data.access_token;

      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'INSTAGRAM_AUTH_SUCCESS', token: '${longLivedToken}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Autenticación exitosa con Instagram. Esta ventana se cerrará automáticamente.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Instagram Auth Error:', error.response?.data || error.message);
      res.status(500).send('Error during Instagram authentication');
    }
  });

  // Proxy for Instagram Media
  app.get('/api/instagram/media', async (req, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ error: 'No token provided' });

    try {
      const response = await axios.get('https://graph.instagram.com/me/media', {
        params: {
          fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
          access_token: token
        }
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
