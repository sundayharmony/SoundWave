// api/submit.js - Vercel Serverless Function
// Appends artist intake form data to Google Sheets using JWT auth

export const config = { runtime: 'edge' };

// Base64url encode
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }

      // Sign a JWT with RS256 using the service account private key
      async function getAccessToken() {
        const email = process.env.GOOGLE_CLIENT_EMAIL;
          const rawKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

            const pemBody = rawKey
                .replace('-----BEGIN PRIVATE KEY-----', '')
                    .replace('-----END PRIVATE KEY-----', '')
                        .replace(/\s/g, '');
                          const der = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

                            const key = await crypto.subtle.importKey(
                                'pkcs8', der.buffer,
                                    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                                        false, ['sign']
                                          );

                                            const now = Math.floor(Date.now() / 1000);
                                              const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
                                                const payload = b64url(new TextEncoder().encode(JSON.stringify({
                                                    iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets',
                                                        aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
                                                          })));

                                                            const sig = b64url(await crypto.subtle.sign(
                                                                'RSASSA-PKCS1-v1_5', key,
                                                                    new TextEncoder().encode(`${header}.${payload}`)
                                                                      ));

                                                                        const jwt = `${header}.${payload}.${sig}`;
                                                                          const res = await fetch('https://oauth2.googleapis.com/token', {
                                                                              method: 'POST',
                                                                                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                                                                      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
                                                                                        });
                                                                                          const { access_token } = await res.json();
                                                                                            return access_token;
                                                                                            }

                                                                                            export default async function handler(req) {
                                                                                              if (req.method === 'OPTIONS') {
                                                                                                  return new Response(null, {
                                                                                                        headers: {
                                                                                                                'Access-Control-Allow-Origin': '*',
                                                                                                                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                                                                                                                                'Access-Control-Allow-Headers': 'Content-Type'
                                                                                                                                      }
                                                                                                                                          });
                                                                                                                                            }

                                                                                                                                              if (req.method !== 'POST') {
                                                                                                                                                  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                                                                                                                                                        status: 405, headers: { 'Content-Type': 'application/json' }
                                                                                                                                                            });
                                                                                                                                                              }

                                                                                                                                                                try {
                                                                                                                                                                    const data = await req.json();
                                                                                                                                                                        const sheetId = process.env.GOOGLE_SHEET_ID;
                                                                                                                                                                            const token = await getAccessToken();

                                                                                                                                                                                const row = [
                                                                                                                                                                                      new Date().toISOString(),
                                                                                                                                                                                            data.firstName, data.lastName, data.stageName, data.groupName,
                                                                                                                                                                                                  data.artistType, data.email, data.phone, data.city, data.age,
                                                                                                                                                                                                        data.instagram, data.tiktok, data.streamLink, data.website, data.followers,
                                                                                                                                                                                                              data.genre, data.genreTags, data.experience, data.perfStyle, data.instruments,
                                                                                                                                                                                                                    data.bio,
                                                                                                                                                                                                                          data.song1, data.song1Credit, data.song2, data.song2Credit,
                                                                                                                                                                                                                                data.song3, data.song3Credit, data.song4, data.song4Credit,
                                                                                                                                                                                                                                      data.explicit, data.heardAbout, data.recurring, data.notes
                                                                                                                                                                                                                                          ];

                                                                                                                                                                                                                                              const appendRes = await fetch(
                                                                                                                                                                                                                                                    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
                                                                                                                                                                                                                                                          {
                                                                                                                                                                                                                                                                  method: 'POST',
                                                                                                                                                                                                                                                                          headers: {
                                                                                                                                                                                                                                                                                    'Authorization': `Bearer ${token}`,
                                                                                                                                                                                                                                                                                              'Content-Type': 'application/json'
                                                                                                                                                                                                                                                                                                      },
                                                                                                                                                                                                                                                                                                              body: JSON.stringify({ values: [row] })
                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                        );

                                                                                                                                                                                                                                                                                                                            if (!appendRes.ok) {
                                                                                                                                                                                                                                                                                                                                  const err = await appendRes.text();
                                                                                                                                                                                                                                                                                                                                        throw new Error(err);
                                                                                                                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                                                                                                                                return new Response(JSON.stringify({ success: true }), {
                                                                                                                                                                                                                                                                                                                                                      headers: {
                                                                                                                                                                                                                                                                                                                                                              'Content-Type': 'application/json',
                                                                                                                                                                                                                                                                                                                                                                      'Access-Control-Allow-Origin': '*'
                                                                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                                                                });
                                                                                                                                                                                                                                                                                                                                                                                  } catch (e) {
                                                                                                                                                                                                                                                                                                                                                                                      return new Response(JSON.stringify({ error: e.message }), {
                                                                                                                                                                                                                                                                                                                                                                                            status: 500,
                                                                                                                                                                                                                                                                                                                                                                                                  headers: {
                                                                                                                                                                                                                                                                                                                                                                                                          'Content-Type': 'application/json',
                                                                                                                                                                                                                                                                                                                                                                                                                  'Access-Control-Allow-Origin': '*'
                                                                                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                                                                            });
                                                                                                                                                                                                                                                                                                                                                                                                                              }
                                                                                                                                                                                                                                                                                                                                                                                                                              }