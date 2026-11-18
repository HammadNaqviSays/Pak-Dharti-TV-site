"use server";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Job } from "@/models";

async function guard() { if (!(await isLoggedIn())) throw new Error("Not logged in"); await connectDB(); }
const done = () => { revalidatePath("/admin/jobs"); revalidatePath("/ur/jobs"); revalidatePath("/en/jobs"); };

export async function approveJobAction(id) { await guard(); await Job.updateOne({ _id: id }, { $set: { status: "published", publishedAt: new Date() } }); done(); }
export async function rejectJobAction(id) { await guard(); await Job.updateOne({ _id: id }, { $set: { status: "rejected" } }); done(); }
export async function unpublishJobAction(id) { await guard(); await Job.updateOne({ _id: id }, { $set: { status: "draft" } }); done(); }
