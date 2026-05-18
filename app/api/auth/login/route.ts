import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGet, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  await initDB();
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Usuário e senha obrigatórios" }, { status: 400 });
  }

  const user = await dbGet<{ id: number; username: string; password_hash: string; name: string }>(
    "SELECT id, username, password_hash, name FROM users WHERE username = ?",
    username
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.name = user.name;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ ok: true, name: user.name });
}
