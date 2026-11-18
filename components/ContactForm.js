"use client";
import { useActionState } from "react";
import { sendMessage } from "@/lib/contactAction";

const T = {
  en: { name: "Your name", email: "Email (so we can reply)", subject: "Subject", body: "Message", send: "Send message", sending: "Sending…",
    done: "Thank you! Your message has reached our team.", short: "Please write a little more.", email_err: "Please check the email address.",
    subjects: ["General", "Correction", "News tip", "Business"] },
  ur: { name: "آپ کا نام", email: "ای میل (جواب کے لیے)", subject: "موضوع", body: "پیغام", send: "پیغام بھیجیں", sending: "بھیجا جا رہا ہے…",
    done: "شکریہ! آپ کا پیغام ہماری ٹیم تک پہنچ گیا ہے۔", short: "براہِ کرم کچھ مزید لکھیں۔", email_err: "ای میل ایڈریس دوبارہ دیکھیں۔",
    subjects: ["عام", "تصحیح", "خبر کی اطلاع", "کاروبار"] },
};

export default function ContactForm({ lang }) {
  const t = T[lang] || T.en;
  const [state, action, pending] = useActionState(sendMessage, null);
  if (state?.ok) return <p className="contact-done" role="status">{t.done}</p>;
  return (
    <form action={action} className="contact-form" dir={lang === "ur" ? "rtl" : "ltr"}>
      <input type="hidden" name="lang" value={lang} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      <label>{t.name}<input name="name" maxLength={120} autoComplete="name" /></label>
      <label>{t.email}<input name="email" type="email" maxLength={200} autoComplete="email" dir="ltr" /></label>
      <label>{t.subject}
        <select name="subject">{t.subjects.map((s) => <option key={s}>{s}</option>)}</select>
      </label>
      <label>{t.body}<textarea name="body" rows={6} required maxLength={5000} /></label>
      {state?.error && <p className="contact-err" role="alert">{state.error === "email" ? t.email_err : t.short}</p>}
      <button className="contact-send" disabled={pending}>{pending ? t.sending : t.send}</button>
    </form>
  );
}
