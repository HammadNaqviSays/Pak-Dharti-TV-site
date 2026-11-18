"use server";
import { connectDB } from "./db";
import { Message } from "@/models";

// Saves a contact-form message. A hidden "website" field catches simple bots.
export async function sendMessage(_prev, form) {
  if (form.get("website")) return { ok: true };
  const body = String(form.get("body") || "").trim();
  const email = String(form.get("email") || "").trim();
  if (body.length < 5) return { ok: false, error: "short" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "email" };
  await connectDB();
  await Message.create({
    name: String(form.get("name") || "").slice(0, 120),
    email: email.slice(0, 200),
    subject: String(form.get("subject") || "").slice(0, 200),
    body: body.slice(0, 5000),
    lang: String(form.get("lang") || ""),
  });
  return { ok: true };
}
