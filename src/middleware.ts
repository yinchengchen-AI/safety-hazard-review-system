import { auth } from '@/lib/auth';

export default auth((req) => {
  const isAuthed = !!req.auth;
  const isPublic = req.nextUrl.pathname === '/login';
  if (!isAuthed && !isPublic) {
    return Response.redirect(new URL('/login', req.url));
  }
  if (isAuthed && isPublic) {
    return Response.redirect(new URL('/', req.url));
  }
});

// 公开路径：auth、health、photos/[key]（签名 URL 跳转需要免登录渲染）
export const config = {
  matcher: ['/((?!api/auth|api/health|api/photos|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon-).*)'],
};
