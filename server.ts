import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
