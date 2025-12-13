import { Context, Next } from 'koa';

export const securityHeaders = async (ctx: Context, next: Next) => {
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.spotify.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: i.scdn.co",
    "connect-src 'self' https://api.spotify.com wss://api.spotify.com",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self' https://p.scdn.co",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  ctx.set('Content-Security-Policy', csp);
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-Frame-Options', 'DENY');
  ctx.set('X-XSS-Protection', '1; mode=block');
  ctx.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  ctx.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Remove server signature
  ctx.remove('Server');
  
  await next();
};