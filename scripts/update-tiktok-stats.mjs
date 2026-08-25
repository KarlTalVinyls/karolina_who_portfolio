// Fetches public stats for @karllovevinyls from TikTok's profile page and
// writes them to tiktok-stats.json, which index.html reads on load.
//
// TikTok has no public API for follower/like counts, so this parses the
// JSON TikTok embeds in the profile page itself (the same data the page
// uses to render). If TikTok changes their page structure, this will start
// failing loudly (non-zero exit) instead of writing bad data — the site
// just keeps showing the last known-good numbers until it's fixed.

const PROFILE_URL = 'https://www.tiktok.com/@karllovevinyls';
const OUTPUT_PATH = new URL('../tiktok-stats.json', import.meta.url);

function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

async function main() {
  const res = await fetch(PROFILE_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Profile fetch failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) {
    throw new Error('Could not find embedded profile data in the page (TikTok may have changed their markup).');
  }

  const data = JSON.parse(match[1]);
  const userDetail = data?.__DEFAULT_SCOPE__?.['webapp.user-detail'];
  const stats = userDetail?.userInfo?.stats;

  if (!stats || typeof stats.followerCount !== 'number' || typeof stats.heartCount !== 'number') {
    throw new Error('Profile data did not contain the expected stats fields.');
  }

  const output = {
    followers: stats.followerCount,
    likes: formatCount(stats.heartCount),
    updatedAt: new Date().toISOString(),
  };

  const fs = await import('node:fs/promises');
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log('Updated tiktok-stats.json:', output);
}

main().catch(err => {
  console.error('Failed to update TikTok stats:', err.message);
  process.exit(1);
});
