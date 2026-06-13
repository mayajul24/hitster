// Original-release-year lookup via MusicBrainz (free, no API key).
//
// Spotify's album.release_date is the date of the album a track currently sits
// on — for compilations / "Greatest Hits" / remasters that's NOT the song's
// original year. MusicBrainz exposes a recording's `first-release-date`, which
// is the original. We take the earliest first-release-date we can find and use
// min(spotifyYear, mbYear) as the best "original" year. Results are cached and
// requests are throttled to <=1/sec per MusicBrainz etiquette.

const cache = new Map(); // key -> earliest MB year (number) or null
let chain = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOW = new Date().getFullYear();
const UA = 'Hitster/1.0 ( https://github.com/mayajul24/hitster )';

// Serialize outgoing requests, spaced >=1.1s apart.
function schedule(fn) {
  const result = chain.then(fn);
  chain = result.then(() => sleep(1100), () => sleep(1100));
  return result;
}

async function mbFetch(url) {
  return schedule(async () => {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('MusicBrainz ' + res.status);
    return res.json();
  });
}

function earliestYear(recordings) {
  let min = null;
  for (const r of recordings || []) {
    const d = r['first-release-date'];
    if (!d) continue;
    const y = parseInt(String(d).slice(0, 4), 10);
    if (!y || y < 1900 || y > NOW + 1) continue;
    if (min == null || y < min) min = y;
  }
  return min;
}

async function queryYear({ isrc, trackName, artist }) {
  // Gather the earliest first-release-date from BOTH the ISRC match and the
  // title+artist search, then take the overall earliest. (A remaster's ISRC
  // points at a late-dated recording, but the title search still finds the
  // original — so the minimum recovers the true original year.)
  const years = [];

  if (isrc) {
    try {
      const d = await mbFetch(
        `https://musicbrainz.org/ws/2/recording?query=isrc:${encodeURIComponent(isrc)}&fmt=json&limit=25`
      );
      const y = earliestYear(d.recordings);
      if (y) years.push(y);
    } catch {}
  }

  if (trackName && artist) {
    try {
      const primary = artist.split(',')[0].trim();
      const q = `recording:"${trackName}" AND artist:"${primary}"`;
      const d = await mbFetch(
        `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=25`
      );
      const y = earliestYear(d.recordings);
      if (y) years.push(y);
    } catch {}
  }

  return years.length ? Math.min(...years) : null;
}

// Returns the best original year for a track, falling back to the Spotify year.
async function lookupYear({ isrc, trackName, artist, fallbackYear }) {
  const key = (isrc || `${trackName}|${artist}`).toLowerCase();
  let mbY;
  if (cache.has(key)) {
    mbY = cache.get(key);
  } else {
    try {
      mbY = await queryYear({ isrc, trackName, artist });
    } catch {
      mbY = null;
    }
    cache.set(key, mbY);
  }
  if (mbY == null) return fallbackYear;
  return fallbackYear ? Math.min(fallbackYear, mbY) : mbY;
}

module.exports = { lookupYear };
