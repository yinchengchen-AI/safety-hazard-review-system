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

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
