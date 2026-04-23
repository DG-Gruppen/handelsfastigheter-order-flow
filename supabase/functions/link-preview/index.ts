import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

function extractMeta(html: string, url: string): PreviewData {
  const head = html.slice(0, 200_000);
  const get = (re: RegExp) => {
    const m = head.match(re);
    return m ? m[1].trim() : null;
  };
  const decode = (s: string | null) =>
    s
      ? s
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
      : null;

  const ogTitle = get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)
    || get(/<title[^>]*>([^<]+)<\/title>/i);
  const ogDesc = get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  let ogImage = get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  const ogSite = get(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);

  // Resolve relative image URLs
  if (ogImage && !ogImage.startsWith('http')) {
    try {
      ogImage = new URL(ogImage, url).toString();
    } catch { /* ignore */ }
  }

  let siteName = ogSite;
  if (!siteName) {
    try { siteName = new URL(url).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
  }

  return {
    url,
    title: decode(ogTitle),
    description: decode(ogDesc),
    image_url: ogImage,
    site_name: decode(siteName),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    let { url } = body as { url?: string };
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    // Validate URL and block private hosts (SSRF protection)
    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' || host.endsWith('.local') ||
      host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') ||
      /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return new Response(JSON.stringify({ error: 'Forbidden host' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Check cache
    const { data: cached } = await admin
      .from('link_preview_cache')
      .select('*')
      .eq('url', url)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({
        url: cached.url,
        title: cached.title,
        description: cached.description,
        image_url: cached.image_url,
        site_name: cached.site_name,
        cached: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch with timeout + size cap
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let html = '';
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SHFIntraBot/1.0; +https://intra.handelsfastigheter.se)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'sv,en;q=0.8',
        },
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('text/html')) {
        clearTimeout(timeout);
        return new Response(JSON.stringify({ error: 'Not previewable', url }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Read up to ~512KB
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder('utf-8');
        let total = 0;
        const MAX = 512 * 1024;
        while (total < MAX) {
          const { done, value } = await reader.read();
          if (done) break;
          html += decoder.decode(value, { stream: true });
          total += value.byteLength;
        }
        try { await reader.cancel(); } catch { /* ignore */ }
      } else {
        html = await res.text();
      }
    } catch (e) {
      clearTimeout(timeout);
      return new Response(JSON.stringify({ error: 'Fetch failed', url }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    clearTimeout(timeout);

    const preview = extractMeta(html, url);

    // Upsert cache
    await admin.from('link_preview_cache').upsert({
      url,
      title: preview.title,
      description: preview.description,
      image_url: preview.image_url,
      site_name: preview.site_name,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'url' });

    return new Response(JSON.stringify({ ...preview, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('link-preview error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
