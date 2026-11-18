// Site-wide settings. Fill in the social links you have; empty ones are hidden.
export const SITE = {
  url: process.env.SITE_URL || "https://www.pakdhartitv.com",
  social: {
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://www.facebook.com/PakDhartiTV",
    youtube: process.env.NEXT_PUBLIC_YOUTUBE_URL || "",
    x: process.env.NEXT_PUBLIC_X_URL || "",
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/pakdhartitv/",
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL || "",
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL || "https://whatsapp.com/channel/0029Va8jtx60LKZMvaskC22D",
  },
};

export const ICONS = {
  icon: [
    { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
    { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
  ],
  apple: "/brand/apple-icon.png",
};
