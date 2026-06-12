const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
// Derive from the current origin so the same build works locally
// (http://127.0.0.1:5173) and in production (https://<app>.vercel.app).
const REDIRECT_URI = `${window.location.origin}/callback`;

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ');

// --- PKCE helpers ---

function base64urlEncode(buf) {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr);
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

// --- Auth ---

export async function initiateLogin(pendingAction) {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  sessionStorage.setItem('pkce_verifier', verifier);
  if (pendingAction) sessionStorage.setItem('pending_action', JSON.stringify(pendingAction));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  sessionStorage.removeItem('pkce_verifier');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) throw new Error('Token exchange failed');
  return res.json(); // { access_token, refresh_token, expires_in }
}

export async function refreshToken(refresh) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });

  if (!res.ok) throw new Error('Token refresh failed');
  return res.json();
}

// --- API helpers ---

async function apiFetch(path, token, opts = {}) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });

  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Spotify ${res.status}`);
  }
  return res.json();
}

export const getMe = (token) => apiFetch('/me', token);

export async function getUserPlaylists(token) {
  const items = [];
  let url = '/me/playlists?limit=50';
  while (url) {
    const data = await apiFetch(url, token);
    items.push(...data.items.filter(Boolean));
    url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return items;
}

export async function getPlaylistTracks(playlistId, token) {
  const tracks = [];
  let url = `/playlists/${playlistId}/tracks?limit=50&fields=next,items(track(id,name,artists,album(release_date,images),uri))`;
  while (url) {
    const data = await apiFetch(url, token);
    for (const item of data.items) {
      const t = item?.track;
      if (!t?.id || !t.album?.release_date) continue;
      const year = parseInt(t.album.release_date.slice(0, 4), 10);
      if (isNaN(year)) continue;
      tracks.push({
        trackId: t.id,
        trackName: t.name,
        artist: t.artists.map((a) => a.name).join(', '),
        year,
        uri: t.uri,
        albumArt: t.album.images[0]?.url || null,
      });
    }
    url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return tracks;
}

// --- Playback (Spotify Connect) ---

export async function getDevices(token) {
  const data = await apiFetch('/me/player/devices', token);
  return data?.devices || [];
}

export async function playTrack(uri, token, deviceId) {
  const body = { uris: [uri] };
  const path = deviceId ? `/me/player/play?device_id=${deviceId}` : '/me/player/play';
  return apiFetch(path, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function pausePlayback(token) {
  return apiFetch('/me/player/pause', token, { method: 'PUT' });
}

export async function transferPlayback(deviceId, token) {
  return apiFetch('/me/player', token, {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}
