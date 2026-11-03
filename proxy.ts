import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { sessaoAtiva } from "@/lib/acesso-ativo";
import { destinoDoRole, ehRoleRestrito, restritoPodeAcessar } from "@/lib/perfil-usuario";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  const { pathname } = req.nextUrl;
  const isLoginPath = pathname === "/login";
  const isApiAuth = pathname.startsWith("/api/auth");
  if (pathname.startsWith("/acesso/")) return res;

  if (isLoginPath || isApiAuth) {
    if (isLoginPath && session.isLoggedIn) {
      return NextResponse.redirect(new URL(destinoDoRole(session.role), req.url));
    }
    return res;
  }

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Usuário/técnico desativado (ou técnico sem senha) perde o acesso mesmo com o cookie válido
  if (!(await sessaoAtiva(session))) {
    const sair = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Seu acesso foi encerrado. Entre novamente." }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));
    (await getIronSession<SessionData>(req, sair, sessionOptions)).destroy();
    return sair;
  }

  // Técnico acessa o portal (inclui /portal/staff), as APIs do portal e as APIs do staff
  if (session.role === "tecnico") {
    const permitido =
      pathname.startsWith("/portal") ||
      pathname.startsWith("/api/portal") ||
      pathname.startsWith("/api/staff");
    if (!permitido) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
  }

  // Perfis "Só Telão" / "Só Envios": só a aba dele e as APIs dela
  if (ehRoleRestrito(session.role) && !restritoPodeAcessar(session.role, pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
    return NextResponse.redirect(new URL(destinoDoRole(session.role), req.url));
  }

  return res;
}

export const config = {
  // manifest e ícones ficam públicos: o celular baixa sem login para instalar o app
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|manifest.webmanifest|icon-|apple-icon).*)"],
};
